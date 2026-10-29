import { ChevronLeft, GitCompareArrows, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccidentSearch } from "@/components/search/accident-search";
import { CaseResultCard } from "@/components/search/case-result-card";
import { FilterButton, ResetFiltersButton, SortButton } from "@/components/search/filter-bar";
import {
  applyFilters,
  CASE_SORT_OPTIONS,
  caseFactsOf,
  countActiveFilters,
  factsOf,
  type Filters,
  parseFilters,
  parseSort,
  SORT_OPTIONS,
  type SortKey,
  withDistanceSort,
} from "@/components/search/filters";
import type { RankedPin } from "@/components/search/referral-map";
import { ReferralMapView } from "@/components/search/referral-map-view";
import { ResultCard } from "@/components/search/result-card";
import { toSearchResult } from "@/components/search/results";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type AccidentCase, accidentCaseKeys, findAccidentCase } from "@/lib/accident-cases";
import { getDataset, getTreatment, getTreatmentLines } from "@/lib/data/queries";
import type { Dataset, Hospital } from "@/lib/data/types";
import { locationParams, type Origin, parseOrigin } from "@/lib/origin";
import { ALL_LOCATIONS_PARAM, type CaseMatch, citiesOf, rankForCase, rankForTreatment, type TreatmentMatch } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "Cari Rujukan",
  description: "Cari tindakan dan rumah sakit rujukan untuk korban kecelakaan berdasarkan kasus dan lokasi",
};

const MAX_COMPARE = 3;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// rankForTreatment() and rankForCase() already return the recommended order, so that sort is a
// no-op, and a stable sort keeps it among equals.
// Hospitals whose pin isn't found go last.
const distanceOf = (m: { distanceKm: number | null }) => m.distanceKm ?? Infinity;

const SORT_COMPARE: Record<SortKey, (a: TreatmentMatch, b: TreatmentMatch) => number> = {
  rekomendasi: () => 0,
  lengkap: () => 0,
  harga: (a, b) => a.priceMid - b.priceMid,
  jarak: (a, b) => distanceOf(a) - distanceOf(b),
};

const treatmentCount = (m: CaseMatch) => m.steps.reduce((sum, step) => sum + step.treatments.length, 0);

// Hospitals whose prices can't be compared yet go last.
const priceRatioOf = (m: CaseMatch) => m.summary.hospital.priceIndex?.ratio ?? Infinity;

const CASE_SORT_COMPARE: Record<SortKey, (a: CaseMatch, b: CaseMatch) => number> = {
  rekomendasi: () => 0,
  lengkap: (a, b) => b.covered - a.covered || treatmentCount(b) - treatmentCount(a),
  harga: (a, b) => priceRatioOf(a) - priceRatioOf(b),
  jarak: (a, b) => distanceOf(a) - distanceOf(b),
};

/** Hospitals with a pin, for bearings on the picker's map. */
const contextPins = (data: Dataset) => data.hospitals.flatMap((h) => (h.location ? [{ id: h.id, name: h.name, ...h.location }] : []));

/** The ranked hospitals the map can place, numbered as listed. */
const rankedPins = (listed: { summary: { hospital: Hospital }; tier: CaseMatch["tier"]; distanceKm: number | null }[]): RankedPin[] =>
  listed.flatMap((m, index) =>
    m.summary.hospital.location && m.distanceKm !== null
      ? [{ id: m.summary.hospital.id, name: m.summary.hospital.name, rank: index + 1, tier: m.tier, distanceKm: m.distanceKm, ...m.summary.hospital.location }]
      : [],
  );

export default async function RecommendationPage({ searchParams }: PageProps<"/rekomendasi">) {
  const params = await searchParams;
  const key = first(params.tindakan);
  const accidentCase = findAccidentCase(first(params.kasus));
  const [data, treatment] = await Promise.all([getDataset(), key ? getTreatment(key) : null]);
  // Only where a hospital has a tariff document: referrals rank hospitals by what their documents price.
  const cities = citiesOf(data.hospitals.filter((h) => h.tariffBook));
  // A point on the map ranks every hospital by how far it is; otherwise a city the documents name,
  // or "" for "Semua lokasi" — also what an unknown or missing `lokasi` means.
  const origin = parseOrigin((key) => first(params[key]));
  const city = origin ? "" : (cities.find((c) => c === first(params.lokasi)) ?? "");
  const lokasi = city || ALL_LOCATIONS_PARAM;
  const linkParams = locationParams(origin, lokasi);

  const search = (compact: boolean) => (
    <AccidentSearch accidentCase={accidentCase} location={lokasi} origin={origin} cities={cities} pins={contextPins(data)} compact={compact} />
  );

  if (cities.length === 0) {
    return (
      <Results search={search(true)}>
        <EmptyState title="Belum ada data" />
      </Results>
    );
  }

  const bookIds = data.hospitals.flatMap((h) => (h.tariffBook ? [h.tariffBook.id] : []));

  // An accident case: the hospitals for the whole case, each with the tindakan it prices.
  if (!treatment && accidentCase) {
    return (
      <Results search={search(true)}>
        <CaseRecommendation
          accidentCase={accidentCase}
          city={city}
          origin={origin}
          linkParams={linkParams}
          bookIds={bookIds}
          sort={parseSort(first(params.urut), withDistanceSort(CASE_SORT_OPTIONS, origin !== null))}
          filters={parseFilters((key) => first(params[key]))}
        />
      </Results>
    );
  }

  // Nothing searched yet: the search sits alone in the middle of the page.
  if (!treatment) {
    return (
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col items-center justify-center px-4 pt-10 pb-[12vh] sm:px-8 lg:min-h-[calc(100dvh-4rem)]">
        <div className="w-full max-w-4xl">
          {/* No title of its own: the app header names the page. */}
          {search(false)}
        </div>
      </div>
    );
  }

  // Reached from an accident case: a way back to its other tindakan.
  const back = accidentCase
    ? { href: `/rekomendasi?${new URLSearchParams({ kasus: accidentCase.id, ...linkParams })}`, label: accidentCase.name }
    : undefined;
  const ranked = rankForTreatment(await getTreatmentLines([treatment.key], bookIds), city, data, origin);
  if (ranked.length === 0) {
    return (
      <Results search={search(true)} back={back}>
        <EmptyState title={city ? `Tidak ada tarif untuk "${treatment.name}" di ${city}` : `Tidak ada tarif untuk "${treatment.name}"`} />
      </Results>
    );
  }

  const sortOptions = withDistanceSort(SORT_OPTIONS, origin !== null);
  const sort = parseSort(first(params.urut), sortOptions);
  const filters = parseFilters((key) => first(params[key]));
  const listed = applyFilters(ranked, filters, factsOf).sort(SORT_COMPARE[sort]);
  const results = listed.map((m) => toSearchResult(m, origin !== null));
  const compareIds = ranked.slice(0, MAX_COMPARE).map((m) => m.summary.hospital.id);

  return (
    <Results search={search(true)} back={back}>
      {origin && <ReferralMapView origin={origin} pins={rankedPins(listed)} />}
      <div className={cn("flex flex-wrap items-center justify-between gap-2", origin && "mt-4")}>
        <div className="flex items-center gap-2">
          <Suspense>
            <FilterButton facts={ranked.map(factsOf)} />
            <SortButton options={sortOptions} />
          </Suspense>
        </div>
        {compareIds.length > 1 && (
          <Link
            href={`/bandingkan?rs=${compareIds.join(",")}&q=${encodeURIComponent(treatment.name)}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <GitCompareArrows data-icon="inline-start" />
            Bandingkan {compareIds.length} teratas
          </Link>
        )}
      </div>

      {results.length > 0 ? (
        <ol className="mt-3 grid gap-3">
          {results.map((r) => (
            <ResultCard key={r.id} result={r} treatmentName={treatment.name} />
          ))}
        </ol>
      ) : (
        <div className="mt-3">
          <FilteredOutState filters={filters} total={ranked.length} />
        </div>
      )}
    </Results>
  );
}

/** The hospitals ranked for a whole accident case, each holding the tindakan its document prices. */
async function CaseRecommendation({
  accidentCase,
  city,
  origin,
  linkParams,
  bookIds,
  sort,
  filters,
}: {
  accidentCase: AccidentCase;
  city: string;
  origin: Origin | null;
  /** Where the search is from, kept in the links among the results. */
  linkParams: Record<string, string>;
  bookIds: string[];
  sort: SortKey;
  filters: Filters;
}) {
  const [data, lines] = await Promise.all([getDataset(), getTreatmentLines(accidentCaseKeys(accidentCase), bookIds)]);
  const ranked = rankForCase(lines, accidentCase.steps, city, data, origin);
  const listed = applyFilters(ranked, filters, caseFactsOf).sort(CASE_SORT_COMPARE[sort]);
  const compareIds = ranked.slice(0, MAX_COMPARE).map((m) => m.summary.hospital.id);

  if (ranked.length === 0) {
    return (
      <>
        <h1 className="text-xl font-semibold tracking-tight text-balance">{accidentCase.name}</h1>
        <div className="mt-5">
          <EmptyState title={city ? `Belum ada rumah sakit di ${city} untuk kasus ini` : "Belum ada rumah sakit untuk kasus ini"} />
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-balance">{accidentCase.name}</h1>
      {origin && (
        <div className="mt-4">
          <ReferralMapView origin={origin} pins={rankedPins(listed)} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Suspense>
            <FilterButton facts={ranked.map(caseFactsOf)} />
            <SortButton options={withDistanceSort(CASE_SORT_OPTIONS, origin !== null)} />
          </Suspense>
        </div>
        {compareIds.length > 1 && (
          <Link href={`/bandingkan?rs=${compareIds.join(",")}`} className={buttonVariants({ variant: "outline" })}>
            <GitCompareArrows data-icon="inline-start" />
            Bandingkan {compareIds.length} teratas
          </Link>
        )}
      </div>

      {listed.length > 0 ? (
        <ol className="mt-3 grid gap-3">
          {listed.map((m) => (
            <CaseResultCard key={m.summary.hospital.id} match={m} caseId={accidentCase.id} locationParams={linkParams} hasOrigin={origin !== null} />
          ))}
        </ol>
      ) : (
        <div className="mt-3">
          <FilteredOutState filters={filters} total={ranked.length} />
        </div>
      )}
    </>
  );
}

function FilteredOutState({ filters, total }: { filters: Filters; total: number }) {
  return (
    <EmptyState
      title="Tidak ada rumah sakit yang cocok"
      description={`${countActiveFilters(filters)} filter aktif menyaring semua ${total} rumah sakit.`}
    >
      <Suspense>
        <ResetFiltersButton />
      </Suspense>
    </EmptyState>
  );
}

/** After a search: the search in a bar on top, what it found below. */
function Results({ search, back, children }: { search: React.ReactNode; back?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <>
      <div className="z-20 border-b bg-background/95 backdrop-blur md:sticky md:top-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-8">{search}</div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 pb-7 sm:px-8">
        {back && (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" />
            {back.label}
          </Link>
        )}
        {children}
      </div>
    </>
  );
}

function EmptyState({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-5" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-balance">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
