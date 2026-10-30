import { isApproximate, type Tier, type Tipe } from "@/lib/data/types";
import { formatKm } from "@/lib/origin";
import { treatmentNameOf, type TreatmentMatch } from "@/lib/scoring";

/** The slice of a TreatmentMatch a result card shows. */
export type SearchResult = {
  id: string;
  name: string;
  city: string;
  /** Its place in the overall ranking; null until it has a published document. */
  tipe: Tipe | null;
  /** The Jasa Raharja office that handles its claims; null until linked. */
  loket: string | null;
  tier: Tier;
  /** What its document calls the treatment, as printed. */
  rowName: string;
  priceMin: number;
  priceMax: number;
  /** How far from the accident, in words; null when the search has no point. */
  distance: string | null;
};

/** The distance as a card says it; without a pin for the hospital, that it's unknown; to an approximate pin, roughly. */
export const distanceText = (distanceKm: number | null, hasOrigin: boolean, approximate = false) =>
  !hasOrigin
    ? null
    : distanceKm === null
      ? "Jarak belum diketahui"
      : `${approximate ? "± " : ""}${formatKm(distanceKm)} dari lokasi kejadian${approximate ? " (lokasi RS perkiraan)" : ""}`;

export const toSearchResult = (m: TreatmentMatch, hasOrigin: boolean): SearchResult => ({
  id: m.summary.hospital.id,
  name: m.summary.hospital.name,
  city: m.summary.hospital.city,
  tipe: m.summary.tipe,
  loket: m.summary.hospital.jasaRaharja?.loketName ?? null,
  tier: m.tier,
  rowName: treatmentNameOf(m.line),
  priceMin: m.line.priceMin,
  priceMax: m.line.priceMax,
  distance: distanceText(m.distanceKm, hasOrigin, isApproximate(m.summary.hospital.location)),
});
