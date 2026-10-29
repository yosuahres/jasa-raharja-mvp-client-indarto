import { Building2, ExternalLink, FileUp, Grid3x3, ListOrdered, MapPin, Rows3, ShieldAlert, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Chips } from "@/components/chips";
import { LoketTable } from "@/components/claims/overview-tables";
import { RiskBadge, RuleTags } from "@/components/claims/table";
import { HomeMap } from "@/components/home/home-map";
import { ScoreBar } from "@/components/score-parameters";
import { TipeBadge } from "@/components/tier-badge";
import { buttonVariants } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/categories";
import { claimSlug, type HospitalClaims, riskOf } from "@/lib/claims/analysis";
import { getClaimAnalysis } from "@/lib/data/claims";
import { getDataset, getUnfinishedUploads } from "@/lib/data/queries";
import { formatPercent, formatRupiahShort } from "@/lib/format";
import { allSummaries, citiesOf, type HospitalSummary, PARAMETER_LABEL, WEIGHTS } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Beranda",
  description: "Ringkasan rumah sakit, cakupan layanannya, dan penilaiannya",
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const byRank = (a: HospitalSummary, b: HospitalSummary) => (a.placing?.rank ?? Infinity) - (b.placing?.rank ?? Infinity);

const PARAMETERS = Object.keys(PARAMETER_LABEL) as (keyof typeof PARAMETER_LABEL)[];

/** How many tariff rows a cell holds, darkest first; the legend reads them back in this order. */
const HEAT = [
  { min: 500, label: "500+", className: "bg-chart-1" },
  { min: 200, label: "≥ 200", className: "bg-chart-1/80" },
  { min: 50, label: "≥ 50", className: "bg-chart-1/60" },
  { min: 10, label: "≥ 10", className: "bg-chart-1/40" },
  { min: 1, label: "< 10", className: "bg-chart-1/20" },
  { min: 0, label: "0", className: "bg-muted/60" },
];

const heatOf = (rows: number) => HEAT.find((h) => rows >= h.min) ?? HEAT[HEAT.length - 1];

const CARD = "flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-border";
const CARD_TITLE = "flex items-center gap-2 text-sm font-semibold";
const ICON_TILE = "grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5";

const num = (value: number) => value.toLocaleString("id-ID");

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const [data, unfinished, claims] = await Promise.all([getDataset(), getUnfinishedUploads(), getClaimAnalysis()]);
  // The home page is about the hospitals' tariffs: hospitals known only from the claim data have their own section.
  const documented = data.hospitals.filter((h) => h.tariffBook);
  const cities = citiesOf(documented);
  // A city the documents name, or "" for every hospital — also what an unknown `kota` means.
  const city = cities.find((c) => c === first(params.kota)) ?? "";

  const lokets = [...new Set(documented.flatMap((h) => (h.jasaRaharja ? [h.jasaRaharja.loketName] : [])))].sort();
  const loket = lokets.find((l) => l === first(params.loket)) ?? "";
  const chipHref = (kota: string, loketName: string) => {
    const q = new URLSearchParams();
    if (kota) q.set("kota", kota);
    if (loketName) q.set("loket", loketName);
    return q.size ? `/?${q}` : "/";
  };

  const ranked = allSummaries(data)
    .filter((s) => s.hospital.tariffBook)
    .sort(byRank);
  const shown = ranked.filter((s) => (!city || s.hospital.city === city) && (!loket || s.hospital.jasaRaharja?.loketName === loket));
  const published = shown.filter((s) => s.hospital.tariffBook);
  const rows = published.reduce((sum, s) => sum + (s.hospital.tariffBook?.rows ?? 0), 0);
  const placed = shown.filter((s) => s.hospital.location).length;
  const mapRows = shown.map((s) => ({
    id: s.hospital.id,
    name: s.hospital.name,
    city: s.hospital.city,
    tipe: s.tipe,
    price: s.price,
    services: s.services,
    location: s.hospital.location,
  }));

  if (ranked.length === 0) {
    return (
      <div className="w-full px-4 py-6 sm:px-8">
        <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">Belum ada data</p>
      </div>
    );
  }

  // No title of its own: the app header names the page.
  return (
    <div className="grid w-full gap-4 px-4 py-4 sm:px-6 lg:grid-cols-12">
      {/* ------------------------------------------------------------ city and loket chips, over everything */}
      <div className="flex flex-wrap gap-2 lg:col-span-12">
        <Chips current={city} options={[{ value: "", label: "Semua kota" }, ...cities.map((c) => ({ value: c, label: c }))]} href={(v) => chipHref(v, loket)} />
        {lokets.length > 0 && (
          <Chips
            current={loket}
            options={[{ value: "", label: "Semua loket" }, ...lokets.map((l) => ({ value: l, label: l.replace(/^LOKET\s+/i, "") }))]}
            href={(v) => chipHref(city, v)}
          />
        )}
      </div>

      {/* ------------------------------------------------------------ map, with the full page a click away */}
      <section className={cn(CARD, "lg:col-span-5")}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={CARD_TITLE}>
            <span className={ICON_TILE}>
              <MapPin />
            </span>
            Peta rumah sakit
          </h2>
          <Link href={city ? `/peta?kota=${encodeURIComponent(city)}` : "/peta"} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Buka
            <ExternalLink data-icon="inline-end" />
          </Link>
        </div>
        <HomeMap rows={mapRows} />
      </section>

      {/* ------------------------------------------------------------ heatmap: tariff rows per hospital and category */}
      <section className={cn(CARD, "lg:col-span-4")}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={CARD_TITLE}>
            <span className={ICON_TILE}>
              <Grid3x3 />
            </span>
            Cakupan layanan (baris tarif)
          </h2>
          <Link href="/rumah-sakit" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Rincian
          </Link>
        </div>

        <div className="rounded-xl border px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-semibold">{[city, loket.replace(/^LOKET\s+/i, "")].filter(Boolean).join(" · ") || "Semua kota"}</span>
            <span className="text-xs text-muted-foreground">{published.length} dokumen terbit</span>
          </div>
          <span className="text-sm text-muted-foreground">{num(rows)} baris tarif</span>
        </div>

        {published.length === 0 ? (
          <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">Belum ada data tarif</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              className="grid gap-1 text-xs text-muted-foreground"
              style={{ gridTemplateColumns: `minmax(9rem,auto) repeat(${published.length}, minmax(3rem, 1fr))` }}
            >
              <span />
              {published.map((s) => (
                <span key={s.hospital.id} title={s.hospital.name} className="truncate text-center">
                  {s.hospital.name.replace(/^(RSUD|RSU|RS)\s+/i, "")}
                </span>
              ))}
              {CATEGORIES.map((c) => (
                <HeatRow key={c.id} label={c.label} cells={published.map((s) => ({ id: s.hospital.id, name: s.hospital.name, rows: s.hospital.tariffBook?.categories[c.id] ?? 0 }))} />
              ))}
            </div>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${HEAT.length}, minmax(0, 1fr))` }}>
              {[...HEAT].reverse().map((h) => (
                <span key={h.label} className="flex flex-col gap-1">
                  <span className={cn("h-1.5 rounded-full", h.className)} />
                  <span className="text-[11px] text-muted-foreground tabular-nums">{h.label}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ right column: ranking, then the parameters */}
      <div className="grid content-start gap-4 lg:col-span-3">
        <section className={CARD}>
          <h2 className={CARD_TITLE}>
            <span className={ICON_TILE}>
              <ListOrdered />
            </span>
            Peringkat
          </h2>
          <ol className="flex flex-col gap-1.5">
            {shown.map((s) => (
              <li key={s.hospital.id}>
                <Link
                  href={`/rumah-sakit/${s.hospital.id}`}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors hover:bg-muted/40"
                >
                  <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground tabular-nums">{s.placing?.rank ?? "—"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.hospital.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.hospital.city || "Kota tidak tercetak"}</span>
                  </span>
                  {s.tipe && <TipeBadge tipe={s.tipe} />}
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className={CARD}>
          <h2 className={CARD_TITLE}>
            <span className={ICON_TILE}>
              <SlidersHorizontal />
            </span>
            Penilaian per parameter
          </h2>
          <div className="flex flex-col gap-4">
            {PARAMETERS.map((key, index) => (
              <div key={key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{PARAMETER_LABEL[key]}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">bobot {formatPercent(WEIGHTS[key])}</span>
                </div>
                {shown.map((s) => {
                  const p = s.parameters[index];
                  return (
                    <div key={s.hospital.id} className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-x-2 gap-y-0.5" title={p.detail}>
                      <span className="truncate text-xs text-muted-foreground">{s.hospital.name}</span>
                      <span className="text-right text-xs font-medium tabular-nums">{Math.round(p.score)}</span>
                      <ScoreBar value={p.score} className="col-span-2" />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------ bottom: the totals */}
      <section className={cn(CARD, "lg:col-span-4")}>
        <h2 className={CARD_TITLE}>
          <span className={ICON_TILE}>
            <Rows3 />
          </span>
          Baris tarif
        </h2>
        <div>
          <p className="text-xs text-muted-foreground">{published.length} dokumen terbit</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{num(rows)}</p>
          <p className="text-sm text-muted-foreground">{published.length ? `${num(Math.round(rows / published.length))} rata-rata / rumah sakit` : "Belum ada dokumen"}</p>
        </div>
      </section>
      <Link href="/input" className={cn(CARD, "transition-colors hover:bg-muted/40 lg:col-span-4")}>
        <h2 className={CARD_TITLE}>
          <span className={ICON_TILE}>
            <FileUp />
          </span>
          Dokumen belum selesai
        </h2>
        <div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{unfinished.length}</p>
          <p className="text-sm text-muted-foreground">{unfinished.length ? "Buka Input Data untuk melanjutkan" : "Semua dokumen sudah disimpan"}</p>
        </div>
      </Link>
      <Link href="/peta" className={cn(CARD, "transition-colors hover:bg-muted/40 lg:col-span-4")}>
        <h2 className={CARD_TITLE}>
          <span className={ICON_TILE}>
            <MapPin />
          </span>
          Kota
        </h2>
        <div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{cities.length}</p>
          <p className="text-sm text-muted-foreground">{placed} dari {shown.length} rumah sakit ada di peta</p>
        </div>
      </Link>

      {/* ------------------------------------------------------------ claims: the red flag worklist's top, and its totals */}
      <ClaimsSection analysis={claims} />
    </div>
  );
}

const CLAIM_TOP = 5;

/** The top of Klaim RS: who to check first, and what the claim data adds up to. */
function ClaimsSection({ analysis }: { analysis: Awaited<ReturnType<typeof getClaimAnalysis>> }) {
  if (!analysis) {
    return (
      <Link href="/input?jenis=klaim" className={cn(CARD, "transition-colors hover:bg-muted/40 lg:col-span-12")}>
        <h2 className={CARD_TITLE}>
          <span className={ICON_TILE}>
            <ShieldAlert />
          </span>
          Red flag klaim
        </h2>
        <p className="text-sm text-muted-foreground">Belum ada data klaim</p>
      </Link>
    );
  }

  const indicated = analysis.hospitals
    .filter((h) => h.redFlags.length > 0)
    .sort((a: HospitalClaims, b: HospitalClaims) => b.redFlags.length - a.redFlags.length || b.overpayment - a.overpayment);
  const overpayment = indicated.reduce((sum, h) => sum + h.overpayment, 0);

  return (
    <>
      <section className={cn(CARD, "lg:col-span-8")}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={CARD_TITLE}>
            <span className={ICON_TILE}>
              <ShieldAlert />
            </span>
            Red flag klaim
          </h2>
          <Link href="/rumah-sakit?urut=risiko" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Lihat semua
            <ExternalLink data-icon="inline-end" />
          </Link>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Rumah sakit</th>
                <th className="px-3 py-2 text-left font-medium">Risiko</th>
                <th className="px-3 py-2 text-left font-medium">Indikasi</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Klaim terindikasi</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Potensi kelebihan bayar</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {indicated.slice(0, CLAIM_TOP).map((h) => (
                <tr key={h.name}>
                  <td className="max-w-64 px-3 py-2">
                    <Link href={`/klaim/${claimSlug(h.name)}`} className="block truncate font-medium hover:underline" title={h.name}>
                      {h.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <RiskBadge risk={riskOf(h.redFlags.length)} />
                  </td>
                  <td className="px-3 py-2">
                    <RuleTags rules={h.redFlags} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {num(h.flaggedClaims)} <span className="text-muted-foreground">dari {num(h.claims)}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">{formatRupiahShort(h.overpayment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Link href="/rumah-sakit?urut=risiko" className={cn(CARD, "transition-colors hover:bg-muted/40 lg:col-span-4")}>
        <h2 className={CARD_TITLE}>
          <span className={ICON_TILE}>
            <ShieldAlert />
          </span>
          Data klaim
        </h2>
        <dl className="grid grid-cols-2 gap-4">
          {[
            { label: "Klaim", value: num(analysis.claims), detail: `${num(analysis.hospitals.length)} rumah sakit` },
            { label: "RS terindikasi", value: num(indicated.length), detail: `dari ${num(analysis.hospitals.length)}` },
            { label: "Risiko tinggi", value: num(indicated.filter((h) => riskOf(h.redFlags.length) === "tinggi").length), detail: "3 indikasi atau lebih" },
            { label: "Potensi kelebihan bayar", value: formatRupiahShort(overpayment), detail: "dari RS terindikasi" },
          ].map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="text-2xl font-semibold tracking-tight tabular-nums">{f.value}</dd>
              <dd className="text-xs text-muted-foreground">{f.detail}</dd>
            </div>
          ))}
        </dl>
      </Link>

      <section className={cn(CARD, "lg:col-span-12")}>
        <h2 className={CARD_TITLE}>
          <span className={ICON_TILE}>
            <Building2 />
          </span>
          Klaim per loket
        </h2>
        <LoketTable lokets={analysis.lokets} />
      </section>
    </>
  );
}

function HeatRow({ label, cells }: { label: string; cells: { id: string; name: string; rows: number }[] }) {
  return (
    <>
      <span className="truncate pr-2 leading-9">{label}</span>
      {cells.map((cell) => (
        <span
          key={cell.id}
          title={`${cell.name} · ${label}: ${num(cell.rows)} baris`}
          className={cn("grid h-9 place-items-center rounded-md text-[11px] tabular-nums", heatOf(cell.rows).className, cell.rows >= 200 ? "text-white" : "text-foreground/70")}
        >
          {cell.rows > 0 ? num(cell.rows) : ""}
        </span>
      ))}
    </>
  );
}
