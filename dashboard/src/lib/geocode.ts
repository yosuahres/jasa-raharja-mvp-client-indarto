import "server-only";

import type { LocationSource } from "@/lib/data/types";
import type { createClient } from "@/lib/supabase/server";

import { bareCity, cityCentreOf } from "./city-centres";
import { haversineKm, type Origin, type Point } from "./origin";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// The lookup never touches a pin checked on OpenStreetMap or placed by hand.
const FIXED: ReadonlySet<string> = new Set<LocationSource>(["osm", "manual"]);

type Place = {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  geocoded_query: string | null;
  lat: number | null;
  lng: number | null;
  location_source: LocationSource | null;
};

type Pin = Point & { source: LocationSource };

// OpenStreetMap's public geocoder. Its usage policy asks for an identifying User-Agent and at most one request a second.
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const REVERSE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "jasa-raharja-dashboard (rujukan rumah sakit)";
const SPACING_MS = 1100;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Every lookup on this server waits its turn, so one hospital's several tries keep to the rate too.
let nextRequestAt = 0;
const takeTurn = async () => {
  const now = Date.now();
  const at = Math.max(now, nextRequestAt);
  nextRequestAt = at + SPACING_MS;
  if (at > now) await wait(at - now);
};

/** The most specific way to ask for a hospital first, then just its name in its city. */
const queriesFor = (place: Place) =>
  [...new Set([
    [place.name, place.address, place.city, place.province],
    [place.name, place.city],
  ].map((parts) => parts.filter(Boolean).join(", ")))];

/** Coordinates for a query, null when nothing matches. Throws when the geocoder can't be reached, so the hospital is tried again later. */
async function lookup(query: string, params: Record<string, string> = {}): Promise<Point | null> {
  await takeTurn();
  const url = `${ENDPOINT}?${new URLSearchParams({ q: query, format: "jsonv2", countrycodes: "id", limit: "1", ...params })}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Geocoder answered ${response.status}`);
  const [hit] = (await response.json()) as { lat: string; lon: string }[];
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
}

// Words in hospital names that aren't places: "RSUD Genteng" is in Genteng, "RS Islam Siti Hajar" says nothing.
const NOT_A_PLACE = new Set(
  (
    "rs rsu rsud rsi rsia rsk rskb rsb rst rumah sakit umum daerah pusat islam muhammadiyah aisyiyah nahdlatul ulama nu " +
    "kristen katolik baptis santa bedah ibu anak jiwa paru khusus dr drs prof haji hj medika medical medica husada " +
    "hospital healthcare health care sehat mitra keluarga klinik utama rawat inap pratama kota kabupaten kab provinsi " +
    "jawa timur tni ad au al polri bhayangkara dkt lanud ptpn ptp pt pku unit centre center internasional international " +
    "premiere universitas univ siti graha citra bina bakti bhakti prima permata hati intan tk iii iv ii dh d h"
  ).split(" "),
);

/** "RSUD Genteng" (Kab. Banyuwangi) → ["Genteng"]; the last two place-like words of the name, then the last one. */
const localitiesIn = (place: Place) => {
  const cityWords = new Set(bareCity(place.city).split(/\s+/));
  const words = place.name
    .split(/[^\p{L}]+/u)
    .filter((w) => w.length > 2 && !NOT_A_PLACE.has(w.toLowerCase()) && !cityWords.has(w.toLowerCase()));
  const last = words.slice(-2);
  const titled = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  return [...new Set([last.map(titled).join(" "), titled(last.at(-1) ?? "")])].filter(Boolean);
};

// A town the name points at must be in the hospital's own kota or kabupaten, roughly; farther off it's another place of the same name.
const NEARBY_KM = 60;

/** A small fixed nudge from the id, so hospitals put on the same town don't sit on one another. */
const nudge = (id: string, point: Point, spread: number): Point => {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const unit = (bits: number) => ((bits & 0xffff) / 0xffff) * 2 - 1;
  return { lat: point.lat + unit(hash) * spread, lng: point.lng + unit(hash >>> 16) * spread };
};

/** An approximate pin, for a hospital the geocoder can't find: the town its name names, else its kota or kabupaten. */
async function approximatePin(place: Place): Promise<Pin> {
  const centre = cityCentreOf(place.city, place.name);
  const area = bareCity(place.city) || place.province;
  for (const locality of localitiesIn(place)) {
    const town = await lookup([locality, area].filter(Boolean).join(", "), { featureType: "settlement" });
    if (town && haversineKm(town, centre) <= NEARBY_KM) return { ...nudge(place.id, town, 0.005), source: "dummy" };
  }
  return { ...nudge(place.id, centre, 0.02), source: "dummy" };
}

/**
 * Looks a hospital up unless its pin is fixed (checked on OpenStreetMap or placed by hand) or its name
 * and address are the ones already looked up. A found hospital gets its pin; one not found keeps a pin
 * the lookup found before, else gets an approximate one. A pin is never cleared. Returns whether it looked.
 */
async function geocode(supabase: Supabase, place: Place): Promise<boolean> {
  if (place.location_source && FIXED.has(place.location_source)) return false;
  const queries = queriesFor(place);
  if (place.geocoded_query === queries[0] && place.lat !== null) return false;

  let found: Point | null = null;
  for (const query of queries) {
    found = await lookup(query);
    if (found) break;
  }
  const kept: Pin | null =
    place.location_source === "geocoder" && place.lat !== null && place.lng !== null ? { lat: place.lat, lng: place.lng, source: "geocoder" } : null;
  const pin: Pin = found ? { ...found, source: "geocoder" } : (kept ?? (await approximatePin(place)));

  await supabase
    .from("hospitals")
    .update({ lat: pin.lat, lng: pin.lng, location_source: pin.source, geocoded_query: queries[0], geocoded_at: new Date().toISOString() })
    .eq("id", place.id);
  return true;
}

const PLACE_SELECT = "id, name, address, city, province, geocoded_query, lat, lng, location_source";

/** Pins one hospital, e.g. right after its document is saved. */
export async function geocodeHospital(supabase: Supabase, hospitalId: string) {
  const { data } = await supabase.from("hospitals").select(PLACE_SELECT).eq("id", hospitalId).maybeSingle<Place>();
  if (!data) return;
  try {
    await geocode(supabase, data);
  } catch (error) {
    console.error(`Geocoding ${hospitalId} failed:`, error);
  }
}

// One backfill at a time per server, so several open maps don't double the request rate.
let backfilling = false;

/** Pins a few hospitals that have no pin yet, or whose name or address changed since they were looked up. */
export async function geocodeMissing(supabase: Supabase, limit = 5) {
  if (backfilling) return;
  backfilling = true;
  try {
    // Without the columns (migrations/008 and 013) this errors and there is nothing to do yet.
    const { data, error } = await supabase.from("hospitals").select(PLACE_SELECT).returns<Place[]>();
    if (error) return;
    const pending = data
      .filter((place) => !(place.location_source && FIXED.has(place.location_source)))
      .filter((place) => place.lat === null || place.geocoded_query !== queriesFor(place)[0])
      .slice(0, limit);
    for (const place of pending) await geocode(supabase, place);
  } catch (error) {
    console.error("Geocoding backlog failed:", error);
  } finally {
    backfilling = false;
  }
}

type NominatimHit = { display_name: string; lat: string; lon: string };

// Nominatim names a place down to the country and postcode; the first parts say enough.
const shortLabel = (displayName: string) =>
  displayName
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && part !== "Indonesia" && !/^\d{5}$/.test(part))
    .slice(0, 4)
    .join(", ");

const toPlace = (hit: NominatimHit): Origin => ({ label: shortLabel(hit.display_name), lat: Number(hit.lat), lng: Number(hit.lon) });

/** Places in Indonesia matching an address or name typed in, best first. */
export async function searchPlaces(query: string): Promise<Origin[]> {
  await takeTurn();
  const url = `${ENDPOINT}?${new URLSearchParams({ q: query, format: "jsonv2", countrycodes: "id", limit: "5" })}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Geocoder answered ${response.status}`);
  return ((await response.json()) as NominatimHit[]).map(toPlace);
}

/** The place at a point, e.g. one clicked on the map; null when the geocoder has no name for it. */
export async function reversePlace(lat: number, lng: number): Promise<Origin | null> {
  await takeTurn();
  const url = `${REVERSE_ENDPOINT}?${new URLSearchParams({ lat: String(lat), lon: String(lng), format: "jsonv2", zoom: "16" })}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Geocoder answered ${response.status}`);
  const hit = (await response.json()) as NominatimHit & { error?: string };
  return hit.error || !hit.display_name ? null : { ...toPlace(hit), lat, lng };
}
