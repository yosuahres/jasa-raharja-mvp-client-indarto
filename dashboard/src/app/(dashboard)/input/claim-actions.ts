"use server";

import { revalidatePath, updateTag } from "next/cache";

import { CLAIM_CHUNK, type ClaimRow } from "@/lib/claims/sheet";
import { CLAIMS_TAG, claimNameOf } from "@/lib/data/claims";
import { SHARED_DATA_TAG } from "@/lib/data/queries";
import { requireUser, saveError, slugify } from "@/lib/form";
import { titleCase } from "@/lib/format";
import { jrNameParts } from "@/lib/hospital-match";
import { createClient } from "@/lib/supabase/server";

type Result = { error: string | null };

/** Opens an import for the rows that follow. Imports left unfinished by an earlier upload go. */
export async function startClaimImport(sourceFile: string): Promise<Result & { id?: string }> {
  const supabase = await createClient();
  const denied = await requireUser(supabase);
  if (denied) return { error: denied };
  await supabase.from("claim_imports").delete().eq("status", "loading");
  const { data, error } = await supabase.from("claim_imports").insert({ source_file: sourceFile }).select("id").single();
  if (error) return { error: saveError(error) };
  return { error: null, id: data.id };
}

const toRecord = (importId: string, r: ClaimRow) => ({
  import_id: importId,
  guarantee_id: r[0],
  victim_name: r[1],
  los: r[2] === null ? null : Math.round(r[2]),
  care_type: r[3],
  hospital_name: r[4],
  diagnosis: r[5],
  injury_category: r[6],
  surgery: r[7],
  procedure_note: r[8],
  room_class: r[9],
  billed: r[10],
  paid: r[11],
  region: r[12],
  loket: r[13],
});

export async function addClaimRows(importId: string, rows: ClaimRow[]): Promise<Result> {
  const supabase = await createClient();
  const denied = await requireUser(supabase);
  if (denied) return { error: denied };
  if (rows.length > CLAIM_CHUNK) return { error: "Terlalu banyak baris dalam satu kiriman." };
  const { error } = await supabase.from("claims").insert(rows.map((r) => toRecord(importId, r)));
  return { error: error ? saveError(error) : null };
}

type Client = Awaited<ReturnType<typeof createClient>>;

/** A hospital as the claim data names it, e.g. "RSUD SOEDONO, KOTA MADIUN", and its region ("WILAYAH JAWA TIMUR"). */
export type ClaimHospital = { name: string; region: string | null };

/**
 * Adds the claim data's hospitals the app doesn't have yet, so each has the same page as any other: its
 * claims now, a tariff whenever one is uploaded or typed in. Name and city come from how the data writes
 * it; the Jasa Raharja list row with the same name links its loket. Returns how many were added.
 */
async function addMissingHospitals(supabase: Client, claimHospitals: ClaimHospital[]) {
  const [{ data: hospitals, error }, { data: jrList }] = await Promise.all([
    supabase.from("hospitals").select("id, name, city, jr_hospitals(code, name, loket_code, loket_name)"),
    supabase.from("jr_hospitals").select("code, name"),
  ]);
  if (error) throw new Error(saveError(error));
  const names = claimHospitals.map((h) => h.name);
  const have = new Set(
    (hospitals ?? []).flatMap((h) => {
      const jr = h.jr_hospitals as unknown as { code: string; name: string; loket_code: string; loket_name: string } | null;
      const jasaRaharja = jr ? { code: jr.code, name: jr.name, loketCode: jr.loket_code, loketName: jr.loket_name } : null;
      return claimNameOf({ name: h.name, city: h.city, jasaRaharja }, names) ?? [];
    }),
  );
  const taken = new Set((hospitals ?? []).map((h) => h.id));
  const jrCode = new Map((jrList ?? []).map((r) => [r.name, r.code]));

  const rows = claimHospitals
    .filter((h) => !have.has(h.name))
    .map((h) => {
      const { name, place } = jrNameParts(h.name);
      const base = slugify(`${name} ${place}`);
      let id = base;
      for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
      taken.add(id);
      return {
        id,
        name,
        city: titleCase(place),
        province: h.region ? titleCase(h.region.replace(/^WILAYAH\s+/i, "")) : "",
        jr_code: jrCode.get(h.name) ?? null,
      };
    });
  if (rows.length === 0) return 0;
  const { error: insertError } = await supabase.from("hospitals").insert(rows);
  if (insertError) throw new Error(saveError(insertError));
  return rows.length;
}

/**
 * Makes the import the current claim data; the previous one and its rows go. Hospitals in the data the
 * app doesn't have yet are added.
 */
export async function finishClaimImport(importId: string, claimHospitals: ClaimHospital[]): Promise<Result & { count?: number; added?: number }> {
  const supabase = await createClient();
  const denied = await requireUser(supabase);
  if (denied) return { error: denied };
  const { count, error: countError } = await supabase.from("claims").select("id", { count: "exact", head: true }).eq("import_id", importId);
  if (countError) return { error: saveError(countError) };
  const { error } = await supabase.from("claim_imports").update({ status: "active", row_count: count ?? 0 }).eq("id", importId);
  if (error) return { error: saveError(error) };
  const { error: cleanupError } = await supabase.from("claim_imports").delete().neq("id", importId);
  if (cleanupError) return { error: saveError(cleanupError) };

  let added = 0;
  try {
    added = await addMissingHospitals(supabase, claimHospitals);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Rumah sakit dari data klaim tidak tersimpan." };
  } finally {
    updateTag(CLAIMS_TAG);
    updateTag(SHARED_DATA_TAG);
    revalidatePath("/", "layout");
  }
  return { error: null, count: count ?? 0, added };
}

/** Drops an import that didn't finish, so its rows don't linger. */
export async function discardClaimImport(importId: string): Promise<Result> {
  const supabase = await createClient();
  const denied = await requireUser(supabase);
  if (denied) return { error: denied };
  const { error } = await supabase.from("claim_imports").delete().eq("id", importId).eq("status", "loading");
  return { error: error ? saveError(error) : null };
}
