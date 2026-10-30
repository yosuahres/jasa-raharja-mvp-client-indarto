"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import { CATEGORIES } from "@/lib/categories";
import { SHARED_DATA_TAG } from "@/lib/data/queries";
import { OWNERSHIPS } from "@/lib/data/types";
import { requireUser, saveError, text } from "@/lib/form";
import { geocodeHospital } from "@/lib/geocode";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

// Rows a person types in carry this flag (FLAG_LABEL in lib/data/rows.ts names it in the table).
const MANUAL_FLAG = "manual";

/** An optional whole number: null when left empty, undefined when it isn't one. */
const wholeNumber = (raw: string): number | null | undefined => {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};

const whole = (data: FormData, key: string) => wholeNumber(text(data, key));

/** "ya" / "tidak", or null when not known. */
const yesNo = (data: FormData, key: string) => {
  const raw = text(data, key);
  return raw === "ya" ? true : raw === "tidak" ? false : null;
};

/** Every page that shows the hospital reads the shared data, so all of it refreshes. */
const saved = (): ActionState => {
  updateTag(SHARED_DATA_TAG);
  revalidatePath("/", "layout");
  return { error: null };
};

const PROFILE_FIELDS = ["name", "ownership", "beds", "address", "city", "province"] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

/** One of the hospital's own facts, typed in where it's shown; its pin on the map follows the name and address. */
export async function saveProfileField(hospitalId: string, field: ProfileField, value: string): Promise<ActionState> {
  const supabase = await createClient();
  const denied = await requireUser(supabase);
  if (denied) return { error: denied };
  if (!PROFILE_FIELDS.includes(field)) return { error: "Data tidak dikenal." };

  const raw = value.trim();
  let column: Record<string, string | number | null> = { [field]: raw };
  if (field === "name" && !raw) return { error: "Nama rumah sakit harus diisi." };
  if (field === "ownership") {
    if (raw && !OWNERSHIPS.includes(raw as (typeof OWNERSHIPS)[number])) return { error: "Kepemilikan tidak dikenal." };
    column = { ownership: raw || null };
  }
  if (field === "beds") {
    const beds = wholeNumber(raw);
    if (beds === undefined) return { error: "Jumlah tempat tidur harus bilangan bulat." };
    column = { beds: beds ?? 0 };
  }

  const { error } = await supabase.from("hospitals").update(column).eq("id", hospitalId);
  if (error) return { error: saveError(error) };
  if (field !== "ownership" && field !== "beds") after(() => geocodeHospital(supabase, hospitalId));
  return saved();
}

/**
 * The hospital's pin, put on the map by hand; the lookup leaves it there from then on. `intent`
 * "otomatis" hands it back to the lookup, which finds the hospital again or puts it near its town.
 */
export async function savePin(_previous: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const denied = await requireUser(supabase);
  if (denied) return { error: denied };
  const hospitalId = text(data, "hospital_id");

  if (text(data, "intent") === "otomatis") {
    const { error } = await supabase.from("hospitals").update({ location_source: null, geocoded_query: null }).eq("id", hospitalId);
    if (error) return { error: saveError(error) };
    after(() => geocodeHospital(supabase, hospitalId));
    return saved();
  }

  const lat = Number(text(data, "lat"));
  const lng = Number(text(data, "lng"));
  if (!text(data, "lat") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: "Klik peta di letak rumah sakit." };
  }
  const { error } = await supabase
    .from("hospitals")
    .update({ lat, lng, location_source: "manual", geocoded_at: new Date().toISOString() })
    .eq("id", hospitalId);
  if (error) return { error: saveError(error) };
  return saved();
}

export type BookField = "version" | "year";

/** The published document's version, or the year its tariffs are for, typed in where it's shown. */
export async function saveBookField(bookId: string, field: BookField, value: string): Promise<ActionState> {
  const supabase = await createClient();
  const denied = await requireUser(supabase);
  if (denied) return { error: denied };

  const raw = value.trim();
  let column: Record<string, string | null>;
  if (field === "version") {
    if (!raw) return { error: "Versi harus diisi." };
    column = { version: raw };
  } else if (field === "year") {
    const year = wholeNumber(raw);
    if (year === undefined || (year !== null && (year < 1990 || year > 2100))) return { error: "Tahun tarif tidak valid." };
    column = { valid_from: year ? `${year}-01-01` : null, valid_to: year ? `${year}-12-31` : null };
  } else {
    return { error: "Data tidak dikenal." };
  }

  const { error } = await supabase.from("tariff_books").update(column).eq("id", bookId);
  if (error) return { error: saveError(error) };
  return saved();
}

type ResourceTable = { table: "hospital_facilities" | "hospital_staff"; key: string; count: string; roundTheClock: string };

const RESOURCE: Record<"fasilitas" | "tenaga-medis", ResourceTable> = {
  fasilitas: { table: "hospital_facilities", key: "facility_id", count: "qty", roundTheClock: "available_24h" },
  "tenaga-medis": { table: "hospital_staff", key: "specialty_id", count: "headcount", roundTheClock: "on_call_24h" },
};

/** A facility or specialty the hospital has, with how many and whether round the clock; `intent` "hapus" removes it. */
export async function saveResource(_previous: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const denied = await requireUser(supabase);
  if (denied) return { error: denied };

  const kind = text(data, "kind");
  if (kind !== "fasilitas" && kind !== "tenaga-medis") return { error: "Jenis data tidak dikenal." };
  const { table, key, count, roundTheClock } = RESOURCE[kind];
  const hospitalId = text(data, "hospital_id");
  const itemId = text(data, "item_id");
  if (!itemId) return { error: kind === "fasilitas" ? "Pilih fasilitasnya." : "Pilih spesialisasinya." };

  if (text(data, "intent") === "hapus") {
    const { error } = await supabase.from(table).delete().eq("hospital_id", hospitalId).eq(key, itemId);
    if (error) return { error: saveError(error) };
    return saved();
  }

  const qty = whole(data, "count");
  if (qty === undefined) return { error: "Jumlah harus bilangan bulat." };
  const { error } = await supabase
    .from(table)
    .upsert({ hospital_id: hospitalId, [key]: itemId, [count]: qty, [roundTheClock]: yesNo(data, "round_the_clock") }, { onConflict: `hospital_id,${key}` });
  if (error) return { error: saveError(error) };
  return saved();
}

/**
 * A tariff row typed in: added to the hospital's published document, or to a document of its own
 * when it has none yet. The row is flagged as typed in, so the table can say so.
 */
export async function addTariffRow(_previous: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const denied = await requireUser(supabase);
  if (denied) return { error: denied };

  const hospitalId = text(data, "hospital_id");
  const name = text(data, "name");
  if (!name) return { error: "Nama tindakan atau layanan harus diisi." };
  const category = text(data, "category");
  if (!CATEGORIES.some((c) => c.id === category)) return { error: "Jenis layanan tidak dikenal." };
  const amount = Number(text(data, "amount").replace(/[^\d]/g, ""));
  if (!Number.isInteger(amount) || amount <= 0) return { error: "Tarif harus berupa angka dalam rupiah." };
  const kelas = text(data, "kelas") || "Tarif";

  const { data: current, error: bookError } = await supabase
    .from("tariff_books")
    .select("id, category_counts")
    .eq("hospital_id", hospitalId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; category_counts: Record<string, number> }>();
  if (bookError) return { error: saveError(bookError) };

  let book = current;
  if (!book) {
    const { data: created, error } = await supabase
      .from("tariff_books")
      .insert({
        hospital_id: hospitalId,
        version: "1",
        source_file: "Entri manual",
        storage_path: `manual/${hospitalId}`,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select("id, category_counts")
      .single<{ id: string; category_counts: Record<string, number> }>();
    if (error) return { error: saveError(error) };
    book = created;
  }

  const { data: last } = await supabase.from("tariff_rows").select("position").eq("book_id", book.id).order("position", { ascending: false }).limit(1).maybeSingle<{ position: number }>();
  const { data: row, error: rowError } = await supabase
    .from("tariff_rows")
    .insert({
      book_id: book.id,
      position: (last?.position ?? 0) + 1,
      page: 0,
      raw_name: name,
      unit: text(data, "unit") || null,
      flags: [MANUAL_FLAG],
      category,
      checked: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (rowError) return { error: saveError(rowError) };

  const { error: priceError } = await supabase.from("tariff_prices").insert({ row_id: row.id, kelas, raw_price: String(amount), amount });
  if (priceError) return { error: saveError(priceError) };

  const counts = { ...book.category_counts, [category]: (book.category_counts[category] ?? 0) + 1 };
  const { error: countError } = await supabase.from("tariff_books").update({ category_counts: counts }).eq("id", book.id);
  if (countError) return { error: saveError(countError) };
  return saved();
}
