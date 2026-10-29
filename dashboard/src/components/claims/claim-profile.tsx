import { type BreakdownRow, type HospitalClaims, type HospitalDetail, type Limits, MIN_CLAIMS, riskOf, RULES } from "@/lib/claims/analysis";
import { formatPercent, formatRupiahShort } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Excess, Facts, HEAD_ROW, num, RiskBadge, RuleTags, SectionTitle, TABLE, TABLE_FRAME, TD, TD_NUM, TH, TH_NUM } from "./table";

const TOP = 10;

/** One hospital in the claim data: its figures, its indications against the limits, what it treats, and its indicated claims. */
export function ClaimProfile({ hospital, detail, limits }: { hospital: HospitalClaims; detail: HospitalDetail; limits: Limits }) {
  const outpatient = hospital.claims - hospital.inpatient;
  return (
    <div className="flex flex-col gap-8">
      <Facts
        items={[
          { label: "Klaim", value: num(hospital.claims), detail: `${num(hospital.inpatient)} rawat inap · ${num(outpatient)} rawat jalan` },
          { label: "LOS rata-rata", value: hospital.avgLos === null ? "—" : `${hospital.avgLos.toLocaleString("id-ID", { maximumFractionDigits: 1 })} hari`, detail: "rawat inap" },
          { label: "Total dibayar", value: formatRupiahShort(hospital.paidTotal), detail: `diajukan ${formatRupiahShort(hospital.billedTotal)}` },
          { label: "Rata-rata dibayar", value: formatRupiahShort(hospital.paidAvg), detail: "per klaim" },
          { label: "Klaim terindikasi", value: num(hospital.flaggedClaims), detail: `${formatPercent(hospital.flaggedClaims / hospital.claims)} dari semua klaim` },
          { label: "Potensi kelebihan bayar", value: formatRupiahShort(hospital.overpayment), detail: "di atas median klaim sejenis di RS lain" },
        ]}
      />

      <section className="flex flex-col gap-2">
        <SectionTitle
          title="Indikasi"
          description={`Terindikasi bila persentasenya masuk 20% tertinggi antar rumah sakit dan terlalu tinggi untuk kebetulan. Dinilai bila ada minimal ${MIN_CLAIMS} klaim.`}
          actions={
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              Risiko <RiskBadge risk={riskOf(hospital.redFlags.length)} />
            </span>
          }
        />
        <div className={TABLE_FRAME}>
          <table className={TABLE}>
            <thead>
              <tr className={HEAD_ROW}>
                <th className={TH}>Indikasi</th>
                <th className={TH_NUM}>Klaim terindikasi</th>
                <th className={TH_NUM}>Persentase</th>
                <th className={TH_NUM}>Batas</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {RULES.map((rule) => {
                const r = hospital.rules[rule.id];
                const limit = limits[rule.id];
                return (
                  <tr key={rule.id}>
                    <td className={TD}>
                      <span className="font-medium">{rule.label}</span>
                      <span className="block max-w-md text-xs text-muted-foreground">{rule.detail}</span>
                    </td>
                    <td className={TD_NUM}>
                      {num(r.flagged)} <span className="text-muted-foreground">dari {num(r.eligible)}</span>
                    </td>
                    <td className={TD_NUM}>{r.eligible ? formatPercent(r.rate) : "—"}</td>
                    <td className={TD_NUM}>{limit === null ? "—" : `≥ ${formatPercent(limit)}`}</td>
                    <td className={TD}>
                      <Status outlier={r.outlier} />
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className={TD}>
                  <span className="font-medium">Kecenderungan kelas VIP</span>
                  <span className="block max-w-md text-xs text-muted-foreground">Porsi pasien rawat inap di kamar VIP.</span>
                </td>
                <td className={TD_NUM}>
                  {num(detail.roomClasses.find((r) => r.label === "VIP")?.claims ?? 0)} <span className="text-muted-foreground">dari {num(hospital.inpatient)}</span>
                </td>
                <td className={TD_NUM}>{hospital.vipShare === null ? "—" : formatPercent(hospital.vipShare)}</td>
                <td className={TD_NUM}>{limits.vip === null ? "—" : `≥ ${formatPercent(limits.vip)}`}</td>
                <td className={TD}>
                  <Status outlier={hospital.vipOutlier} high="Tinggi" />
                </td>
              </tr>
              <tr>
                <td className={TD}>
                  <span className="font-medium">Korban dengan GL berulang</span>
                  <span className="block max-w-md text-xs text-muted-foreground">Porsi korban dengan lebih dari satu GL di RS ini. Nama yang sama bisa orang berbeda.</span>
                </td>
                <td className={TD_NUM}>
                  {num(hospital.repeatVictims.flagged)} <span className="text-muted-foreground">dari {num(hospital.repeatVictims.eligible)} korban</span>
                </td>
                <td className={TD_NUM}>{hospital.repeatVictims.eligible ? formatPercent(hospital.repeatVictims.rate) : "—"}</td>
                <td className={TD_NUM}>{limits.repeat === null ? "—" : `≥ ${formatPercent(limits.repeat)}`}</td>
                <td className={TD}>
                  <Status outlier={hospital.repeatVictims.outlier} high="Tinggi" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <Breakdown title="Cedera terbanyak" label="Diagnosa" rows={detail.diagnoses} total={hospital.claims} />
        <Breakdown title="Tindakan operasi terbanyak" label="Tindakan" rows={detail.surgeries} total={hospital.claims} />
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <MixTable title="Kelas kamar" description="Rawat inap" rows={detail.roomClasses} />
        <MixTable title="Kategori cedera" rows={detail.categories} />
        <MixTable title="Jenis rawatan" rows={detail.careTypes} />
      </div>

      <FlaggedClaims claims={detail.flagged} />
    </div>
  );
}

function Status({ outlier, high = "Terindikasi" }: { outlier: boolean | null; high?: string }) {
  if (outlier === null) return <span className="text-xs text-muted-foreground">Data kurang</span>;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        outlier ? "bg-tier-c-soft text-tier-c-ink" : "bg-muted text-muted-foreground",
      )}
    >
      {outlier ? high : "Wajar"}
    </span>
  );
}

function Breakdown({ title, label, rows, total }: { title: string; label: string; rows: BreakdownRow[]; total: number }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle title={title} description={rows.length > TOP ? `${TOP} teratas dari ${num(rows.length)}` : undefined} />
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">Belum ada data</p>
      ) : (
        <div className={TABLE_FRAME}>
          <table className={TABLE}>
            <thead>
              <tr className={HEAD_ROW}>
                <th className={TH}>{label}</th>
                <th className={TH_NUM}>Klaim</th>
                <th className={TH_NUM}>Rata-rata dibayar</th>
                <th className={TH_NUM} title="Selisih rata-rata nilai dibayar terhadap median klaim sejenis di RS lain">
                  Selisih vs median
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.slice(0, TOP).map((r) => (
                <tr key={r.label}>
                  <td className={TD}>{r.label}</td>
                  <td className={TD_NUM}>
                    {num(r.claims)}
                    <span className="block text-xs text-muted-foreground">{formatPercent(r.claims / total)}</span>
                  </td>
                  <td className={TD_NUM}>{formatRupiahShort(r.paidAvg)}</td>
                  <td className={TD_NUM}>
                    <Excess value={r.excessAvg} format={formatRupiahShort} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MixTable({ title, description, rows }: { title: string; description?: string; rows: { label: string; claims: number }[] }) {
  const total = rows.reduce((s, r) => s + r.claims, 0);
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle title={title} description={description} />
      <div className={TABLE_FRAME}>
        <table className={TABLE}>
          <tbody className="divide-y">
            {rows.length === 0 ? (
              <tr>
                <td className={cn(TD, "text-center text-muted-foreground")}>Belum ada data</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.label}>
                  <td className={TD}>{r.label}</td>
                  <td className={TD_NUM}>{num(r.claims)}</td>
                  <td className={cn(TD_NUM, "w-16 text-muted-foreground")}>{formatPercent(r.claims / total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FlaggedClaims({ claims }: { claims: HospitalDetail["flagged"] }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle title="Klaim terindikasi" description={claims.length ? `${num(claims.length)} klaim, urut dari indikasi terbanyak lalu potensi kelebihan bayar terbesar` : undefined} />
      {claims.length === 0 ? (
        <p className="rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">Tidak ada</p>
      ) : (
        <div className={cn(TABLE_FRAME, "max-h-[36rem] overflow-y-auto")}>
          <table className={TABLE}>
            <thead className="sticky top-0 z-10">
              <tr className={cn(HEAD_ROW, "bg-muted")}>
                <th className={TH}>Korban</th>
                <th className={TH}>Diagnosa</th>
                <th className={TH}>Tindakan</th>
                <th className={TH_NUM}>LOS</th>
                <th className={TH}>Kelas</th>
                <th className={TH_NUM}>Dibayar</th>
                <th className={TH_NUM} title="Nilai dibayar di atas median klaim sejenis di RS lain">
                  Potensi kelebihan
                </th>
                <th className={TH}>Indikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {claims.map((c) => (
                <tr key={c.guaranteeId}>
                  <td className={TD}>
                    <span className="font-medium">{c.victim ?? "—"}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">{c.guaranteeId}</span>
                  </td>
                  <td className={cn(TD, "min-w-48")}>
                    {c.diagnosis || "—"}
                    <span className="block text-xs text-muted-foreground">
                      {[c.category, c.careType].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className={cn(TD, "min-w-40")}>
                    {c.surgery ?? "—"}
                    {c.procedureNote && <span className="block text-xs text-muted-foreground">{c.procedureNote}</span>}
                  </td>
                  <td className={TD_NUM}>{c.los ?? "—"}</td>
                  <td className={cn(TD, "whitespace-nowrap")}>{c.roomClass ?? "—"}</td>
                  <td className={TD_NUM}>
                    {formatRupiahShort(c.paid)}
                    {c.billed !== null && <span className="block text-xs text-muted-foreground">diajukan {formatRupiahShort(c.billed)}</span>}
                  </td>
                  <td className={TD_NUM}>{c.excess > 0 ? formatRupiahShort(c.excess) : <span className="text-muted-foreground">—</span>}</td>
                  <td className={TD}>
                    <RuleTags rules={c.flags} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
