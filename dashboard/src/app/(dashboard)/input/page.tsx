import type { Metadata } from "next";

import { ClaimImportFlow } from "@/components/claims/claim-import-flow";
import { CLAIM_IMPORT_STEPS } from "@/components/claims/claim-import-steps";
import { ClaimSummarySection } from "@/components/claims/claim-summary-section";
import { InputKindStep } from "@/components/input/input-kind";
import { TariffImportFlow } from "@/components/input/tariff-import-flow";
import { ImportShell } from "@/components/input/import-shell";
import { JrListFlow } from "@/components/jasa-raharja/jr-list-flow";
import { JR_LIST_STEPS } from "@/components/jasa-raharja/jr-list-steps";
import { JrListSection, loketsOf } from "@/components/jasa-raharja/jr-list-section";
import { claimNameOf, getClaimAnalysis, getClaimImport } from "@/lib/data/claims";
import { getHospitals, getJrHospitals, getUnfinishedUploads } from "@/lib/data/queries";

export const metadata: Metadata = {
  title: "Input Data",
  description: "Unggah dokumen tarif rumah sakit, daftar RS, atau data klaim Jasa Raharja",
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Step 1 picks the kind of data; `jenis` carries the choice into the upload steps. An unfinished
 * tariff upload (`tarif`) is a tariff document, whatever step it was left at.
 */
export default async function UploadPage({ searchParams }: PageProps<"/input">) {
  const params = await searchParams;
  const bookId = first(params.tarif) ?? null;
  const kind = bookId ? "tarif" : first(params.jenis);
  const [hospitals, unfinished, jrHospitals] = await Promise.all([getHospitals(), getUnfinishedUploads(), getJrHospitals()]);

  if (kind === "daftar-rs") {
    if (first(params.tahap) === "periksa") {
      return (
        <ImportShell crumb="Upload daftar RS Jasa Raharja" steps={JR_LIST_STEPS} current={3}>
          <JrListSection list={jrHospitals} hospitals={hospitals} />
        </ImportShell>
      );
    }
    return <JrListFlow current={jrHospitals.length > 0 ? { hospitals: jrHospitals.length, lokets: loketsOf(jrHospitals).length } : null} />;
  }

  if (kind === "klaim") {
    if (first(params.tahap) === "ringkasan") {
      const analysis = await getClaimAnalysis();
      const names = analysis?.hospitals.map((h) => h.name) ?? [];
      const linked = hospitals.flatMap((h) => {
        const claimName = claimNameOf(h, names);
        return claimName ? [{ id: h.id, name: h.name, claimName }] : [];
      });
      return (
        <ImportShell crumb="Upload data klaim" steps={CLAIM_IMPORT_STEPS} current={3}>
          <ClaimSummarySection analysis={analysis} linked={linked} />
        </ImportShell>
      );
    }
    const current = await getClaimImport();
    return <ClaimImportFlow current={current && { rows: current.rows, createdAt: current.createdAt }} />;
  }

  if (kind === "tarif") {
    return (
      // Keyed by the upload, so opening another one starts its flow fresh.
      <TariffImportFlow
        key={bookId ?? "new"}
        hospitals={hospitals.map((h) => ({ id: h.id, name: h.name }))}
        jrHospitals={jrHospitals}
        unfinished={unfinished.filter((u) => u.id !== bookId)}
        initialBookId={bookId}
      />
    );
  }

  return <InputKindStep />;
}
