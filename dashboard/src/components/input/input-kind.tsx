"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CLAIM_IMPORT_STEPS } from "@/components/claims/claim-import-steps";
import { JR_LIST_STEPS } from "@/components/jasa-raharja/jr-list-steps";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ImportShell, type ImportStep, KIND_STEP } from "./import-shell";
import { StepHeader } from "./step-layout";
import { TARIFF_STEPS } from "./tariff-import-flow";

export type InputKind = "tarif" | "daftar-rs" | "klaim";

const KINDS: { value: InputKind; label: string; detail: string; steps: ImportStep[] }[] = [
  { value: "tarif", label: "Dokumen tarif rumah sakit", detail: "PDF: Perda, Pergub, atau buku tarif", steps: TARIFF_STEPS },
  { value: "daftar-rs", label: "Daftar RS Jasa Raharja", detail: "Lembar kerja .xls dengan loket tiap rumah sakit", steps: JR_LIST_STEPS },
  { value: "klaim", label: "Data klaim Jasa Raharja", detail: "Lembar kerja .xlsx klaim per GL: LOS, diagnosa, tindakan, kelas kamar, nilai klaim", steps: CLAIM_IMPORT_STEPS },
];

/** Step 1 of the Input Data page: which kind of data is being uploaded; the steps above follow the choice. */
export function InputKindStep() {
  const router = useRouter();
  const [kind, setKind] = useState<InputKind>("tarif");
  const chosen = KINDS.find((k) => k.value === kind) ?? KINDS[0];

  return (
    <ImportShell crumb="Upload data" steps={chosen.steps} current={KIND_STEP.id}>
      <StepHeader
        title="Pilih jenis data"
        description="Dokumen yang diunggah dibaca sesuai jenisnya."
        actions={
          <Button size="sm" onClick={() => router.push(`/input?jenis=${kind}`)}>
            Lanjutkan
          </Button>
        }
      />
      <div className="rounded-xl border bg-background px-5 py-4">
        <label htmlFor="jenis-data" className="text-xs text-muted-foreground">
          Jenis data
        </label>
        <Select items={KINDS} value={kind} onValueChange={(next) => next && setKind(next)}>
          <SelectTrigger id="jenis-data" className="mt-1.5 w-full cursor-pointer bg-background dark:bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-xs text-muted-foreground">{chosen.detail}</p>
      </div>
    </ImportShell>
  );
}
