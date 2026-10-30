import type { CategoryId } from "@/lib/categories";

export type Tier = "A" | "B" | "C";

/** A hospital's place in the overall ranking (price and what its document shows it offers), by quarters. */
export type Tipe = "A" | "B" | "C" | "D";

export type Facility = {
  id: string;
  name: string;
  category: "gawat-darurat" | "operasi" | "rawat" | "radiologi" | "penunjang" | "transport";
  /** Other ways tariff documents write it, for detecting it in their rows. */
  keywords: string[];
};

export type Specialty = {
  id: string;
  name: string;
  keywords: string[];
};

/** One price cell of a tariff row, as printed. */
export type TariffPrice = {
  /** Column label, e.g. "TARIF BARU / EKSEKUTIF". */
  kelas: string;
  rawPrice: string;
  /** Rupiah; null when the cell isn't a plain number. */
  amount: number | null;
  /** An old price ("TARIF LAMA") printed beside the new one. */
  superseded: boolean;
};

/** A row as the extractor read it from the tariff document. */
export type TariffLine = {
  id: string;
  position: number;
  page: number;
  section: string | null;
  parents: string[];
  itemNo: string | null;
  rawName: string;
  unit: string | null;
  /** Unpriced lines listed under this row, sharing its price. */
  members: string[];
  /** Things the extractor could not read with certainty; see FLAG_LABEL. */
  flags: string[];
  category: CategoryId;
  prices: TariffPrice[];
  /** Lowest and highest current price on the row; null when none is a plain number. */
  priceMin: number | null;
  priceMax: number | null;
};

/**
 * A tindakan the hospitals' documents price, matched across them however each prints it
 * ("Pasang Catheter", "PEMASANGAN KATETER"). `key` identifies it; `name` is its plainest printed name.
 */
export type Treatment = { key: string; name: string; hospitals: number };

/** A tindakan with the lowest and highest price the current documents give it; null when none is a plain number. */
export type PricedTreatment = Treatment & { priceMin: number | null; priceMax: number | null };

/** A row that prices a tindakan, with the document it is in, the tindakan's key and its name as that row prints it. */
export type TreatmentLine = TariffLine & { bookId: string; key: string; treatmentName: string };

/** A facility its document shows tariffs for. How many and whether round the clock: null, documents don't print them. */
export type HospitalFacility = {
  facilityId: string;
  qty: number | null;
  available24h: boolean | null;
};

/** A specialist its document shows tariffs for. How many and whether on call: null, documents don't print them. */
export type HospitalStaff = {
  specialtyId: string;
  headcount: number | null;
  onCall24h: boolean | null;
};

export type BookStatus = "queued" | "extracting" | "review" | "published" | "failed";

/** A catalog facility or specialty the extractor found in a document, with the first text it matched. */
export type Detection = { id: string; rows: number; page: number; evidence: string };

/** How many rows a document has in each category. */
export type CategoryCounts = Partial<Record<CategoryId, number>>;

/** A published tariff document. */
export type TariffBook = {
  id: string;
  version: string;
  /** Null when the document doesn't print its year. */
  validFrom: string | null;
  validTo: string | null;
  source: string;
  categories: CategoryCounts;
  rows: number;
};

/** One row of Jasa Raharja's list of partner hospitals: the hospital and the office (loket) that handles its claims. */
export type JrHospital = {
  code: string;
  /** As the list prints it, with its regency or city: "RSUD SOEDONO, KOTA MADIUN". */
  name: string;
  loketCode: string;
  loketName: string;
};

/** A profile field the extractor read, with where it read it. */
export type DetectedField<T> = { value: T; source: string };

/** What the extractor read about the hospital; a field the document doesn't print is absent. */
export type DetectedProfile = {
  name?: DetectedField<string>;
  city?: DetectedField<string>;
  province?: DetectedField<string>;
  year?: DetectedField<number>;
  address?: DetectedField<string>;
  ownership?: DetectedField<NonNullable<Hospital["ownership"]>>;
};

/** A hospital heading in the document, for a regulation that lists many. */
export type DocumentHospital = { heading: string; name: string; pages: number };

export const OWNERSHIPS = ["Pemerintah", "Swasta", "BUMN", "TNI/Polri"] as const;

/**
 * Where a hospital's pin came from (migrations/013): found by the dashboard's lookup, checked on
 * OpenStreetMap, placed by hand on its page, or approximate (only its town or city is known).
 */
export type LocationSource = "geocoder" | "osm" | "manual" | "dummy";

export type HospitalLocation = { lat: number; lng: number; source: LocationSource };

/** A pin that only says roughly where: the hospital's town or city, not the hospital. */
export const isApproximate = (location: { source?: LocationSource } | null | undefined) => location?.source === "dummy";

export type Hospital = {
  id: string;
  name: string;
  /** Null when its document doesn't print it. */
  ownership: (typeof OWNERSHIPS)[number] | null;
  /** As the document prints them; empty when it doesn't. */
  city: string;
  province: string;
  address: string;
  beds: number;
  /** Its row in Jasa Raharja's list, with the office that handles its claims; null until matched. */
  jasaRaharja: JrHospital | null;
  /** Its pin on the map and where the pin came from; null until it has one. */
  location: HospitalLocation | null;
  facilities: HospitalFacility[];
  staff: HospitalStaff[];
  /**
   * Its prices against other hospitals' on rows named the same way: ratio 0.92 is 8% cheaper than
   * their median, over `compared` rows. Null until another hospital's document shares rows with its.
   */
  priceIndex: { ratio: number; compared: number } | null;
  /** The latest published document; null until one is published. */
  tariffBook: TariffBook | null;
  /** The published document before it. */
  previousBook: TariffBook | null;
};

/** What the system recognises in documents. */
export type Catalog = {
  facilities: Facility[];
  specialties: Specialty[];
};

/** Everything the scores are computed from. */
export type Dataset = {
  catalog: Catalog;
  hospitals: Hospital[];
};
