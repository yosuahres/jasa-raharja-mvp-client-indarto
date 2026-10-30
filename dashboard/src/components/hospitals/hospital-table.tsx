"use client";

import { Hospital, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";

import { CompareCheckbox, SelectionBar } from "@/components/compare-selection";
import { ColumnMenu } from "@/components/data-table/column-menu";
import { ColumnResizeHandle } from "@/components/data-table/column-resize-handle";
import { ColumnSettings } from "@/components/data-table/column-settings";
import { EmptyState, FilterEmptyState } from "@/components/data-table/empty-state";
import { type Facet, FilterPanel } from "@/components/data-table/filter-panel";
import { SortMenu, type SortState } from "@/components/data-table/sort-menu";
import { PAGE_SIZE_OPTIONS, TablePager } from "@/components/data-table/table-pager";
import { TableSearchInput } from "@/components/data-table/table-search-input";
import { FULL_PAGE, TOOLBAR } from "@/components/data-table/styles";
import { useColumnPrefs } from "@/components/data-table/use-column-prefs";
import { Excess, RiskBadge, RuleTags } from "@/components/claims/table";
import {
  COLUMNS,
  type ColumnId,
  compareText,
  type FilterId,
  type Filters,
  filterValuesOf,
  type HospitalQuery,
  type HospitalRow,
  isSortable,
  matches,
  NO_FILTERS,
  NOT_STATED,
  NUMERIC,
  NO_CLAIMS,
  NOT_INDICATED,
  QUERY_PARAMS,
  queryEntries,
  RISK_CHOICES,
  type SortKey,
  sortRows,
  STATUS_CHOICES,
  statusOf,
  TARIFF_DOT,
  TARIFF_LABEL,
  type TariffStatus,
  TIPE_DOT,
  TIPES,
  SHARE_CHOICES,
  type View,
  VIEW_DEFS,
} from "@/components/hospitals/hospital-list";
import { LinkRow } from "@/components/link-row";
import { RatingPill } from "@/components/rating";
import { TipeBadge } from "@/components/tier-badge";
import { RULES } from "@/lib/claims/analysis";
import { formatPercent, formatRupiahShort } from "@/lib/format";
import { cn } from "@/lib/utils";

// v5: a layout per view (Rujukan, Klaim); the single layout before them doesn't carry over.
const PREFS_KEY = "rumah-sakit:tabel:v5";
const CHECK_COL_WIDTH = 44;

const TH =
  "sticky top-0 z-10 overflow-hidden border-b border-r border-border bg-background px-4 py-1.5 text-left text-sm font-medium whitespace-nowrap text-foreground last:border-r-0";
const TD = "overflow-hidden border-b border-r border-border px-4 py-1.5 text-sm whitespace-nowrap text-foreground last:border-r-0";
// As in the CRM tables: every column but the name gets a faint purple, dropped while the row is ticked.
const TINTED_CELL = "bg-purple-500/[0.04] dark:bg-purple-400/[0.06] group-has-checked/row:bg-transparent dark:group-has-checked/row:bg-transparent";

const NOT_STATED_LABEL = "Tidak tercantum";

/** Each filter's choices, with how many of the rows have each. */
const facetsOf = (rows: HospitalRow[], view: View): (Facet & { id: FilterId })[] => {
  const counts = (id: FilterId) => {
    const map = new Map<string, number>();
    for (const row of rows) for (const value of filterValuesOf(id, row)) map.set(value, (map.get(value) ?? 0) + 1);
    return map;
  };
  // Values as the documents print them, alphabetical, with "not stated" last.
  const printed = (id: FilterId) => {
    const map = counts(id);
    const values = [...map.keys()].filter((v) => v !== NOT_STATED).sort(compareText);
    return [
      ...values.map((value) => ({ value, label: value, count: map.get(value) })),
      ...(map.has(NOT_STATED) ? [{ value: NOT_STATED, label: NOT_STATED_LABEL, count: map.get(NOT_STATED) }] : []),
    ];
  };
  const tipe = counts("tipe");
  const tarif = counts("tarif");
  const risk = counts("risiko");
  const indication = counts("indikasi");
  const vip = counts("vip");
  const gl = counts("gl");

  return [
    { id: "kota", label: "Kota", choices: printed("kota") },
    { id: "loket", label: "Loket", choices: printed("loket") },
    { id: "tipe", label: "Tipe", choices: TIPES.map((t) => ({ value: t, label: `Tipe ${t}`, dot: TIPE_DOT[t], count: tipe.get(t) ?? 0 })) },
    { id: "kepemilikan", label: "Kepemilikan", choices: printed("kepemilikan") },
    {
      id: "tarif",
      label: "Data tarif",
      choices: (Object.keys(TARIFF_LABEL) as TariffStatus[]).map((s) => ({
        value: s,
        label: TARIFF_LABEL[s],
        dot: TARIFF_DOT[s],
        count: tarif.get(s) ?? 0,
      })),
    },
    {
      id: "risiko",
      label: "Risiko klaim",
      // Indikasi Klaim lists only hospitals with an indication, so "none" and "no claims" can't be picked there.
      choices: RISK_CHOICES.filter((c) => view === "rujukan" || (c.value !== NOT_INDICATED && c.value !== NO_CLAIMS)).map((c) => ({
        ...c,
        count: risk.get(c.value) ?? 0,
      })),
    },
    { id: "indikasi", label: "Indikasi", choices: RULES.map((r) => ({ value: r.id, label: r.label, count: indication.get(r.id) ?? 0 })) },
    { id: "vip", label: "Kelas VIP", choices: SHARE_CHOICES.map((c) => ({ ...c, count: vip.get(c.value) ?? 0 })) },
    { id: "gl", label: "GL berulang", choices: SHARE_CHOICES.map((c) => ({ ...c, count: gl.get(c.value) ?? 0 })) },
  ];
};

/**
 * A hospital list (Rumah Sakit or Indikasi Klaim, by `view`): search, sort, filters and column settings
 * above a grid table, paged below. Rows come in the page's order. Search, filters and sort follow the
 * URL (`q`, `kota`, `loket`, `tipe`, `milik`, `tarif`, `risiko`, `urut`, …); column order, visibility and
 * widths are kept in this browser, per view. Render inside CompareSelectionProvider.
 */
export function HospitalTable({ view, rows, initial }: { view: View; rows: HospitalRow[]; initial: HospitalQuery }) {
  const [search, setSearch] = useState(initial.search);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [sort, setSort] = useState<SortState<SortKey> | null>(initial.sort);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
  const deferredSearch = useDeferredValue(search);

  const viewDef = VIEW_DEFS[view];
  const prefs = useColumnPrefs(`${PREFS_KEY}:${view}`, viewDef.columns, viewDef.layout);
  const allFacets = useMemo(() => facetsOf(rows, view), [rows, view]);
  const facets = useMemo(() => viewDef.filters.flatMap((id) => allFacets.filter((f) => f.id === id)), [allFacets, viewDef]);
  const shown = useMemo(
    () => sortRows(rows.filter((r) => matches(r, deferredSearch, filters)), sort, view),
    [rows, deferredSearch, filters, sort, view],
  );

  const visibleIds = useMemo(() => shown.map((r) => r.id), [shown]);

  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(() => shown.slice(currentPage * pageSize, (currentPage + 1) * pageSize), [shown, currentPage, pageSize]);

  // Keep the URL in step without asking the server again, so the view can be shared or reloaded, and
  // remember it in this browser for the next visit.
  useEffect(() => {
    const entries = queryEntries({ search, filters, sort });
    document.cookie = `${viewDef.cookie}=${encodeURIComponent(new URLSearchParams(entries).toString())}; path=/; max-age=31536000; samesite=lax`;
    const params = new URLSearchParams(window.location.search);
    for (const param of QUERY_PARAMS) params.delete(param);
    for (const [param, value] of entries) params.append(param, value);
    const query = params.toString();
    if (query !== window.location.search.replace(/^\?/, "")) {
      window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    }
  }, [viewDef, search, filters, sort]);

  // Any change to what is shown starts again from the first page.
  const changeSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };
  const changeFilter = (id: string, values: string[]) => {
    setFilters((current) => ({ ...current, [id]: values }));
    setPage(0);
  };
  const changeSort = (next: SortState<SortKey> | null) => {
    setSort(next);
    setPage(0);
  };
  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setPage(0);
  };
  const clearAll = () => {
    clearFilters();
    setSearch("");
  };

  const columnOf = (id: ColumnId) => COLUMNS.find((c) => c.id === id) ?? COLUMNS[0];
  const tableWidth = CHECK_COL_WIDTH + prefs.visibleIds.reduce((sum, id) => sum + prefs.widthOf(id), 0);

  if (rows.length === 0) {
    return (
      <div className={FULL_PAGE}>
        {view === "klaim" ? (
          <EmptyState className="flex-1" icon={ShieldCheck} title="Tidak ada indikasi" description="Belum ada rumah sakit dengan klaim terindikasi." />
        ) : (
          <EmptyState className="flex-1" icon={Hospital} title="Belum ada rumah sakit" description="Daftar rumah sakit masih kosong." />
        )}
      </div>
    );
  }

  return (
    <div className={FULL_PAGE}>
      <div className={TOOLBAR}>
        <TableSearchInput value={search} onChange={changeSearch} placeholder={viewDef.searchPlaceholder} label="Cari rumah sakit" />
        <SortMenu sort={sort} onChange={changeSort} options={viewDef.sorts} />
        <FilterPanel
          facets={facets}
          values={filters}
          onChange={changeFilter}
          onClear={clearFilters}
          description="Persempit daftar rumah sakit. Pilihan langsung diterapkan."
        />
        <ColumnSettings columns={viewDef.columns} layout={prefs.layout} onChange={prefs.setLayout} canReset={!prefs.isDefault} onReset={prefs.reset} />
        <div className="flex-1" />
        <RefreshButton />
      </div>

      {/* The rows scroll here, under the sticky header, between the toolbar and the pager. */}
      <div className="min-h-0 w-full flex-1 overflow-auto">
        <table
          className="w-full table-fixed border-separate border-spacing-0 text-sm"
          style={{ minWidth: tableWidth }}
        >
          <colgroup>
            <col style={{ width: CHECK_COL_WIDTH }} />
            {prefs.visibleIds.map((id, index) => (
              // The last column takes whatever room is left.
              <col key={id} style={index === prefs.visibleIds.length - 1 ? undefined : { width: prefs.widthOf(id) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky top-0 z-10 w-10 border-b border-border bg-background py-1.5 pr-0 pl-3">
                <span className="sr-only">Bandingkan</span>
              </th>
              {prefs.visibleIds.map((id) => {
                const column = columnOf(id);
                return (
                  <th key={id} className={TH}>
                    <ColumnMenu
                      label={column.label}
                      sortDir={sort?.key === id ? sort.dir : null}
                      onSort={isSortable(id) ? (dir) => changeSort(sort?.key === id && sort.dir === dir ? null : { key: id, dir }) : undefined}
                      onHide={column.required ? undefined : () => prefs.hide(id)}
                    />
                    <ColumnResizeHandle onResize={(width) => prefs.setWidth(id, width)} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <HospitalTableRow key={row.id} row={row} columns={prefs.visibleIds} href={hrefOf(view, row.id)} />
            ))}
          </tbody>
        </table>

        {shown.length === 0 && (
          <div className="sticky left-0 w-full">
            <FilterEmptyState
              title="Tidak ada rumah sakit yang cocok"
              description="Coba kata kunci lain atau longgarkan filter."
              onClear={clearAll}
            />
          </div>
        )}
      </div>

      <SelectionBar visibleIds={visibleIds} />
      <TablePager
        page={currentPage}
        pageSize={pageSize}
        total={shown.length}
        onPage={setPage}
        onPageSize={(size) => {
          setPageSize(size);
          setPage(0);
        }}
      />
    </div>
  );
}

/** The toolbar's last button, as in the CRM tables: load the list again from the server. */
function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      title="Muat ulang"
      aria-label="Muat ulang"
      className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
    </button>
  );
}

/** A row opens the hospital's page; from Indikasi Klaim, on its Klaim tab. */
const hrefOf = (view: View, id: string) => `/rumah-sakit/${id}${view === "klaim" ? "?tab=klaim" : ""}`;

// Memoised so dragging a column wider re-renders the header, not every row.
const HospitalTableRow = memo(function HospitalTableRow({ row, columns, href }: { row: HospitalRow; columns: ColumnId[]; href: string }) {
  return (
    <LinkRow
      href={href}
      className="group/row cursor-pointer border-0 transition-colors hover:bg-muted/40 has-checked:bg-blue-500/[0.06] has-[a:focus-visible]:bg-muted/40 dark:has-checked:bg-blue-400/[0.06]"
    >
      <td className="w-10 border-b border-border py-1.5 pr-0 pl-3 text-sm">
        <CompareCheckbox id={row.id} name={row.name} />
      </td>
      {columns.map((id) => (
        <td key={id} className={cn(TD, id !== "nama" && TINTED_CELL, NUMERIC.has(id) && "text-right tabular-nums")}>
          <HospitalCell column={id} row={row} href={href} />
        </td>
      ))}
    </LinkRow>
  );
});

const Missing = () => <span className="text-muted-foreground">—</span>;

function HospitalCell({ column, row, href }: { column: ColumnId; row: HospitalRow; href: string }) {
  switch (column) {
    case "nama":
      return (
        <Link
          href={href}
          title={row.name}
          // `truncate` clips to the line box, so keep the underline offset small enough to stay inside it.
          className="block truncate font-medium underline decoration-foreground/40 underline-offset-2 transition-colors outline-none hover:decoration-foreground focus-visible:decoration-foreground"
        >
          {row.name}
        </Link>
      );
    // Ratings show their level; the reason is the hover text, so a row stays one line.
    case "status": {
      const status = STATUS_CHOICES.find((c) => c.value === statusOf(row)) ?? STATUS_CHOICES[0];
      return (
        <span className="flex min-w-0 items-center gap-1.5" title={status.detail}>
          <span className={cn("size-2 shrink-0 rounded-full", status.dot)} />
          <span className="truncate">{status.label}</span>
        </span>
      );
    }
    // Without a tariff document there is nothing to rate.
    case "harga":
      if (row.tariff === "belum-ada") return <Missing />;
      return row.price ? (
        <span title={row.price.reason}>
          <RatingPill level={row.price.level} />
        </span>
      ) : (
        <RatingPill level={null} />
      );
    case "layanan":
      if (row.tariff === "belum-ada") return <Missing />;
      return row.services ? (
        <span title={row.services.reason}>
          <RatingPill level={row.services.level} />
        </span>
      ) : (
        <RatingPill level={null} />
      );
    case "tarif":
      return row.tariff === "belum-ada" ? (
        <span className="block truncate font-medium text-tier-c-ink">Belum ada data tarif</span>
      ) : (
        <span className="block truncate">
          {row.year ? `Tahun ${row.year}` : "Tahun tidak tercetak"}
          <span className="text-muted-foreground"> · versi {row.version}</span>
        </span>
      );
    case "tipe":
      return row.tipe ? <TipeBadge tipe={row.tipe} /> : <Missing />;
    case "kota":
      return row.city ? <span className="block truncate">{row.city}</span> : <Missing />;
    case "loket":
      return row.loket ? <span className="block truncate">{row.loket}</span> : <Missing />;
    case "kepemilikan":
      return row.ownership ? <span className="block truncate">{row.ownership}</span> : <Missing />;
    default:
      return <ClaimCell column={column} row={row} />;
  }
}

const days = (value: number) => `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })} hari`;

const truncated = (text: string | null) =>
  text ? (
    <span className="block truncate" title={text}>
      {text}
    </span>
  ) : (
    <Missing />
  );

/** The columns from the claim data; empty for a hospital the data doesn't have. */
function ClaimCell({ column, row }: { column: ColumnId; row: HospitalRow }) {
  const c = row.claims;
  if (!c) return <Missing />;
  switch (column) {
    case "risiko":
      return c.risk ? <RiskBadge risk={c.risk} /> : <span className="text-muted-foreground">Tidak terindikasi</span>;
    case "indikasi":
      return c.indications.length ? <RuleTags rules={c.indications} className="flex-nowrap overflow-hidden" /> : <Missing />;
    case "klaim":
      return c.claims.toLocaleString("id-ID");
    case "terindikasi":
      return c.flaggedClaims ? (
        <>
          {c.flaggedClaims.toLocaleString("id-ID")} <span className="text-muted-foreground">({formatPercent(c.flaggedClaims / c.claims)})</span>
        </>
      ) : (
        <Missing />
      );
    case "potensi":
      return c.overpayment > 0 ? <span className="font-medium">{formatRupiahShort(c.overpayment)}</span> : <Missing />;
    case "los":
      return c.avgLos === null ? <Missing /> : days(c.avgLos);
    case "biaya":
      return formatRupiahShort(c.paidAvg);
    case "selisih":
      return <Excess value={c.excessAvg} format={formatRupiahShort} />;
    case "berat":
      return formatPercent(c.severeShare);
    case "vip":
      return c.vipShare === null ? (
        <Missing />
      ) : (
        <span className={cn(c.vipHigh && "rounded bg-tier-c-soft px-1.5 py-0.5 font-medium text-tier-c-ink")}>{formatPercent(c.vipShare)}</span>
      );
    case "gl":
      return c.repeatShare === null ? (
        <Missing />
      ) : (
        <span className={cn(c.repeatHigh && "rounded bg-tier-c-soft px-1.5 py-0.5 font-medium text-tier-c-ink")}>{formatPercent(c.repeatShare)}</span>
      );
    case "cedera":
      return truncated(c.topDiagnosis);
    case "tindakan":
      return truncated(c.topSurgery);
    default:
      return <Missing />;
  }
}
