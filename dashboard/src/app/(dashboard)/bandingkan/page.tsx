import { ArrowRight, Check, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { HospitalPicker, type PickerOption } from "@/components/compare/hospital-picker";
import { UrlTreatmentField } from "@/components/compare/treatment-field";
import { RatingPill } from "@/components/rating";
import { TipeBadge } from "@/components/tier-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { compareHref } from "@/lib/compare";
import { findTreatments, getBookRowStats, getDataset, getTopTreatments, searchLines } from "@/lib/data/queries";
import type { Dataset, Hospital, Treatment } from "@/lib/data/types";
import { formatJuta, formatPercent, formatRange, joinFacts } from "@/lib/format";
import { allSummaries, fairPriceLevel, type HospitalSummary, rankForTreatment, summarize, type TreatmentMatch } from "@/lib/scoring";
import { bookYearLabel, type Completeness, dataCompleteness } from "@/lib/tariff-book";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Bandingkan Rumah Sakit",
  description: "Bandingkan tarif, layanan, dan fasilitas rumah sakit",
};

const STICKY_HEAD = "sticky top-0 z-20 bg-card shadow-[inset_0_-1px_0_var(--border)]";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The tindakan the URL names, so the field shows it as picked; a name no document prints still shows as typed. */
const currentTreatment = async (query: string, suggestions: Treatment[]): Promise<Treatment> => {
  const same = (t: Treatment) => t.name.toLowerCase() === query.toLowerCase();
  return suggestions.find(same) ?? (await findTreatments(query, 5)).find(same) ?? { key: query, name: query, hospitals: 0 };
};

/** What the picker needs of each hospital, in ranking order. */
const toOptions = (ranked: HospitalSummary[]): PickerOption[] =>
  ranked.map((s) => ({ id: s.hospital.id, name: s.hospital.name, city: s.hospital.city, tipe: s.tipe }));

/** Marks the best value in a row. Ties all win; a row where everyone is equal highlights nobody. */
const bestOf = (values: (number | null)[], prefer: "high" | "low") => {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return values.map(() => false);
  const target = prefer === "high" ? Math.max(...valid) : Math.min(...valid);
  if (valid.every((v) => v === target)) return values.map(() => false);
  return values.map((v) => v === target);
};

type Column = {
  hospital: Hospital;
  summary: HospitalSummary;
  /** Its row for the searched treatment; null without a search or when its document has none. */
  match: TreatmentMatch | null;
  completeness: Completeness;
};

export default async function ComparePage({ searchParams }: PageProps<"/bandingkan">) {
  const params = await searchParams;
  const [data, suggestions] = await Promise.all([getDataset(), getTopTreatments()]);
  const query = (first(params.q) ?? "").trim();
  const treatment = query ? await currentTreatment(query, suggestions) : null;
  const requested = [...new Set((first(params.rs) ?? "").split(",").map((id) => id.trim()))];
  const hospitals = requested
    .map((id) => data.hospitals.find((h) => h.id === id))
    .filter((h): h is Hospital => Boolean(h));
  const ids = hospitals.map((h) => h.id);

  // Matched against every hospital, so the median is the market's, not just these three's.
  const bookIds = data.hospitals.flatMap((h) => (h.tariffBook ? [h.tariffBook.id] : []));
  const matches = query ? rankForTreatment(await searchLines(query, bookIds), "", data) : [];

  const ranked = allSummaries(data).sort((a, b) => (a.placing?.rank ?? Infinity) - (b.placing?.rank ?? Infinity));
  const columns: Column[] = await Promise.all(
    hospitals.map(async (hospital) => {
      const rowStats = hospital.tariffBook ? await getBookRowStats(hospital.tariffBook.id) : null;
      return {
        hospital,
        summary: summarize(hospital, data),
        match: matches.find((m) => m.summary.hospital.id === hospital.id) ?? null,
        completeness: dataCompleteness(hospital, rowStats),
      };
    }),
  );

  return (
    // No title of its own: the app header names the page.
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8">

      {columns.length < 2 ? (
        <PickHospitals ranked={ranked} hospitals={hospitals} ids={ids} query={query} />
      ) : (
        <>
          {query && <Summary columns={columns} query={query} />}
          <CompareTable columns={columns} ranked={ranked} ids={ids} query={query} treatment={treatment} suggestions={suggestions} data={data} />
        </>
      )}
    </div>
  );
}

function PickHospitals({ ranked, hospitals, ids, query }: { ranked: HospitalSummary[]; hospitals: Hospital[]; ids: string[]; query: string }) {
  const badgeOf = (hospital: Hospital) => {
    const tipe = ranked.find((s) => s.hospital.id === hospital.id)?.tipe ?? null;
    return tipe ? <TipeBadge tipe={tipe} /> : <span className="text-xs text-muted-foreground">Tanpa tarif</span>;
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pilih rumah sakit</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada data</p>
        ) : (
          <div className="sm:max-w-md">
            <Suspense>
              <HospitalPicker options={toOptions(ranked)} ids={ids} query={query} autoFocus />
            </Suspense>
          </div>
        )}
        {hospitals.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {hospitals.map((hospital) => (
              <li key={hospital.id} className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{hospital.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{hospital.city || "—"}</span>
                </span>
                {badgeOf(hospital)}
                <Link
                  href={compareHref(
                    ids.filter((id) => id !== hospital.id),
                    query,
                  )}
                  scroll={false}
                  aria-label={`Hapus ${hospital.name} dari perbandingan`}
                  className="-mr-1 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          ranked.length > 0 && <p className="text-sm text-muted-foreground">Tabel perbandingan muncul setelah dua rumah sakit dipilih.</p>
        )}
        {hospitals.length === 1 && <p className="text-sm text-muted-foreground">Tambah satu lagi untuk membandingkan.</p>}
      </CardContent>
    </Card>
  );
}

function Summary({ columns, query }: { columns: Column[]; query: string }) {
  const matched = columns.map((c) => c.match).filter((m): m is TreatmentMatch => m !== null);
  const missing = columns.filter((c) => !c.match).map((c) => c.hospital.name);

  if (matched.length === 0) {
    return <p className="mb-4 rounded-xl border px-4 py-3 text-sm text-muted-foreground">Tidak ada tarif untuk &ldquo;{query}&rdquo;</p>;
  }

  const cheapest = matched.reduce((min, m) => (m.priceMid < min.priceMid ? m : min));
  const priciest = matched.reduce((max, m) => (m.priceMid > max.priceMid ? m : max));
  const saving = (priciest.priceMid - cheapest.priceMid) / priciest.priceMid;

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="text-pretty">
        <span className="font-semibold">{cheapest.summary.hospital.name}</span> paling murah untuk &ldquo;{query}&rdquo;
        {cheapest !== priciest && saving >= 0.005 && (
          <>
            , <span className="font-medium text-tier-a-ink">±{formatPercent(saving)} lebih murah</span> dari {priciest.summary.hospital.name}
          </>
        )}
        .{missing.length > 0 && <span className="text-muted-foreground"> {missing.join(" dan ")} tidak punya tarifnya.</span>}
      </p>
      <Link href={`/rekomendasi?q=${encodeURIComponent(query)}`} className="group inline-flex shrink-0 items-center gap-1 text-muted-foreground hover:text-foreground">
        Semua rumah sakit <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

function CompareTable({
  columns,
  ranked,
  ids,
  query,
  treatment,
  suggestions,
  data,
}: {
  columns: Column[];
  ranked: HospitalSummary[];
  ids: string[];
  query: string;
  treatment: Treatment | null;
  suggestions: Treatment[];
  data: Dataset;
}) {
  const median = columns.find((c) => c.match)?.match?.medianPrice ?? null;
  // Label column, one per hospital, and the add slot.
  const span = columns.length + 2;

  return (
    <div className="rounded-xl border bg-card">
      {/* The table scrolls inside its own box, sideways once the columns outgrow it, with both sticky edges. */}
      <div className="max-h-[85svh] overflow-auto overscroll-x-contain rounded-xl">
        {/* Separate borders so the corner cells can round off with the card; row lines are drawn per cell. */}
        <table
          className={cn(
            "w-max min-w-full table-fixed border-separate border-spacing-0 text-sm",
            "[&_tbody_tr:not([data-section])>*]:border-b [&_tbody_tr:last-child>*]:border-b-0",
            "[&_tbody_tr:last-child>*:first-child]:rounded-bl-xl [&_tbody_tr:last-child>*:last-child]:rounded-br-xl",
          )}
        >
          <colgroup>
            <col className="w-56 sm:w-64" />
            {columns.map((c) => (
              <col key={c.hospital.id} className="w-64" />
            ))}
            <col className="w-56" />
          </colgroup>
          <thead>
            <tr>
              <TableHead className={cn(STICKY_HEAD, "left-0 z-25 rounded-tl-xl pl-4")}>
                <span className="sr-only">Kriteria</span>
              </TableHead>
              {columns.map((c) => (
                <HospitalHeader key={c.hospital.id} column={c} ids={ids} query={query} />
              ))}
              <TableHead className={cn(STICKY_HEAD, "h-auto rounded-tr-xl py-3 align-top font-normal whitespace-normal")}>
                <div className="rounded-lg border border-dashed p-2">
                  <Suspense>
                    <HospitalPicker options={toOptions(ranked)} ids={ids} query={query} compact />
                  </Suspense>
                </div>
              </TableHead>
            </tr>
          </thead>
          <TableBody>
            <Section title="Tarif tindakan" span={span} />
            <TreatmentRow
              columns={columns}
              query={query}
              hint={median === null ? undefined : `Median ${formatJuta(median)}`}
              best={bestOf(
                columns.map((c) => c.match?.priceMid ?? null),
                "low",
              )}
              render={(c) =>
                c.match ? (
                  <span className="grid justify-items-start gap-1.5">
                    <span className="font-medium tabular-nums">{formatRange(c.match.line.priceMin, c.match.line.priceMax)}</span>
                    <RatingPill level={fairPriceLevel(c.match.savingVsMedian)} />
                  </span>
                ) : (
                  <Muted>Tidak ada tarif</Muted>
                )
              }
            >
              <Suspense>
                <UrlTreatmentField value={treatment} suggestions={suggestions} />
              </Suspense>
            </TreatmentRow>
            {query && (
              <>
                <CompareRow
                  label="Baris di dokumen"
                  columns={columns}
                  render={(c) =>
                    c.match ? (
                      <span>
                        {c.match.line.rawName}
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          hal. {c.match.line.page}
                          {c.match.otherRows > 0 && ` · ${c.match.otherRows} baris lain cocok`}
                        </span>
                      </span>
                    ) : (
                      <Muted>—</Muted>
                    )
                  }
                />
              </>
            )}

            <Section title="Penilaian" span={span} />
            <CompareRow
              label="Harga"
              hint="Dibanding RS lain, pada layanan yang sama"
              columns={columns}
              render={(c) => (
                <span>
                  <RatingPill level={c.summary.price?.level ?? null} />
                  {c.summary.price && <span className="block text-xs text-muted-foreground">{c.summary.price.reason}</span>}
                </span>
              )}
            />
            <CompareRow
              label="Layanan"
              columns={columns}
              render={(c) => (
                <span>
                  <RatingPill level={c.summary.services?.level ?? null} />
                  {c.summary.services && <span className="block text-xs text-muted-foreground">{c.summary.services.reason}</span>}
                </span>
              )}
            />
            {columns[0].summary.parameters.map((p, index) => (
              <CompareRow
                key={p.key}
                label={p.label}
                hint={`Bobot ${formatPercent(p.weight)} dari skor layanan`}
                columns={columns}
                best={bestOf(
                  columns.map((c) => c.summary.parameters[index].score),
                  "high",
                )}
                render={(c) => <Score value={c.summary.parameters[index].score} detail={c.summary.parameters[index].detail} />}
              />
            ))}
            <CompareRow
              label="Skor layanan"
              hint="Keempat parameter, menurut bobotnya"
              columns={columns}
              best={bestOf(
                columns.map((c) => c.summary.servicesScore),
                "high",
              )}
              render={(c) => <Score value={c.summary.servicesScore} />}
            />

            <Section title="Profil" span={span} />
            <CompareRow label="Kepemilikan" columns={columns} render={(c) => c.hospital.ownership ?? "—"} />
            <CompareRow label="Kota" columns={columns} render={(c) => joinFacts(c.hospital.city, c.hospital.province) || "—"} />
            <CompareRow
              label="Loket Jasa Raharja"
              columns={columns}
              render={(c) =>
                c.hospital.jasaRaharja ? (
                  <span>
                    {c.hospital.jasaRaharja.loketName}
                    <span className="block text-xs text-muted-foreground tabular-nums">kode RS {c.hospital.jasaRaharja.code}</span>
                  </span>
                ) : (
                  <Muted>Belum terhubung</Muted>
                )
              }
            />

            <Section title="Fasilitas" span={span} />
            {data.catalog.facilities.map((f) => (
              <CompareRow
                key={f.id}
                label={f.name}
                columns={columns}
                render={(c) => {
                  const present = c.hospital.facilities.some((x) => x.facilityId === f.id);
                  return <Presence present={present} detail={present ? "Ada" : "Tidak ada"} />;
                }}
              />
            ))}

            <Section title="Tenaga medis" span={span} />
            {data.catalog.specialties.map((s) => (
              <CompareRow
                key={s.id}
                label={s.name}
                columns={columns}
                render={(c) => {
                  const present = c.hospital.staff.some((x) => x.specialtyId === s.id);
                  return <Presence present={present} detail={present ? "Ada" : "Tidak ada"} />;
                }}
              />
            ))}

            <Section title="Data" span={span} />
            <CompareRow
              label="Data tarif"
              columns={columns}
              render={(c) =>
                c.hospital.tariffBook ? (
                  <span>
                    Versi {c.hospital.tariffBook.version}
                    <span className="block text-xs text-muted-foreground">{bookYearLabel(c.hospital.tariffBook)}</span>
                  </span>
                ) : (
                  <Muted>Belum ada data tarif</Muted>
                )
              }
            />
            {columns[0].completeness.map((item, index) => (
              <CompareRow
                key={item.label}
                label={item.label}
                columns={columns}
                render={(c) => {
                  const own = c.completeness[index];
                  return <Presence present={own.complete} detail={own.detail} />;
                }}
              />
            ))}
          </TableBody>
        </table>
      </div>
    </div>
  );
}

function HospitalHeader({ column: c, ids, query }: { column: Column; ids: string[]; query: string }) {
  return (
    <TableHead className={cn(STICKY_HEAD, "h-auto py-3 align-top whitespace-normal last:rounded-tr-xl")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/rumah-sakit/${c.hospital.id}`} className="font-semibold hover:underline">
            {c.hospital.name}
          </Link>
          <p className="text-xs font-normal text-muted-foreground">{c.hospital.city}</p>
        </div>
        <Link
          href={compareHref(
            ids.filter((id) => id !== c.hospital.id),
            query,
          )}
          scroll={false}
          aria-label={`Hapus ${c.hospital.name} dari perbandingan`}
          className="-mt-1 -mr-1 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </Link>
      </div>
      <div className="mt-2">
        {c.summary.tipe ? <TipeBadge tipe={c.summary.tipe} /> : <span className="text-xs font-normal text-muted-foreground">Tanpa tarif</span>}
      </div>
    </TableHead>
  );
}

/** The tindakan row: the picker sits in the label cell, and its prices (or a hint to pick one) fill the rest. */
function TreatmentRow({
  columns,
  query,
  hint,
  best,
  render,
  children,
}: {
  columns: Column[];
  query: string;
  hint?: React.ReactNode;
  best: boolean[];
  render: (column: Column, index: number) => React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableHead
        scope="row"
        className="sticky left-0 z-10 h-auto bg-card py-2.5 pr-3 pl-4 align-top font-normal whitespace-normal shadow-[inset_-1px_0_0_var(--border)]"
      >
        {children}
        {query && hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
      </TableHead>
      {query ? (
        <>
          {columns.map((c, index) => (
            <TableCell key={c.hospital.id} className={cn("py-2.5 align-top whitespace-normal", best[index] && "bg-tier-a-soft/70")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">{render(c, index)}</div>
                {best[index] && (
                  <span className="shrink-0 text-tier-a-ink">
                    <Check className="size-4" />
                    <span className="sr-only">Terbaik</span>
                  </span>
                )}
              </div>
            </TableCell>
          ))}
          <TableCell />
        </>
      ) : (
        <TableCell colSpan={columns.length + 1} className="py-2.5 align-middle text-sm text-muted-foreground">
          Pilih tindakan untuk membandingkan tarifnya.
        </TableCell>
      )}
    </TableRow>
  );
}

function Section({ title, span }: { title: string; span: number }) {
  return (
    <TableRow data-section className="bg-muted/50 hover:bg-muted/50">
      <TableCell colSpan={span} className="p-0">
        {/* Sticky so the section title stays in view while the table scrolls sideways. */}
        <div className="sticky left-0 inline-flex items-baseline gap-2 px-4 pt-3 pb-1.5">
          <span className="text-xs font-semibold tracking-wide uppercase">{title}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CompareRow({
  label,
  hint,
  columns,
  best,
  render,
}: {
  label: string;
  hint?: React.ReactNode;
  columns: Column[];
  best?: boolean[];
  render: (column: Column, index: number) => React.ReactNode;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableHead
        scope="row"
        className="sticky left-0 z-10 h-auto bg-card py-2.5 pl-4 align-top font-normal whitespace-normal shadow-[inset_-1px_0_0_var(--border)]"
      >
        <span className="text-sm">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </TableHead>
      {columns.map((c, index) => (
        <TableCell key={c.hospital.id} className={cn("py-2.5 align-top whitespace-normal", best?.[index] && "bg-tier-a-soft/70")}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">{render(c, index)}</div>
            {best?.[index] && (
              <span className="shrink-0 text-tier-a-ink">
                <Check className="size-4" />
                <span className="sr-only">Terbaik</span>
              </span>
            )}
          </div>
        </TableCell>
      ))}
      <TableCell />
    </TableRow>
  );
}

function Presence({ present, detail, critical = false }: { present: boolean; detail?: string; critical?: boolean }) {
  return (
    <span className="flex items-start gap-2">
      {present ? (
        <Check className="mt-0.5 size-4 shrink-0 text-tier-a-ink" />
      ) : (
        <X className={cn("mt-0.5 size-4 shrink-0", critical ? "text-tier-c-ink" : "text-muted-foreground/60")} />
      )}
      <span className={cn("text-sm", !present && (critical ? "font-medium text-tier-c-ink" : "text-muted-foreground"))}>
        {detail}
      </span>
    </span>
  );
}

/** A 0–100 score, with what it counts under it. */
function Score({ value, detail }: { value: number; detail?: string }) {
  return (
    <span>
      <span className="font-medium tabular-nums">{Math.round(value)}</span>
      <span className="text-xs text-muted-foreground"> / 100</span>
      {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
    </span>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
