import type { AccidentStep } from "./accident-cases";
import { CARE_CATEGORIES } from "./categories";
import type { Dataset, Hospital, TariffLine, Tier, Tipe, TreatmentLine } from "./data/types";
import { formatKm, haversineKm, type Origin } from "./origin";

/** How the general score weighs each part. */
export const WEIGHTS = {
  clinical: 0.3,
  facility: 0.25,
  services: 0.25,
  access: 0.2,
} as const;

export type Scores = {
  /** Specialists recognised in its document, against all the system knows. */
  clinical: number;
  /** Facilities recognised in its document, against all the system knows. */
  facility: number;
  /** Kinds of care its document has tariffs for. */
  services: number;
  /** Emergency room and ambulance in its document. */
  access: number;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** `lokasi` in the URL for "Semua lokasi": no city chosen, so every hospital is ranked. */
export const ALL_LOCATIONS_PARAM = "semua";

/** Every city a hospital's document names, to start a referral from. */
export const citiesOf = (hospitals: Hospital[]): string[] =>
  [...new Set(hospitals.flatMap((h) => (h.city ? [h.city] : [])))].sort((a, b) => a.localeCompare(b));

/** In the chosen city; any hospital when none is chosen. */
const isIn = (hospital: Hospital, city: string) => !city || hospital.city === city;

/** Share of the items its document shows, 0–100. Documents don't print how many or their hours, so presence is all that counts. */
const coverage = (ids: string[], present: (id: string) => boolean) =>
  ids.length === 0 ? 0 : (ids.filter(present).length / ids.length) * 100;

const hasFacility = (hospital: Hospital, id: string) => hospital.facilities.some((f) => f.facilityId === id);

// How quickly a victim gets into care once there: an emergency room and an ambulance.
const serviceAccess = (hospital: Hospital) => (hasFacility(hospital, "igd") ? 50 : 0) + (hasFacility(hospital, "ambulans") ? 50 : 0);

/** Road distance from the accident, as the crow flies; null without an origin or when the hospital's pin isn't found. */
const distanceFrom = (origin: Origin | null, hospital: Hospital) => (origin && hospital.location ? haversineKm(origin, hospital.location) : null);

// How near a hospital is to the accident, 0–100: anything within 10 km counts in full, 150 km and beyond nothing.
// A hospital whose pin isn't found counts as far, so it can't outrank one known to be near.
const nearness = (km: number | null) => (km === null ? 0 : clamp(100 * (1 - Math.max(0, km - 10) / 140)));

/** Within this, the distance is worth pointing out. */
const NEAR_KM = 15;

export type Placing<Band extends string = Tier> = { tier: Band; /** 1 for the best; equal scores share a place. */ rank: number; of: number };

const THIRDS: Tier[] = ["A", "B", "C"];
const QUARTERS: Tipe[] = ["A", "B", "C", "D"];

/**
 * Bands are relative: the items are ranked against each other on their score and split evenly into
 * the bands, best first (thirds: top third A, middle B, bottom C). Equal scores (to the point) share a place.
 */
const placings = <T, Band extends string>(items: T[], score: (item: T) => number, bands: Band[]): Map<T, Placing<Band>> => {
  const sorted = [...items].sort((a, b) => score(b) - score(a));
  const rounded = sorted.map((item) => Math.round(score(item)));
  return new Map(
    sorted.map((item, index) => {
      const place = rounded.indexOf(rounded[index]);
      const band = bands[Math.floor((place / sorted.length) * bands.length)];
      return [item, { tier: band, rank: place + 1, of: sorted.length }];
    }),
  );
};

export const generalScores = (hospital: Hospital, data: Dataset): Scores => ({
  clinical: coverage(
    data.catalog.specialties.map((s) => s.id),
    (id) => hospital.staff.some((s) => s.specialtyId === id),
  ),
  facility: coverage(
    data.catalog.facilities.map((f) => f.id),
    (id) => hasFacility(hospital, id),
  ),
  services: (CARE_CATEGORIES.filter((c) => (hospital.tariffBook?.categories[c] ?? 0) > 0).length / CARE_CATEGORIES.length) * 100,
  access: serviceAccess(hospital),
});

export const compositeOf = (scores: Scores) =>
  scores.clinical * WEIGHTS.clinical + scores.facility * WEIGHTS.facility + scores.services * WEIGHTS.services + scores.access * WEIGHTS.access;

/** One parameter of the Layanan score: its weight, the hospital's score on it (0–100), and what that counts. */
export type ScoreParameter = { key: keyof Scores; label: string; weight: number; score: number; detail: string };

export const PARAMETER_LABEL: Record<keyof Scores, string> = {
  clinical: "Klinis",
  facility: "Fasilitas",
  services: "Jenis layanan",
  access: "Akses darurat",
};

const accessDetail = (hospital: Hospital) => {
  const igd = hasFacility(hospital, "igd");
  const ambulans = hasFacility(hospital, "ambulans");
  if (igd && ambulans) return "IGD dan ambulans";
  if (igd) return "IGD, tanpa ambulans";
  if (ambulans) return "Ambulans, tanpa IGD";
  return "Tanpa IGD dan ambulans";
};

/** The Layanan score parameter by parameter, heaviest first, each with what its document shows. */
export const scoreParameters = (hospital: Hospital, data: Dataset, scores = generalScores(hospital, data)): ScoreParameter[] => {
  const specialists = data.catalog.specialties.filter((s) => hospital.staff.some((x) => x.specialtyId === s.id)).length;
  const facilities = data.catalog.facilities.filter((f) => hasFacility(hospital, f.id)).length;
  const services = CARE_CATEGORIES.filter((c) => (hospital.tariffBook?.categories[c] ?? 0) > 0).length;
  const parameter = (key: keyof Scores, detail: string): ScoreParameter => ({
    key,
    label: PARAMETER_LABEL[key],
    weight: WEIGHTS[key],
    score: scores[key],
    detail,
  });
  return [
    parameter("clinical", `${specialists} dari ${data.catalog.specialties.length} spesialis`),
    parameter("facility", `${facilities} dari ${data.catalog.facilities.length} fasilitas`),
    parameter("services", `${services} dari ${CARE_CATEGORIES.length} jenis layanan`),
    parameter("access", accessDetail(hospital)),
  ];
};

export type PriceLevel = "murah" | "wajar" | "mahal";
export type ServiceLevel = "lengkap" | "cukup" | "terbatas";

/** A rating in words, with the one line that explains it. */
export type Rating<Level> = { level: Level; reason: string };

const PRICE_BY_TIER: Record<Tier, PriceLevel> = { A: "murah", B: "wajar", C: "mahal" };
const SERVICE_BY_TIER: Record<Tier, ServiceLevel> = { A: "lengkap", B: "cukup", C: "terbatas" };

/** 1 for the best place, 0 for the last; 1 when there is nothing to compare with. */
const percentile = ({ rank, of }: Placing<string>) => (of === 1 ? 1 : 1 - (rank - 1) / (of - 1));

const priceReason = ({ ratio, compared }: { ratio: number; compared: number }) => {
  const share = Math.round(Math.abs(1 - ratio) * 100);
  const position = share === 0 ? "Setara RS lain" : `${share}% ${ratio < 1 ? "di bawah" : "di atas"} RS lain`;
  return `${position}, dari ${compared} layanan yang sama`;
};

const serviceReason = (hospital: Hospital) => {
  const covered = CARE_CATEGORIES.filter((c) => (hospital.tariffBook?.categories[c] ?? 0) > 0).length;
  const igd = hospital.facilities.some((f) => f.facilityId === "igd");
  return [`${covered} dari ${CARE_CATEGORIES.length} jenis layanan`, igd && "IGD"].filter(Boolean).join(" · ");
};

export type HospitalSummary = {
  hospital: Hospital;
  /** The parts of the Layanan rating. */
  scores: Scores;
  /** The same parts, each with its weight and what its document shows; `scores` weighted is `servicesScore`. */
  parameters: ScoreParameter[];
  /** Its Layanan score, 0–100, before it is banded. */
  servicesScore: number;
  /** Prices against the other hospitals'; null until another hospital's document shares rows with its. */
  price: Rating<PriceLevel> | null;
  /** Null without a tariff document: what a hospital offers is only known from what its document prices. */
  services: Rating<ServiceLevel> | null;
  /** Harga and Layanan together, 0–100 by place among the hospitals: what the rank and tipe come from. */
  composite: number;
  /** Its quarter among every hospital with a published document; null until this one has one. */
  tipe: Tipe | null;
  placing: Placing<Tipe> | null;
};

/**
 * Every hospital rated against the others, like Bluebook's price and quality lights: Harga by its
 * prices on rows other hospitals' documents name the same way, Layanan by what its document shows it
 * offers. Each is split into thirds; the rank weighs the two equally (Layanan alone until prices can
 * be compared) and is split into quarters, Tipe A to D.
 */
export const allSummaries = (data: Dataset): HospitalSummary[] => {
  const published = data.hospitals.filter((h) => h.tariffBook);
  const scores = new Map(data.hospitals.map((h) => [h, generalScores(h, data)]));
  const pricePlaces = placings(
    published.filter((h) => h.priceIndex),
    (h) => 100 / (h.priceIndex?.ratio ?? 1),
    THIRDS,
  );
  const servicePlaces = placings(published, (h) => compositeOf(scores.get(h) ?? generalScores(h, data)), THIRDS);

  const rated = data.hospitals.map((hospital) => {
    const pricePlace = pricePlaces.get(hospital);
    const servicePlace = servicePlaces.get(hospital);
    const parts = [pricePlace, servicePlace].filter((p): p is Placing => p !== undefined).map(percentile);
    const own = scores.get(hospital) ?? generalScores(hospital, data);
    return {
      hospital,
      scores: own,
      parameters: scoreParameters(hospital, data, own),
      servicesScore: compositeOf(own),
      price: pricePlace && hospital.priceIndex ? { level: PRICE_BY_TIER[pricePlace.tier], reason: priceReason(hospital.priceIndex) } : null,
      services: servicePlace ? { level: SERVICE_BY_TIER[servicePlace.tier], reason: serviceReason(hospital) } : null,
      composite: parts.length ? (parts.reduce((sum, p) => sum + p, 0) / parts.length) * 100 : 0,
    };
  });
  const overall = placings(
    rated.filter((r) => r.hospital.tariffBook),
    (r) => r.composite,
    QUARTERS,
  );
  return rated.map((r) => {
    const placing = overall.get(r) ?? null;
    return { ...r, tipe: placing?.tier ?? null, placing };
  });
};

export const summarize = (hospital: Hospital, data: Dataset): HospitalSummary => {
  const summary = allSummaries(data).find((s) => s.hospital.id === hospital.id);
  if (!summary) throw new Error(`Hospital ${hospital.id} is not in the dataset`);
  return summary;
};

// ------------------------------------------------------------------ searching for a treatment

/** A hospital that has what was searched for: its closest row, and how it compares. */
export type TreatmentMatch = {
  summary: HospitalSummary;
  /** The row that names the treatment most plainly; the others are counted. */
  line: SearchedLine & { priceMin: number; priceMax: number };
  otherRows: number;
  priceMid: number;
  medianPrice: number;
  /** Positive when cheaper than the median, as a share of it. */
  savingVsMedian: number;
  composite: number;
  /** From the accident; null without an origin or a pin for the hospital. */
  distanceKm: number | null;
  /** Against the other hospitals that have it. */
  tier: Tier;
  placing: Placing;
  strengths: string[];
  notes: string[];
};

// Price against the median: ratio 0.7 → 100, 1.0 → 62.5, 1.5 → 0.
const costScore = (priceRatio: number) => clamp(((1.5 - priceRatio) / 0.8) * 100);

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** A row found for a treatment; `treatmentName` when it was picked as a tindakan rather than searched by its words. */
type SearchedLine = TariffLine & { bookId: string; treatmentName?: string };

type PricedLine = SearchedLine & { priceMin: number; priceMax: number };

const isPriced = (line: SearchedLine): line is PricedLine => line.priceMin !== null && line.priceMax !== null;

/** What a row calls the treatment: the tindakan it prices, or else its own name. */
export const treatmentNameOf = (line: SearchedLine) => line.treatmentName ?? line.rawName;

const midOf = (line: { priceMin: number; priceMax: number }) => (line.priceMin + line.priceMax) / 2;

/**
 * Ranks the hospitals in a city whose current document has rows found for a search: their general
 * score, and the price of their plainest matching row against every hospital's median. With an
 * origin, how near they are to the accident weighs most of all, more than the price.
 */
export const rankForTreatment = (lines: SearchedLine[], city: string, data: Dataset, origin: Origin | null = null): TreatmentMatch[] => {
  const priced = lines.filter(isPriced);
  const found = data.hospitals.flatMap((hospital) => {
    const own = priced
      .filter((l) => l.bookId === hospital.tariffBook?.id)
      .sort((a, b) => wordCount(treatmentNameOf(a)) - wordCount(treatmentNameOf(b)) || a.priceMin - b.priceMin);
    return own.length ? [{ hospital, line: own[0], otherRows: own.length - 1 }] : [];
  });
  if (found.length === 0) return [];
  const medianPrice = median(found.map((f) => midOf(f.line)));
  const summaries = allSummaries(data);

  const matches = found.filter((f) => isIn(f.hospital, city)).map(({ hospital, line, otherRows }) => {
      const summary = summaries.find((s) => s.hospital.id === hospital.id) ?? summarize(hospital, data);
      const priceMid = midOf(line);
      const savingVsMedian = (medianPrice - priceMid) / medianPrice;
      const distanceKm = distanceFrom(origin, hospital);
      const composite = origin
        ? 0.3 * summary.composite + 0.25 * costScore(priceMid / medianPrice) + 0.1 * serviceAccess(hospital) + 0.35 * nearness(distanceKm)
        : 0.4 * summary.composite + 0.35 * costScore(priceMid / medianPrice) + 0.1 * serviceAccess(hospital);

      const strengths: string[] = [];
      const notes: string[] = [];
      if (distanceKm !== null && distanceKm <= NEAR_KM) strengths.push(`${formatKm(distanceKm)} dari lokasi kejadian`);
      if (savingVsMedian >= 0.1) strengths.push(`Tarif ${Math.round(savingVsMedian * 100)}% di bawah median`);
      if (hospital.facilities.some((f) => f.facilityId === "igd" && f.available24h)) strengths.push("IGD 24 jam");
      if (savingVsMedian <= -0.15) notes.push(`Tarif ${Math.round(-savingVsMedian * 100)}% di atas median`);
      if (origin && distanceKm === null) notes.push("Lokasi rumah sakit belum ditemukan");

      return { summary, line, otherRows, priceMid, medianPrice, savingVsMedian, composite, distanceKm, strengths, notes };
    });
  const placed = placings(matches, (m) => m.composite, THIRDS);
  return matches
    .flatMap((m): TreatmentMatch[] => {
      const placing = placed.get(m);
      return placing ? [{ ...m, tier: placing.tier, placing }] : [];
    })
    .sort((a, b) => a.placing.rank - b.placing.rank || b.composite - a.composite);
};

/**
 * One treatment's price against its harga wajar (the median across hospitals), in Bluebook's bands:
 * at or under it is murah, up to 20% over is wajar, more is mahal.
 */
export const fairPriceLevel = (savingVsMedian: number): PriceLevel =>
  savingVsMedian >= 0 ? "murah" : savingVsMedian >= -0.2 ? "wajar" : "mahal";

// ------------------------------------------------------------------ recommending for an accident case

/** One tindakan of an accident case as a hospital's document prices it, its rows taken together. */
export type CaseTreatment = {
  key: string;
  /** As its document prints it, the plainest of its rows. */
  name: string;
  /** Null when none of its rows is a plain number. */
  priceMin: number | null;
  priceMax: number | null;
};

/** What a hospital's document prices of one step of an accident case. */
export type CaseStepCover = { label: string; treatments: CaseTreatment[] };

/** A hospital whose document prices some of what an accident case needs, and how it compares. */
export type CaseMatch = {
  summary: HospitalSummary;
  /** Every step any hospital's document has tindakan for, in the case's order. */
  steps: CaseStepCover[];
  /** Steps it has at least one tindakan for. */
  covered: number;
  composite: number;
  /** From the accident; null without an origin or a pin for the hospital. */
  distanceKm: number | null;
  /** Against the other hospitals that have something for the case. */
  tier: Tier;
  placing: Placing;
};

const minOrNull = (values: number[]) => (values.length ? Math.min(...values) : null);
const maxOrNull = (values: number[]) => (values.length ? Math.max(...values) : null);

const caseTreatmentOf = (key: string, rows: TreatmentLine[]): CaseTreatment => {
  const plainest = [...rows].sort((a, b) => wordCount(a.treatmentName) - wordCount(b.treatmentName))[0];
  return {
    key,
    name: plainest?.treatmentName ?? key,
    priceMin: minOrNull(rows.flatMap((l) => (l.priceMin === null ? [] : [l.priceMin]))),
    priceMax: maxOrNull(rows.flatMap((l) => (l.priceMax === null ? [] : [l.priceMax]))),
  };
};

/**
 * Ranks the hospitals in a city for a whole accident case: how many of its steps their current
 * document has tindakan for (the most), then their general score. Steps no document there has
 * anything for are left out; hospitals with nothing for the case are too. With an origin, how near
 * they are to the accident weighs as much as what they cover.
 */
export const rankForCase = (lines: TreatmentLine[], caseSteps: AccidentStep[], city: string, data: Dataset, origin: Origin | null = null): CaseMatch[] => {
  const hospitals = data.hospitals.filter((h) => isIn(h, city));
  const bookIds = new Set(hospitals.flatMap((h) => (h.tariffBook ? [h.tariffBook.id] : [])));
  const local = lines.filter((l) => bookIds.has(l.bookId));
  const steps = caseSteps.filter((step) => local.some((l) => step.keys.includes(l.key)));
  if (steps.length === 0) return [];
  const summaries = allSummaries(data);

  const found = hospitals.flatMap((hospital) => {
    const own = local.filter((l) => l.bookId === hospital.tariffBook?.id);
    if (own.length === 0) return [];
    const covers = steps.map(
      (step): CaseStepCover => ({
        label: step.label,
        treatments: step.keys.flatMap((key) => {
          const rows = own.filter((l) => l.key === key);
          return rows.length ? [caseTreatmentOf(key, rows)] : [];
        }),
      }),
    );
    return [{ hospital, covers, keys: new Set(own.map((l) => l.key)).size }];
  });
  if (found.length === 0) return [];
  const mostKeys = Math.max(...found.map((f) => f.keys));

  const matches = found.map(({ hospital, covers, keys }) => {
    const summary = summaries.find((s) => s.hospital.id === hospital.id) ?? summarize(hospital, data);
    const covered = covers.filter((c) => c.treatments.length > 0).length;
    // Steps count most: a hospital that can do the operation beats one with many small tindakan.
    const coverage = 70 * (covered / steps.length) + 30 * (keys / mostKeys);
    const distanceKm = distanceFrom(origin, hospital);
    const composite = origin
      ? 0.35 * coverage + 0.25 * summary.composite + 0.05 * serviceAccess(hospital) + 0.35 * nearness(distanceKm)
      : 0.45 * coverage + 0.35 * summary.composite + 0.08 * serviceAccess(hospital);
    return { summary, steps: covers, covered, composite, distanceKm };
  });
  const placed = placings(matches, (m) => m.composite, THIRDS);
  return matches
    .flatMap((m): CaseMatch[] => {
      const placing = placed.get(m);
      return placing ? [{ ...m, tier: placing.tier, placing }] : [];
    })
    .sort((a, b) => a.placing.rank - b.placing.rank || b.composite - a.composite);
};
