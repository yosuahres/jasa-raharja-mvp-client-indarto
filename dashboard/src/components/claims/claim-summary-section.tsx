import Link from "next/link";

import { StepHeader } from "@/components/input/step-layout";
import { buttonVariants } from "@/components/ui/button";
import { claimSlug } from "@/lib/claims/analysis";
import type { getClaimAnalysis } from "@/lib/data/claims";
import { formatRupiahShort } from "@/lib/format";

import { Facts, HEAD_ROW, num, TABLE, TABLE_FRAME, TD, TD_NUM, TH, TH_NUM } from "./table";

type Analysis = NonNullable<Awaited<ReturnType<typeof getClaimAnalysis>>>;

/** Last step of the claim data: what was saved, and which hospitals of the app it covers. */
export function ClaimSummarySection({ analysis, linked }: { analysis: Analysis | null; linked: { id: string; name: string; claimName: string }[] }) {
  const flagged = analysis?.hospitals.filter((h) => h.redFlags.length > 0).length ?? 0;
  return (
    <div className="flex flex-col gap-8 [&>:first-child]:mb-0">
      <StepHeader
        title="Ringkasan"
        status={analysis ? { label: "Tersimpan", tone: "success" } : undefined}
        description={
          analysis
            ? `${num(analysis.claims)} klaim dari ${num(analysis.hospitals.length)} rumah sakit di ${num(analysis.lokets.length)} loket.`
            : "Belum ada data klaim."
        }
        actions={
          <>
            <Link href="/input?jenis=klaim" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Unggah lagi
            </Link>
            <Link href="/klaim" className={buttonVariants({ size: "sm" })}>
              Lihat hasil
            </Link>
          </>
        }
      />

      {analysis && (
        <Facts
          items={[
            { label: "Klaim", value: num(analysis.claims) },
            { label: "Rumah sakit", value: num(analysis.hospitals.length) },
            { label: "Total dibayar", value: formatRupiahShort(analysis.paidTotal) },
            { label: "RS terindikasi", value: num(flagged) },
            { label: "Rata-rata dibayar", value: formatRupiahShort(analysis.paidTotal / analysis.claims), detail: "per klaim" },
            { label: "Terhubung", value: num(linked.length), detail: "RS dengan data tarif" },
          ]}
        />
      )}

      {linked.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Rumah sakit di sistem</h3>
          <div className={TABLE_FRAME}>
            <table className={TABLE}>
              <thead>
                <tr className={HEAD_ROW}>
                  <th className={TH}>Rumah sakit</th>
                  <th className={TH}>Di data klaim</th>
                  <th className={TH_NUM}>Klaim</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linked.map((h) => (
                  <tr key={h.id}>
                    <td className={TD}>
                      <Link href={`/rumah-sakit/${h.id}`} className="font-medium hover:underline">
                        {h.name}
                      </Link>
                    </td>
                    <td className={TD}>
                      <Link href={`/klaim/${claimSlug(h.claimName)}`} className="hover:underline">
                        {h.claimName}
                      </Link>
                    </td>
                    <td className={TD_NUM}>{num(analysis?.hospitals.find((c) => c.name === h.claimName)?.claims ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
