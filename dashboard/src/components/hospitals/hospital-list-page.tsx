import { cookies } from "next/headers";

import { CompareSelectionProvider } from "@/components/compare-selection";
import {
  type ClaimFigures,
  type HospitalRow,
  loketLabel,
  parseQuery,
  QUERY_PARAMS,
  type View,
  VIEW_DEFS,
} from "@/components/hospitals/hospital-list";
import { HospitalTable } from "@/components/hospitals/hospital-table";
import { type HospitalClaims, riskOf } from "@/lib/claims/analysis";
import { claimNameOf, getClaimAnalysis } from "@/lib/data/claims";
import { getDataset } from "@/lib/data/queries";
import type { HospitalSummary } from "@/lib/scoring";
import { allSummaries, compositeOf } from "@/lib/scoring";
import { bookYear } from "@/lib/tariff-book";

const figuresOf = (h: HospitalClaims): ClaimFigures => ({
  risk: riskOf(h.redFlags.length),
  indications: h.redFlags,
  claims: h.claims,
  flaggedClaims: h.flaggedClaims,
  overpayment: h.overpayment,
  avgLos: h.avgLos,
  paidAvg: h.paidAvg,
  excessAvg: h.excessAvg,
  severeShare: h.severeShare,
  vipShare: h.vipShare,
  vipHigh: h.vipOutlier === true,
  repeatShare: h.repeatVictims.outlier === null ? null : h.repeatVictims.rate,
  repeatHigh: h.repeatVictims.outlier === true,
  topDiagnosis: h.topDiagnosis,
  topSurgery: h.topSurgery,
});

const toRow = ({ hospital, tipe, price, services, scores }: HospitalSummary, claims: HospitalClaims | undefined): HospitalRow => ({
  id: hospital.id,
  name: hospital.name,
  city: hospital.city,
  ownership: hospital.ownership,
  loket: loketLabel(hospital.jasaRaharja?.loketName ?? claims?.loket ?? ""),
  tipe,
  price: price && hospital.priceIndex ? { ...price, ratio: hospital.priceIndex.ratio } : null,
  services: services && { ...services, score: compositeOf(scores) },
  tariff: hospital.tariffBook ? "ada" : "belum-ada",
  year: bookYear(hospital.tariffBook),
  version: hospital.tariffBook?.version ?? null,
  claims: claims ? figuresOf(claims) : null,
});

/** Highest claim risk first, then the largest potential overpayment, then the most claims; no claims last. */
const byRisk = (a: HospitalClaims | undefined, b: HospitalClaims | undefined) =>
  (b?.redFlags.length ?? -1) - (a?.redFlags.length ?? -1) || (b?.overpayment ?? 0) - (a?.overpayment ?? 0) || (b?.claims ?? 0) - (a?.claims ?? 0);

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * A hospital list page, full height under the app header like the CRM tables: Rumah Sakit (`rujukan`,
 * every hospital) or Indikasi Klaim (`klaim`, only those whose claims have an indication).
 */
export async function HospitalListPage({ view, searchParams }: { view: View; searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  // A link with its own search, filters or sort shows exactly that; otherwise the list opens as it was left.
  const fromUrl = QUERY_PARAMS.some((param) => params[param] !== undefined);
  const saved = new URLSearchParams((await cookies()).get(VIEW_DEFS[view].cookie)?.value ?? "");
  const initial = fromUrl ? parseQuery(view, (param) => [params[param] ?? []].flat()) : parseQuery(view, (param) => saved.getAll(param));

  const [data, analysis] = await Promise.all([getDataset(), getClaimAnalysis()]);
  const claimHospitals = analysis?.hospitals ?? [];
  const names = claimHospitals.map((h) => h.name);
  const claimsByName = new Map(claimHospitals.map((h) => [h.name, h]));
  const claimsOf = (s: HospitalSummary) => {
    const name = claimNameOf(s.hospital, names);
    return name ? claimsByName.get(name) : undefined;
  };

  // Ranked hospitals (those with a tariff document) first, by their rank; the rest by claim risk. The
  // table keeps this order unless sorted (Indikasi Klaim sorts by risk itself).
  const rows = allSummaries(data)
    .map((s) => ({ s, claims: claimsOf(s) }))
    .filter(({ claims }) => view === "rujukan" || (claims?.redFlags.length ?? 0) > 0)
    .sort((a, b) => (a.s.placing?.rank ?? Infinity) - (b.s.placing?.rank ?? Infinity) || byRisk(a.claims, b.claims))
    .map(({ s, claims }) => toRow(s, claims));

  return (
    <CompareSelectionProvider>
      {/* A link to the page with other params starts the table afresh from them. */}
      <HospitalTable key={JSON.stringify(initial)} view={view} rows={rows} initial={initial} />
    </CompareSelectionProvider>
  );
}
