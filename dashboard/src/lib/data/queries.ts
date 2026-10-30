import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import type { CategoryId } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";

import { LINE_SELECT, type LineRow, searchWords, toLine } from "./rows";
import type { Catalog, CategoryCounts, Dataset, Hospital, JrHospital, LocationSource, PricedTreatment, TariffBook, TariffLine, Treatment, TreatmentLine } from "./types";

const must = <T>(result: { data: T | null; error: { message: string } | null }, what: string): T => {
  if (result.error) throw new Error(`Could not load ${what}: ${result.error.message}`);
  return result.data as T;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Tag on the reads every signed-in user shares; saving a document refreshes them. */
export const SHARED_DATA_TAG = "shared-data";

/**
 * A read cached across requests and users: every signed-in staff member may read everything
 * (supabase/schema.sql, access rules), and the price index behind the hospitals is costly to work out.
 * Saving a document refreshes it at once; anything else (map pins, SQL run by hand) within a minute,
 * served stale meanwhile so no page waits on it.
 */
const shared = <T>(name: string, load: (supabase: Supabase) => Promise<T>) =>
  cache(async (): Promise<T> => {
    // The client is made outside the cached function: cookies can't be read inside one.
    const supabase = await createClient();
    return unstable_cache(() => load(supabase), [name], { tags: [SHARED_DATA_TAG], revalidate: 60 })();
  });

/** The facilities and specialists the system recognises. */
export const getCatalog = shared("catalog", async (supabase): Promise<Catalog> => {
  const [facilities, specialties] = await Promise.all([
    supabase.from("facilities").select("id, name, category, keywords").order("name"),
    supabase.from("specialties").select("id, name, keywords").order("name"),
  ]);
  return { facilities: must(facilities, "facilities"), specialties: must(specialties, "specialties") };
});

type JrRow = { code: string; name: string; loket_code: string; loket_name: string };

const toJr = (row: JrRow | null): JrHospital | null =>
  row ? { code: row.code, name: row.name, loketCode: row.loket_code, loketName: row.loket_name } : null;

type HospitalRow = Omit<Hospital, "location" | "facilities" | "staff" | "priceIndex" | "tariffBook" | "previousBook" | "jasaRaharja"> & {
  hospital_facilities: { facility_id: string; qty: number | null; available_24h: boolean | null }[];
  hospital_staff: { specialty_id: string; headcount: number | null; on_call_24h: boolean | null }[];
  jr_hospitals: JrRow | null;
};

/** Jasa Raharja's list of partner hospitals, by name. Empty until the sheet is uploaded. */
export const getJrHospitals = shared("jr-hospitals", async (supabase): Promise<JrHospital[]> => {
  const result = await supabase.from("jr_hospitals").select("code, name, loket_code, loket_name").order("name").returns<JrRow[]>();
  // The table arrives with migrations/010; until it exists, nothing is linked.
  return result.error ? [] : (result.data ?? []).flatMap((r) => toJr(r) ?? []);
});

type PriceIndexRow = { hospital_id: string; price_index: number; compared_rows: number };

type LocationRow = { id: string; lat: number | null; lng: number | null; location_source: LocationSource | null };

type BookRow = {
  id: string;
  hospital_id: string;
  version: string;
  valid_from: string | null;
  valid_to: string | null;
  source_file: string;
  category_counts: CategoryCounts;
};

const toBook = (row: BookRow | undefined): TariffBook | null =>
  row
    ? {
        id: row.id,
        version: row.version,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        source: row.source_file,
        categories: row.category_counts,
        rows: Object.values(row.category_counts).reduce((sum, n) => sum + (n ?? 0), 0),
      }
    : null;

/** Every pin with where it came from; before migrations/013 there is no source to read, so just the pins. */
const getLocations = async (supabase: Supabase) => {
  const withSource = await supabase.from("hospitals").select("id, lat, lng, location_source").not("lat", "is", null).returns<LocationRow[]>();
  if (!withSource.error) return withSource;
  return supabase.from("hospitals").select("id, lat, lng").not("lat", "is", null).returns<LocationRow[]>();
};

/** Every hospital with its current and previous published document. */
export const getHospitals = shared("hospitals", async (supabase): Promise<Hospital[]> => {
  const [hospitalsResult, booksResult, priceResult, locationResult] = await Promise.all([
    supabase
      .from("hospitals")
      .select("id, name, ownership, city, province, address, beds, hospital_facilities(*), hospital_staff(*), jr_hospitals(code, name, loket_code, loket_name)")
      .order("name")
      // jr_code points at one row, so the embed is an object; the client's own guess is an array.
      .returns<HospitalRow[]>(),
    supabase
      .from("tariff_books")
      .select("id, hospital_id, version, valid_from, valid_to, source_file, category_counts")
      .eq("status", "published")
      .order("published_at", { ascending: false }),
    supabase.from("hospital_price_index").select("hospital_id, price_index, compared_rows").returns<PriceIndexRow[]>(),
    getLocations(supabase),
  ]);
  const hospitals = must<HospitalRow[]>(hospitalsResult, "hospitals");
  const books = must<BookRow[]>(booksResult, "tariff books");
  // The price index is a view (migrations/005); until it exists, hospitals just have no price rating.
  const prices = priceResult.error ? [] : (priceResult.data ?? []);
  // Likewise the coordinates (migrations/008): until they exist, no hospital has a pin.
  const locations = locationResult.error ? [] : (locationResult.data ?? []);

  return hospitals.map(({ hospital_facilities, hospital_staff, jr_hospitals, ...h }) => {
    // Newest first, so a hospital's first two are its current and previous ones.
    const [current, previous] = books.filter((b) => b.hospital_id === h.id);
    const price = prices.find((p) => p.hospital_id === h.id);
    const location = locations.find((l) => l.id === h.id);
    return {
      ...h,
      jasaRaharja: toJr(jr_hospitals),
      // Pins from before migrations/013 have no source; they were all found by the lookup.
      location:
        location?.lat != null && location.lng != null
          ? { lat: location.lat, lng: location.lng, source: location.location_source ?? "geocoder" }
          : null,
      facilities: hospital_facilities.map((f) => ({ facilityId: f.facility_id, qty: f.qty, available24h: f.available_24h })),
      staff: hospital_staff.map((s) => ({ specialtyId: s.specialty_id, headcount: s.headcount, onCall24h: s.on_call_24h })),
      priceIndex: price ? { ratio: Number(price.price_index), compared: price.compared_rows } : null,
      tariffBook: toBook(current),
      previousBook: toBook(previous),
    };
  });
});

export const getDataset = cache(async (): Promise<Dataset> => {
  const [catalog, hospitals] = await Promise.all([getCatalog(), getHospitals()]);
  return { catalog, hospitals };
});

export type BookLines = { lines: TariffLine[]; total: number };

/** One page of a document's rows, optionally in one category and matching a search. */
export async function getBookLines(
  bookId: string,
  { category, query, limit, offset = 0 }: { category?: CategoryId; query?: string; limit: number; offset?: number },
): Promise<BookLines> {
  const supabase = await createClient();
  let request = supabase.from("tariff_rows").select(LINE_SELECT, { count: "exact" }).eq("book_id", bookId);
  if (category) request = request.eq("category", category);
  for (const word of searchWords(query ?? "")) request = request.ilike("raw_name", `%${word}%`);
  const result = await request.order("position").range(offset, offset + limit - 1).returns<LineRow[]>();
  return { lines: must(result, "tariff rows").map(toLine), total: result.count ?? 0 };
}

/** Rows of these documents whose name has every word of the search, with the document each is in. */
export async function searchLines(query: string, bookIds: string[]): Promise<(TariffLine & { bookId: string })[]> {
  const words = searchWords(query);
  if (words.length === 0 || bookIds.length === 0) return [];
  const supabase = await createClient();
  let request = supabase.from("tariff_rows").select(`book_id, ${LINE_SELECT}`).in("book_id", bookIds);
  for (const word of words) request = request.ilike("raw_name", `%${word}%`);
  const rows = must(await request.limit(1000).returns<(LineRow & { book_id: string })[]>(), "tariff rows");
  return rows.map((row) => ({ ...toLine(row), bookId: row.book_id }));
}

type TreatmentListRow = { key: string; names: string[]; hospitals: number };

const wordCount = (text: string) => text.split(/\s+/).length;
const isShouting = (text: string) => text === text.toUpperCase();

/** The plainest way the documents print a tindakan: no size or class after it, fewest words, not in capitals. */
const plainestName = (names: string[]) => {
  const whole = names.filter((n) => !n.includes(" — "));
  return [...(whole.length ? whole : names)].sort(
    (a, b) => wordCount(a) - wordCount(b) || Number(isShouting(a)) - Number(isShouting(b)) || a.length - b.length,
  )[0];
};

const toTreatment = (row: TreatmentListRow): Treatment => ({ key: row.key, name: plainestName(row.names), hospitals: row.hospitals });

/** Tindakan in the current documents whose names have every word of the search, those more hospitals price first. */
export async function findTreatments(query: string, limit = 30): Promise<Treatment[]> {
  return queryTreatments(await createClient(), query, limit);
}

/** The tindakan most hospitals price, offered before anything is typed. */
export const getTopTreatments = shared("top-treatments", (supabase) => queryTreatments(supabase, "", 30));

async function queryTreatments(supabase: Supabase, query: string, limit: number): Promise<Treatment[]> {
  let request = supabase.from("treatment_list").select("key, names, hospitals");
  for (const word of searchWords(query)) request = request.ilike("search", `%${word}%`);
  const result = await request.order("hospitals", { ascending: false }).order("key").limit(limit).returns<TreatmentListRow[]>();
  return must(result, "tindakan").map(toTreatment);
}

export async function getTreatment(key: string): Promise<Treatment | null> {
  const supabase = await createClient();
  const result = await supabase.from("treatment_list").select("key, names, hospitals").eq("key", key).maybeSingle<TreatmentListRow>();
  const row = must(result, "tindakan");
  return row ? toTreatment(row) : null;
}

/** These tindakan with the lowest and highest price these documents give them; those no document prices are left out. */
export async function getTreatmentsWithPrices(keys: string[], bookIds: string[]): Promise<PricedTreatment[]> {
  if (keys.length === 0 || bookIds.length === 0) return [];
  const supabase = await createClient();
  const [list, priced] = await Promise.all([
    supabase.from("treatment_list").select("key, names, hospitals").in("key", keys).returns<TreatmentListRow[]>(),
    supabase
      .from("tariff_treatments")
      .select("key, tariff_rows(tariff_prices(amount, superseded))")
      .in("key", keys)
      .in("book_id", bookIds)
      .limit(5000)
      .returns<{ key: string; tariff_rows: { tariff_prices: { amount: number | null; superseded: boolean }[] } }[]>(),
  ]);
  const amounts = new Map<string, number[]>();
  for (const row of must(priced, "tindakan prices")) {
    const current = row.tariff_rows.tariff_prices.filter((p) => !p.superseded && p.amount !== null).map((p) => Number(p.amount));
    amounts.set(row.key, [...(amounts.get(row.key) ?? []), ...current]);
  }
  return must(list, "tindakan").map((row) => {
    const prices = amounts.get(row.key) ?? [];
    return {
      ...toTreatment(row),
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
    };
  });
}

/** Every row of these documents that prices one of the tindakan. */
export async function getTreatmentLines(keys: string[], bookIds: string[]): Promise<TreatmentLine[]> {
  if (keys.length === 0 || bookIds.length === 0) return [];
  const supabase = await createClient();
  const rows = must(
    await supabase
      .from("tariff_treatments")
      .select(`key, name, book_id, tariff_rows(${LINE_SELECT})`)
      .in("key", keys)
      .in("book_id", bookIds)
      .limit(1000)
      .returns<{ key: string; name: string; book_id: string; tariff_rows: LineRow }[]>(),
    "tindakan rows",
  );
  return rows.map((row) => ({ ...toLine(row.tariff_rows), bookId: row.book_id, key: row.key, treatmentName: row.name }));
}

export type BookRowStats = { total: number; needsCheck: number };

export const getBookRowStats = cache(async (bookId: string): Promise<BookRowStats> => {
  const supabase = await createClient();
  const [total, flagged] = await Promise.all([
    supabase.from("tariff_rows").select("id", { count: "exact", head: true }).eq("book_id", bookId),
    supabase.from("tariff_rows").select("id", { count: "exact", head: true }).eq("book_id", bookId).not("flags", "eq", "{}"),
  ]);
  if (total.error || flagged.error) throw new Error(`Could not count tariff rows: ${(total.error ?? flagged.error)?.message}`);
  return { total: total.count ?? 0, needsCheck: flagged.count ?? 0 };
});

export type UnfinishedUpload = {
  id: string;
  source: string;
  status: "queued" | "extracting" | "review" | "failed";
  createdAt: string;
  /** Set when it was uploaded as a new version of this hospital's tariffs. */
  hospitalId: string | null;
};

/** Uploads not yet saved from their preview, newest first, so the upload page can offer to resume them. */
export const getUnfinishedUploads = cache(async (): Promise<UnfinishedUpload[]> => {
  const supabase = await createClient();
  const rows = must<{ id: string; source_file: string; status: UnfinishedUpload["status"]; created_at: string; hospital_id: string | null }[]>(
    await supabase
      .from("tariff_books")
      .select("id, source_file, status, created_at, hospital_id")
      .in("status", ["queued", "extracting", "review", "failed"])
      .order("created_at", { ascending: false })
      .limit(5),
    "tariff books",
  );
  return rows.map((r) => ({ id: r.id, source: r.source_file, status: r.status, createdAt: r.created_at, hospitalId: r.hospital_id }));
});
