"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";

import { addClaimRows, discardClaimImport, finishClaimImport, startClaimImport } from "@/app/(dashboard)/input/claim-actions";
import { ImportShell } from "@/components/input/import-shell";
import { UploadForm } from "@/components/input/upload-form";
import { buttonVariants } from "@/components/ui/button";
import { CLAIM_CHUNK, CLAIM_COLUMNS, readClaimRows } from "@/lib/claims/sheet";
import { formatDate } from "@/lib/format";

import { CLAIM_IMPORT_STEPS } from "./claim-import-steps";

/** Where the upload ends: what the new data holds. */
export const CLAIM_SUMMARY_HREF = "/input?jenis=klaim&tahap=ringkasan";

const num = (n: number) => n.toLocaleString("id-ID");

/** The rows of the workbook's first sheet; the spreadsheet library loads only when a file is uploaded. */
async function sheetRows(file: File) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null }) : [];
}

/**
 * Step 2 of the claim data: the sheet is read in the browser, then sent a chunk at a time (a 40,000-row
 * export is several MB, over what one request to the server takes). The new data replaces the old only
 * once every row has arrived.
 */
export function ClaimImportFlow({ current }: { current: { rows: number; createdAt: string } | null }) {
  const router = useRouter();
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);

  const start = (file: File) =>
    startUpload(async () => {
      setError(undefined);
      let read: ReturnType<typeof readClaimRows>;
      try {
        read = readClaimRows(await sheetRows(file));
      } catch {
        return setError("File tidak terbaca sebagai lembar kerja Excel.");
      }
      if (read.error !== undefined) return setError(read.error);
      const { claims } = read;

      const opened = await startClaimImport(file.name);
      if (opened.error || !opened.id) return setError(opened.error ?? "Data tidak tersimpan.");
      const importId = opened.id;
      setProgress({ sent: 0, total: claims.length });
      for (let i = 0; i < claims.length; i += CLAIM_CHUNK) {
        const added = await addClaimRows(importId, claims.slice(i, i + CLAIM_CHUNK));
        if (added.error) {
          await discardClaimImport(importId);
          setProgress(null);
          return setError(added.error);
        }
        setProgress({ sent: Math.min(i + CLAIM_CHUNK, claims.length), total: claims.length });
      }
      // Each hospital once, as the data names it, for the ones the app doesn't have yet.
      const hospitals = [...new Map(claims.map((c) => [c[4], { name: c[4], region: c[12] }])).values()];
      const finished = await finishClaimImport(importId, hospitals);
      setProgress(null);
      if (finished.error) return setError(finished.error);
      toast.success(
        finished.added ? `${num(finished.count ?? 0)} klaim tersimpan; ${num(finished.added)} rumah sakit baru ditambahkan.` : `${num(finished.count ?? 0)} klaim tersimpan.`,
      );
      router.push(CLAIM_SUMMARY_HREF);
    });

  return (
    <ImportShell crumb="Upload data klaim" steps={CLAIM_IMPORT_STEPS} current={2}>
      <UploadForm
        onStart={start}
        uploading={uploading}
        uploadError={error}
        fileType="sheet"
        description={`Lembar kerja .xlsx klaim per GL dengan kolom ${CLAIM_COLUMNS.join(", ")}. Data baru menggantikan data sebelumnya.`}
        before={progress ? <Progress {...progress} /> : current && <CurrentData current={current} />}
      />
    </ImportShell>
  );
}

function Progress({ sent, total }: { sent: number; total: number }) {
  return (
    <div className="rounded-xl border bg-background px-5 py-3.5">
      <p className="text-sm font-medium tabular-nums">
        Menyimpan {num(sent)} dari {num(total)} klaim
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(sent / total) * 100}%` }} />
      </div>
    </div>
  );
}

/** What the app holds now, so the person knows the new sheet replaces it. */
function CurrentData({ current }: { current: { rows: number; createdAt: string } }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-background px-5 py-3.5">
      <ShieldAlert className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Data saat ini</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums">
          {num(current.rows)} klaim · diperbarui {formatDate(current.createdAt)}
        </p>
      </div>
      <Link href="/rumah-sakit?urut=risiko" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Lihat
      </Link>
    </div>
  );
}
