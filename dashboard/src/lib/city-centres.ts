import type { Point } from "./origin";

type Centre = Point & { name: string };

// The middle of each kota, and of the towns farther afield the documents name. A kabupaten named like a
// kota is centred on its own seat when that is somewhere else (KABUPATEN_SEATS): Kabupaten Malang's
// hospitals are around Kepanjen, not in Kota Malang.
const CITY_CENTRES: Centre[] = [
  { name: "surabaya", lat: -7.2575, lng: 112.7521 },
  { name: "madiun", lat: -7.6298, lng: 111.5239 },
  { name: "tulungagung", lat: -8.0657, lng: 111.9025 },
  { name: "malang", lat: -7.9666, lng: 112.6326 },
  { name: "batu", lat: -7.8672, lng: 112.5239 },
  { name: "kediri", lat: -7.848, lng: 112.0178 },
  { name: "blitar", lat: -8.0955, lng: 112.1609 },
  { name: "mojokerto", lat: -7.4722, lng: 112.4338 },
  { name: "pasuruan", lat: -7.6453, lng: 112.9075 },
  { name: "probolinggo", lat: -7.7543, lng: 113.2159 },
  { name: "sidoarjo", lat: -7.4478, lng: 112.7183 },
  { name: "gresik", lat: -7.1566, lng: 112.6555 },
  { name: "lamongan", lat: -7.1167, lng: 112.4167 },
  { name: "tuban", lat: -6.8976, lng: 112.0649 },
  { name: "bojonegoro", lat: -7.1502, lng: 111.8817 },
  { name: "ngawi", lat: -7.404, lng: 111.4464 },
  { name: "magetan", lat: -7.6493, lng: 111.3381 },
  { name: "ponorogo", lat: -7.8651, lng: 111.4696 },
  { name: "pacitan", lat: -8.205, lng: 111.093 },
  { name: "trenggalek", lat: -8.05, lng: 111.7167 },
  { name: "nganjuk", lat: -7.6051, lng: 111.9035 },
  { name: "jombang", lat: -7.546, lng: 112.233 },
  { name: "lumajang", lat: -8.1335, lng: 113.2248 },
  { name: "jember", lat: -8.1724, lng: 113.7 },
  { name: "bondowoso", lat: -7.9135, lng: 113.8215 },
  { name: "situbondo", lat: -7.7064, lng: 114.0094 },
  { name: "banyuwangi", lat: -8.2191, lng: 114.3691 },
  { name: "bangkalan", lat: -7.0455, lng: 112.7351 },
  { name: "sampang", lat: -7.1873, lng: 113.2399 },
  { name: "pamekasan", lat: -7.1568, lng: 113.4746 },
  { name: "sumenep", lat: -7.0167, lng: 113.8667 },
  { name: "jakarta", lat: -6.2088, lng: 106.8456 },
  { name: "bandung", lat: -6.9175, lng: 107.6191 },
  { name: "semarang", lat: -6.9667, lng: 110.4167 },
  { name: "yogyakarta", lat: -7.7956, lng: 110.3695 },
  { name: "surakarta", lat: -7.5755, lng: 110.8243 },
  { name: "solo", lat: -7.5755, lng: 110.8243 },
  { name: "denpasar", lat: -8.6705, lng: 115.2126 },
];

const KABUPATEN_SEATS: Record<string, Point> = {
  malang: { lat: -8.13, lng: 112.572 }, // Kepanjen
  kediri: { lat: -7.8212, lng: 112.058 }, // Ngasem
  blitar: { lat: -8.1363, lng: 112.2183 }, // Kanigoro
  pasuruan: { lat: -7.5995, lng: 112.818 }, // Bangil
  probolinggo: { lat: -7.7583, lng: 113.4103 }, // Kraksaan
  mojokerto: { lat: -7.5194, lng: 112.5578 }, // Mojosari
  madiun: { lat: -7.544, lng: 111.656 }, // Caruban
};

const SURABAYA = CITY_CENTRES[0];

const KABUPATEN = /^(kabupaten|kab\.?)\s+/;

/** "Kab. Banyuwangi", "Kota Malang" → "banyuwangi", "malang". */
export const bareCity = (city: string) => city.trim().toLowerCase().replace(KABUPATEN, "").replace(/^kota\s+/, "");

// Longest first, so "batu" doesn't win over a longer name that contains it.
const BY_LENGTH = [...CITY_CENTRES].sort((a, b) => b.name.length - a.name.length);

/**
 * Where to put a hospital nothing better is known about: its kota or kabupaten (by its city, else a city
 * in its name), else Surabaya, where most of the documents are from.
 */
export function cityCentreOf(city: string, name: string): Point {
  const bare = bareCity(city);
  const isKabupaten = KABUPATEN.test(city.trim().toLowerCase());
  const named = name.toLowerCase();
  const centre =
    CITY_CENTRES.find((c) => c.name === bare) ??
    BY_LENGTH.find((c) => bare.includes(c.name)) ??
    BY_LENGTH.find((c) => named.includes(c.name)) ??
    SURABAYA;
  const seat = isKabupaten ? KABUPATEN_SEATS[centre.name] : undefined;
  return seat ?? { lat: centre.lat, lng: centre.lng };
}
