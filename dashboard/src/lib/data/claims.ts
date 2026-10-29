import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { analyzeClaims, type Claim, type ClaimAnalysis } from "@/lib/claims/analysis";
import { matchJrHospital } from "@/lib/hospital-match";
import { createClient } from "@/lib/supabase/server";

import type { Hospital } from "./types";

/** Tag on the claim analysis; uploading new claim data refreshes it. */
export const CLAIMS_TAG = "claims";

/**
 * Part of the cached analysis' key: raise it whenever what analyzeClaims returns changes shape, or a
 * result cached by the previous code (which outlives restarts and deploys) is served to the new one.
 */
const ANALYSIS_VERSION = "5";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type ClaimRecord = {
  guarantee_id: string;
  victim_name?: string | null;
  los: number | null;
  care_type: string | null;
  hospital_name: string;
  diagnosis: string | null;
  injury_category: string | null;
  surgery: string | null;
  procedure_note?: string | null;
  room_class: string | null;
  billed: number | string | null;
  paid: number | string;
  loket: string | null;
};

// The victim's name counts the victims with more than one GL; the analysis keeps no name.
const ANALYSIS_COLUMNS = "guarantee_id, victim_name, los, care_type, hospital_name, diagnosis, injury_category, surgery, room_class, billed, paid, loket";
const DETAIL_COLUMNS = `${ANALYSIS_COLUMNS}, procedure_note`;

// PostgREST returns at most this many rows per request.
const PAGE = 1000;
const PARALLEL = 8;

const toClaim = (r: ClaimRecord): Claim => ({
  guaranteeId: r.guarantee_id,
  victim: r.victim_name ?? null,
  los: r.los,
  careType: r.care_type ?? "",
  hospital: r.hospital_name,
  diagnosis: r.diagnosis ?? "",
  category: r.injury_category,
  surgery: r.surgery,
  procedureNote: r.procedure_note ?? null,
  roomClass: r.room_class,
  billed: r.billed === null ? null : Number(r.billed),
  paid: Number(r.paid),
  loket: r.loket,
});

/** Every claim of the import (one hospital's when named), fetched a page at a time. */
async function loadClaims(supabase: Supabase, importId: string, { hospital, columns }: { hospital?: string; columns: string }) {
  const scope = hospital ? { import_id: importId, hospital_name: hospital } : { import_id: importId };
  const { count, error } = await supabase.from("claims").select("id", { count: "exact", head: true }).match(scope);
  if (error) throw new Error(`Could not count claims: ${error.message}`);
  const offsets = Array.from({ length: Math.ceil((count ?? 0) / PAGE) }, (_, i) => i * PAGE);
  const rows: ClaimRecord[] = [];
  for (let i = 0; i < offsets.length; i += PARALLEL) {
    const pages = await Promise.all(
      offsets.slice(i, i + PARALLEL).map((from) => supabase.from("claims").select(columns).match(scope).order("id").range(from, from + PAGE - 1).returns<ClaimRecord[]>()),
    );
    for (const page of pages) {
      if (page.error) throw new Error(`Could not load claims: ${page.error.message}`);
      rows.push(...(page.data ?? []));
    }
  }
  return rows.map(toClaim);
}

export type ClaimImport = { id: string; source: string; rows: number; createdAt: string };

/** The claim data in use, or null before any is uploaded (or before migrations/011 is run). */
export const getClaimImport = cache(async (): Promise<ClaimImport | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claim_imports")
    .select("id, source_file, row_count, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; source_file: string; row_count: number; created_at: string }>();
  if (error || !data) return null;
  return { id: data.id, source: data.source_file, rows: data.row_count, createdAt: data.created_at };
});

/**
 * Red flags and profiles of every hospital in the claim data. Working them out reads every claim, so
 * the result is kept until new data is uploaded.
 */
export const getClaimAnalysis = cache(async (): Promise<(ClaimAnalysis & { import: ClaimImport }) | null> => {
  const current = await getClaimImport();
  if (!current) return null;
  const supabase = await createClient();
  const analysis = await unstable_cache(
    async () => analyzeClaims(await loadClaims(supabase, current.id, { columns: ANALYSIS_COLUMNS })),
    ["claim-analysis", ANALYSIS_VERSION, current.id],
    { tags: [CLAIMS_TAG] },
  )();
  return { ...analysis, import: current };
});

/** Every claim of one hospital, with the victim and the procedure note the analysis leaves out. */
export async function getHospitalClaims(hospital: string): Promise<Claim[]> {
  const current = await getClaimImport();
  if (!current) return [];
  return loadClaims(await createClient(), current.id, { hospital, columns: DETAIL_COLUMNS });
}

/**
 * The name the claim data gives a hospital of the app: the claim export writes names as Jasa Raharja's
 * list does ("RSUD SOEDONO, KOTA MADIUN"), so a hospital linked to the list matches its row exactly;
 * others are matched by name as when linking to the list.
 */
export const claimNameOf = (hospital: Pick<Hospital, "name" | "city" | "jasaRaharja">, names: string[]) => {
  const linked = hospital.jasaRaharja?.name;
  if (linked && names.includes(linked)) return linked;
  return matchJrHospital(hospital, names.map((name) => ({ name })))?.name;
};
