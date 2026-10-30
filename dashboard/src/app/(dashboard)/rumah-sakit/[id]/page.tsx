import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClaimProfile } from "@/components/claims/claim-profile";
import { DetailPane } from "@/components/hospital/detail-pane";
import { DetailTabs } from "@/components/hospital/detail-tabs";
import { ProfileSidebar } from "@/components/hospital/profile-sidebar";
import { facilityItems, ResourceList, staffItems } from "@/components/hospital/resources";
import { TARIFF_PAGE_SIZE, TariffLinesTable } from "@/components/hospital/tariff-book";
import { TariffRowDialog } from "@/components/hospital/tariff-row-dialog";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import { hospitalDetail } from "@/lib/claims/analysis";
import { claimNameOf, getClaimAnalysis, getHospitalClaims } from "@/lib/data/claims";
import { getBookLines, getBookRowStats, getDataset } from "@/lib/data/queries";
import type { Dataset, Hospital } from "@/lib/data/types";
import { allSummaries, summarize } from "@/lib/scoring";
import { dataCompleteness } from "@/lib/tariff-book";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The best-scoring other hospital in the same city, else the best overall: the natural one to compare against. */
const comparisonPeer = (hospital: Hospital, data: Dataset) => {
  const others = allSummaries(data)
    .filter((s) => s.hospital.id !== hospital.id && s.tipe !== null)
    .sort((a, b) => b.composite - a.composite);
  return (others.find((s) => s.hospital.city === hospital.city) ?? others[0])?.hospital;
};

/** Other hospitals' pins in its city: what's around when placing its own. */
const nearbyPins = (hospital: Hospital, data: Dataset) =>
  data.hospitals.flatMap((h) =>
    h.id !== hospital.id && h.location && (!hospital.city || h.city === hospital.city) ? [{ id: h.id, name: h.name, lat: h.location.lat, lng: h.location.lng }] : [],
  );

/** The hospital in the claim data, with its claims, when the data has it. */
const claimsOf = async (hospital: Hospital) => {
  const analysis = await getClaimAnalysis();
  const name = analysis && claimNameOf(hospital, analysis.hospitals.map((h) => h.name));
  const inClaims = name ? analysis.hospitals.find((h) => h.name === name) : undefined;
  if (!analysis || !inClaims) return null;
  return { hospital: inClaims, detail: hospitalDetail(await getHospitalClaims(inClaims.name), analysis.baselines[inClaims.name]), limits: analysis.limits };
};

export async function generateMetadata({ params }: PageProps<"/rumah-sakit/[id]">): Promise<Metadata> {
  const { id } = await params;
  const hospital = (await getDataset()).hospitals.find((h) => h.id === id);
  if (!hospital) return { title: "Rumah Sakit" };
  return {
    title: hospital.name,
    description: `Profil, tarif, dan fasilitas ${hospital.name}${hospital.city ? `, ${hospital.city}` : ""}`,
  };
}

export default async function HospitalPage({ params, searchParams }: PageProps<"/rumah-sakit/[id]">) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const data = await getDataset();
  const hospital = data.hospitals.find((h) => h.id === id);
  if (!hospital) notFound();

  const category: CategoryId | undefined = CATEGORIES.find((c) => c.id === first(search.kategori))?.id;
  const query = (first(search.cari) ?? "").trim();
  const page = Math.max(1, Number(first(search.hal)) || 1);

  const book = hospital.tariffBook;
  const [[lines, rowStats], claims] = await Promise.all([
    book
      ? Promise.all([getBookLines(book.id, { category, query, limit: TARIFF_PAGE_SIZE, offset: (page - 1) * TARIFF_PAGE_SIZE }), getBookRowStats(book.id)])
      : [null, null],
    claimsOf(hospital),
  ]);

  const summary = summarize(hospital, data);
  const completeness = dataCompleteness(hospital, rowStats);
  const facilities = facilityItems(hospital, data.catalog);
  const staff = staffItems(hospital, data.catalog);

  return (
    <DetailPane sidebar={<ProfileSidebar summary={summary} peer={comparisonPeer(hospital, data)} completeness={completeness} nearby={nearbyPins(hospital, data)} />}>
      <DetailTabs
        // ?tab=klaim opens on the claims, as links from the claim data do.
        defaultTab={first(search.tab) === "klaim" && claims ? "klaim" : "tarif"}
        counts={{
          tarif: book ? { value: book.rows, label: "baris tarif" } : undefined,
          fasilitas: { value: facilities.filter((f) => f.present).length, label: "fasilitas tersedia" },
          "tenaga-medis": { value: staff.filter((s) => s.present).length, label: "spesialis tersedia" },
          klaim: claims ? { value: claims.hospital.claims, label: "klaim", warn: claims.hospital.redFlags.length > 0 } : undefined,
        }}
        panels={{
          tarif:
            book && lines ? (
              <TariffLinesTable hospitalId={hospital.id} book={book} lines={lines.lines} total={lines.total} category={category} query={query} page={page} />
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                Belum ada data
                <TariffRowDialog hospitalId={hospital.id} hasBook={false} />
              </div>
            ),
          fasilitas: <ResourceList hospitalId={hospital.id} kind="fasilitas" items={facilities} roundTheClockLabel="24 jam" />,
          "tenaga-medis": <ResourceList hospitalId={hospital.id} kind="tenaga-medis" items={staff} roundTheClockLabel="On-call 24 jam" />,
          klaim: claims ? <ClaimProfile hospital={claims.hospital} detail={claims.detail} limits={claims.limits} /> : undefined,
        }}
      />
    </DetailPane>
  );
}
