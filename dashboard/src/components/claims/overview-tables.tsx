import Link from "next/link";

import type { LoketClaims } from "@/lib/claims/analysis";
import { formatPercent, formatRupiahShort } from "@/lib/format";
import { cn } from "@/lib/utils";

import { HEAD_ROW, num, TABLE, TABLE_FRAME, TD, TD_NUM, TH, TH_NUM } from "./table";

const loketName = (loket: string | null) => loket?.replace(/^LOKET\s+/i, "") ?? "—";

function Empty({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center text-sm text-muted-foreground">
        Tidak ada
      </td>
    </tr>
  );
}

/** Each loket: the claims of the hospitals it handles. */
export function LoketTable({ lokets }: { lokets: LoketClaims[] }) {
  return (
    <div className={TABLE_FRAME}>
      <table className={TABLE}>
        <thead>
          <tr className={HEAD_ROW}>
            <th className={TH}>Loket</th>
            <th className={TH_NUM}>Rumah sakit</th>
            <th className={TH_NUM}>Klaim</th>
            <th className={TH_NUM}>Total dibayar</th>
            <th className={TH_NUM}>Rata-rata dibayar</th>
            <th className={TH_NUM}>LOS rata-rata</th>
            <th className={TH_NUM}>Cedera berat</th>
            <th className={TH_NUM}>RS terindikasi</th>
            <th className={TH}>Cedera terbanyak</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lokets.length === 0 && <Empty colSpan={9} />}
          {lokets.map((l) => (
            <tr key={l.loket}>
              <td className={cn(TD, "font-medium whitespace-nowrap")}>
                <Link href={`/rumah-sakit?loket=${encodeURIComponent(l.loket)}`} className="hover:underline">
                  {loketName(l.loket)}
                </Link>
              </td>
              <td className={TD_NUM}>{num(l.hospitals)}</td>
              <td className={TD_NUM}>{num(l.claims)}</td>
              <td className={TD_NUM}>{formatRupiahShort(l.paidTotal)}</td>
              <td className={TD_NUM}>{formatRupiahShort(l.paidAvg)}</td>
              <td className={TD_NUM}>{l.avgLos === null ? "—" : `${l.avgLos.toLocaleString("id-ID", { maximumFractionDigits: 1 })} hari`}</td>
              <td className={TD_NUM}>{formatPercent(l.severeShare)}</td>
              <td className={TD_NUM}>
                {l.redFlagHospitals > 0 ? (
                  <Link href={`/klaim?loket=${encodeURIComponent(l.loket)}`} className="font-medium text-tier-c-ink hover:underline">
                    {num(l.redFlagHospitals)}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </td>
              <td className={cn(TD, "min-w-44 text-xs")}>{l.topDiagnosis ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
