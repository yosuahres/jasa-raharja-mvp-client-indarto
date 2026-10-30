import type { SortState } from "@/components/data-table/sort-menu";
import type { ColumnDef, ColumnLayout } from "@/components/data-table/use-column-prefs";
import { type Risk, RULES, type RuleId } from "@/lib/claims/analysis";
import type { Hospital, Tipe } from "@/lib/data/types";
import type { PriceLevel, ServiceLevel } from "@/lib/scoring";

// The hospital list's rows, columns, filters and sorts. No React here, so the page can read the URL with it too.

export type TariffStatus = "ada" | "belum-ada";

/** A hospital's figures in Jasa Raharja's claim data. */
export type ClaimFigures = {
  risk: Risk | null;
  indications: RuleId[];
  claims: number;
  flaggedClaims: number;
  overpayment: number;
  avgLos: number | null;
  paidAvg: number;
  excessAvg: number;
  severeShare: number;
  vipShare: number | null;
  vipHigh: boolean;
  /** Share of its named victims with more than one GL; null with too few victims to judge. */
  repeatShare: number | null;
  repeatHigh: boolean;
  topDiagnosis: string | null;
  topSurgery: string | null;
};

/** One hospital in the list: plain data, small enough to send to the browser. It may have a tariff document, claims, both, or neither. */
export type HospitalRow = {
  id: string;
  name: string;
  /** Empty when the document doesn't print it. */
  city: string;
  ownership: Hospital["ownership"];
  /** The Jasa Raharja office that handles its claims; empty until linked to the list. */
  loket: string;
  tipe: Tipe | null;
  /** `ratio` is its prices against other hospitals' median: lower is cheaper. */
  price: { level: PriceLevel; reason: string; ratio: number } | null;
  /** `score` 0–100 is what the level comes from: higher offers more. Null without a tariff document to rate. */
  services: { level: ServiceLevel; reason: string; score: number } | null;
  tariff: TariffStatus;
  /** The year its document prints; null without a document or a printed year. */
  year: number | null;
  version: string | null;
  /** Null when the claim data doesn't have it (or none is uploaded). */
  claims: ClaimFigures | null;
};

// ------------------------------------------------------------------ columns

export type ColumnId =
  | "nama"
  | "status"
  | "kota"
  | "loket"
  | "kepemilikan"
  | "harga"
  | "layanan"
  | "tarif"
  | "tipe"
  | "risiko"
  | "indikasi"
  | "klaim"
  | "terindikasi"
  | "potensi"
  | "los"
  | "biaya"
  | "selisih"
  | "berat"
  | "vip"
  | "gl"
  | "cedera"
  | "tindakan";

// One value per cell, one line per row, every field its own column — the CRM tables' grid.
export const COLUMNS: ColumnDef<ColumnId>[] = [
  { id: "nama", label: "Rumah sakit", required: true, width: 260 },
  { id: "status", label: "Status data", width: 150 },
  { id: "kota", label: "Kota", width: 150 },
  { id: "loket", label: "Loket", width: 220 },
  { id: "kepemilikan", label: "Kepemilikan", width: 140 },
  { id: "tipe", label: "Tipe", width: 100 },
  { id: "harga", label: "Harga", width: 120 },
  { id: "layanan", label: "Layanan", width: 120 },
  { id: "tarif", label: "Data tarif", width: 200 },
  { id: "risiko", label: "Risiko klaim", width: 120 },
  { id: "indikasi", label: "Indikasi", width: 300 },
  { id: "klaim", label: "Klaim", width: 90 },
  { id: "terindikasi", label: "Klaim terindikasi", width: 150 },
  { id: "potensi", label: "Potensi kelebihan bayar", width: 190 },
  { id: "los", label: "LOS rata-rata", width: 120 },
  { id: "biaya", label: "Rata-rata dibayar", width: 150 },
  { id: "selisih", label: "Selisih vs median", width: 150 },
  { id: "berat", label: "Cedera berat", width: 120 },
  { id: "vip", label: "Kelas VIP", width: 100 },
  { id: "gl", label: "GL berulang", width: 120 },
  { id: "cedera", label: "Cedera terbanyak", width: 260 },
  { id: "tindakan", label: "Tindakan operasi terbanyak", width: 280 },
];

// ------------------------------------------------------------------ views

/**
 * The same table on two pages, for two jobs. Rumah Sakit (`rujukan`) lists every hospital, to find one to
 * refer to; Indikasi Klaim (`klaim`) lists only the hospitals whose claims have an indication, worst
 * first, to check. Each shows only its own columns, filters and sorts; more columns are in Kolom.
 */
export type View = "rujukan" | "klaim";

type ViewDef = {
  /** The cookie that keeps the page's last search, filters and sort. */
  cookie: string;
  /** Every column the view offers, in their first order. */
  columns: ColumnDef<ColumnId>[];
  layout: ColumnLayout<ColumnId>;
  filters: FilterId[];
  sorts: { value: SortKey; label: string }[];
  searchPlaceholder: string;
};

const viewColumns = (ids: ColumnId[]) => ids.map((id) => COLUMNS.find((c) => c.id === id) ?? COLUMNS[0]);

const viewLayout = (ids: ColumnId[], shown: ColumnId[]): ColumnLayout<ColumnId> => ({
  order: ids,
  visible: Object.fromEntries(COLUMNS.map((c) => [c.id, shown.includes(c.id)])) as Record<ColumnId, boolean>,
});

// Rumah Sakit offers every column (the claim ones off until asked for); Indikasi Klaim only the claim ones.
const RUJUKAN_COLUMNS: ColumnId[] = COLUMNS.map((c) => c.id);
const KLAIM_COLUMNS: ColumnId[] = [
  "nama",
  "loket",
  "kota",
  "risiko",
  "indikasi",
  "potensi",
  "terindikasi",
  "klaim",
  "biaya",
  "selisih",
  "los",
  "berat",
  "vip",
  "gl",
  "cedera",
  "tindakan",
];

// ------------------------------------------------------------------ filters

export type FilterId = "kota" | "loket" | "tipe" | "kepemilikan" | "tarif" | "risiko" | "indikasi" | "vip" | "gl";

/** Ticked values per filter; an empty list doesn't filter. */
export type Filters = Record<FilterId, string[]>;

export const FILTER_IDS: FilterId[] = ["kota", "loket", "tipe", "kepemilikan", "tarif", "risiko", "indikasi", "vip", "gl"];

export const NO_FILTERS: Filters = { kota: [], loket: [], tipe: [], kepemilikan: [], tarif: [], risiko: [], indikasi: [], vip: [], gl: [] };

/** The filters a view has, the others cleared: a link can't leave a filter on that the page doesn't show. */
export const filtersFor = (view: View, filters: Filters): Filters =>
  Object.fromEntries(FILTER_IDS.map((id) => [id, VIEW_DEFS[view].filters.includes(id) ? filters[id] : []])) as Filters;

/** What data the app has on a hospital: its tariff document, Jasa Raharja's claims, both, or neither. */
export type DataStatus = "lengkap" | "tanpa-klaim" | "tanpa-tarif" | "kosong";

export const STATUS_CHOICES: { value: DataStatus; label: string; detail: string; dot: string }[] = [
  { value: "lengkap", label: "Lengkap", detail: "Ada data tarif dan data klaim", dot: "bg-tier-a" },
  { value: "tanpa-klaim", label: "Tanpa data klaim", detail: "Ada data tarif, belum ada di data klaim", dot: "bg-tier-b" },
  { value: "tanpa-tarif", label: "Tanpa data tarif", detail: "Ada di data klaim, belum ada dokumen tarif", dot: "bg-amber-500" },
  { value: "kosong", label: "Belum ada data", detail: "Belum ada data tarif maupun klaim", dot: "bg-muted-foreground/50" },
];

export const statusOf = (row: HospitalRow): DataStatus =>
  row.tariff === "ada" ? (row.claims ? "lengkap" : "tanpa-klaim") : row.claims ? "tanpa-tarif" : "kosong";

/** The value for "the document doesn't say" in the Kota and Kepemilikan filters. */
export const NOT_STATED = "-";

export const TIPES: Tipe[] = ["A", "B", "C", "D"];

export const TIPE_DOT: Record<Tipe, string> = { A: "bg-tier-a", B: "bg-tier-b", C: "bg-tier-c", D: "bg-muted-foreground/50" };

export const TARIFF_LABEL: Record<TariffStatus, string> = { ada: "Ada", "belum-ada": "Belum ada" };

export const TARIFF_DOT: Record<TariffStatus, string> = {
  ada: "bg-tier-a",
  "belum-ada": "bg-muted-foreground/50",
};

/** The Risiko filter's value for a hospital without an indication, and for one not in the claim data. */
export const NOT_INDICATED = "tidak";
export const NO_CLAIMS = "tanpa-klaim";

export const RISK_CHOICES: { value: string; label: string; dot: string }[] = [
  { value: "tinggi", label: "Tinggi", dot: "bg-tier-c" },
  { value: "sedang", label: "Sedang", dot: "bg-amber-500" },
  { value: "rendah", label: "Rendah", dot: "bg-muted-foreground/50" },
  { value: NOT_INDICATED, label: "Tidak terindikasi", dot: "bg-tier-a" },
  { value: NO_CLAIMS, label: "Tidak ada data klaim", dot: "bg-border" },
];

/** The Kelas VIP and GL berulang filters: whether the hospital's share stands out. */
export const SHARE_CHOICES = [
  { value: "tinggi", label: "Tinggi" },
  { value: "wajar", label: "Wajar" },
];

/**
 * "LOKET KANTOR CABANG MADIUN" and "LOKET CABANG MADIUN" → "CABANG MADIUN": Jasa Raharja's list and its
 * claim export name the same office differently.
 */
export const loketLabel = (loket: string) => loket.replace(/^LOKET\s+/i, "").replace(/^KANTOR\s+/i, "").trim();

/** A row's values for a filter; it passes when any of them is ticked. */
const FILTER_VALUES: Record<FilterId, (row: HospitalRow) => string[]> = {
  kota: (r) => [r.city || NOT_STATED],
  loket: (r) => [r.loket || NOT_STATED],
  tipe: (r) => [r.tipe ?? ""],
  kepemilikan: (r) => [r.ownership ?? NOT_STATED],
  tarif: (r) => [r.tariff],
  risiko: (r) => [r.claims ? (r.claims.risk ?? NOT_INDICATED) : NO_CLAIMS],
  indikasi: (r) => r.claims?.indications ?? [],
  vip: (r) => (r.claims?.vipShare == null ? [] : [r.claims.vipHigh ? "tinggi" : "wajar"]),
  gl: (r) => (r.claims?.repeatShare == null ? [] : [r.claims.repeatHigh ? "tinggi" : "wajar"]),
};

export const filterValuesOf = (filter: FilterId, row: HospitalRow) => FILTER_VALUES[filter](row);

export const countActiveFilters = (filters: Filters) => FILTER_IDS.filter((id) => filters[id].length > 0).length;

export const matches = (row: HospitalRow, search: string, filters: Filters) => {
  const query = search.trim().toLowerCase();
  if (query && !`${row.name} ${row.city} ${row.loket}`.toLowerCase().includes(query)) return false;
  return FILTER_IDS.every((id) => filters[id].length === 0 || FILTER_VALUES[id](row).some((v) => filters[id].includes(v)));
};

// ------------------------------------------------------------------ sorting

export type SortKey = Exclude<ColumnId, "indikasi" | "cedera" | "tindakan">;

export const isSortable = (id: ColumnId): id is SortKey => SORT_OPTIONS.some((o) => o.value === id);

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "nama", label: "Nama" },
  { value: "status", label: "Status data" },
  { value: "kota", label: "Kota" },
  { value: "loket", label: "Loket" },
  { value: "tipe", label: "Tipe" },
  { value: "harga", label: "Harga" },
  { value: "layanan", label: "Layanan" },
  { value: "tarif", label: "Data tarif" },
  { value: "kepemilikan", label: "Kepemilikan" },
  { value: "risiko", label: "Risiko klaim" },
  { value: "potensi", label: "Potensi kelebihan bayar" },
  { value: "klaim", label: "Klaim" },
  { value: "terindikasi", label: "Klaim terindikasi" },
  { value: "biaya", label: "Rata-rata dibayar" },
  { value: "selisih", label: "Selisih vs median" },
  { value: "los", label: "LOS rata-rata" },
  { value: "berat", label: "Cedera berat" },
  { value: "vip", label: "Kelas VIP" },
  { value: "gl", label: "GL berulang" },
];

const sortsOf = (ids: SortKey[]) => ids.map((id) => SORT_OPTIONS.find((o) => o.value === id) ?? SORT_OPTIONS[0]);

export const VIEW_DEFS: Record<View, ViewDef> = {
  rujukan: {
    cookie: "rumah-sakit-tabel",
    columns: viewColumns(RUJUKAN_COLUMNS),
    layout: viewLayout(RUJUKAN_COLUMNS, ["nama", "kota", "tipe", "harga", "layanan"]),
    filters: ["kota", "tipe", "kepemilikan", "tarif", "loket"],
    sorts: SORT_OPTIONS,
    searchPlaceholder: "Cari nama atau kota",
  },
  klaim: {
    cookie: "indikasi-klaim-tabel",
    columns: viewColumns(KLAIM_COLUMNS),
    layout: viewLayout(KLAIM_COLUMNS, ["nama", "loket", "risiko", "indikasi", "potensi"]),
    filters: ["loket", "kota", "risiko", "indikasi", "vip", "gl"],
    sorts: sortsOf(["nama", "loket", "kota", "risiko", "potensi", "terindikasi", "klaim", "biaya", "selisih", "los", "berat", "vip", "gl"]),
    searchPlaceholder: "Cari nama, kota, atau loket",
  },
};

/** Numbers line up on the right. */
export const NUMERIC: ReadonlySet<ColumnId> = new Set(["klaim", "terindikasi", "potensi", "los", "biaya", "selisih", "berat", "vip", "gl"]);

/** A sort the view offers; another view's sort is dropped. */
export const sortFor = (view: View, sort: SortState<SortKey> | null) =>
  sort && VIEW_DEFS[view].sorts.some((o) => o.value === sort.key) ? sort : null;

const RISK_ORDER: Record<Risk, number> = { tinggi: 0, sedang: 1, rendah: 2 };

const TIPE_ORDER: Record<Tipe, number> = { A: 0, B: 1, C: 2, D: 3 };

// Ascending is best first where there is a best: cheapest Harga, most complete Layanan, Tipe A; for the
// claims, most worrying first: highest risk (then largest potential overpayment), largest amounts and shares.
const STATUS_ORDER: Record<DataStatus, number> = { lengkap: 0, "tanpa-klaim": 1, "tanpa-tarif": 2, kosong: 3 };

const SORT_VALUE: Record<SortKey, (row: HospitalRow) => string | number | null> = {
  nama: (r) => r.name,
  status: (r) => STATUS_ORDER[statusOf(r)],
  kota: (r) => r.city || null,
  loket: (r) => r.loket || null,
  tipe: (r) => (r.tipe ? TIPE_ORDER[r.tipe] : null),
  harga: (r) => r.price?.ratio ?? null,
  layanan: (r) => (r.services ? -r.services.score : null),
  tarif: (r) => r.year,
  kepemilikan: (r) => r.ownership,
  risiko: (r) => (r.claims?.risk ? RISK_ORDER[r.claims.risk] * 1e13 - r.claims.overpayment : null),
  potensi: (r) => (r.claims?.overpayment ? -r.claims.overpayment : null),
  klaim: (r) => (r.claims ? -r.claims.claims : null),
  terindikasi: (r) => (r.claims ? -r.claims.flaggedClaims : null),
  biaya: (r) => (r.claims ? -r.claims.paidAvg : null),
  selisih: (r) => (r.claims ? -r.claims.excessAvg : null),
  los: (r) => (r.claims?.avgLos == null ? null : -r.claims.avgLos),
  berat: (r) => (r.claims ? -r.claims.severeShare : null),
  vip: (r) => (r.claims?.vipShare == null ? null : -r.claims.vipShare),
  gl: (r) => (r.claims?.repeatShare == null ? null : -r.claims.repeatShare),
};

/** Indonesian alphabetical order, ignoring case and accents, with numbers by value. */
export const compareText = new Intl.Collator("id", { sensitivity: "base", numeric: true }).compare;

/** Most indications first, then the largest potential overpayment, then the most claims; not in the claim data last. */
const byClaimRisk = (a: HospitalRow, b: HospitalRow) =>
  (b.claims?.indications.length ?? -1) - (a.claims?.indications.length ?? -1) ||
  (b.claims?.overpayment ?? 0) - (a.claims?.overpayment ?? 0) ||
  (b.claims?.claims ?? 0) - (a.claims?.claims ?? 0);

/**
 * Sorted copy of `rows`. Unknown values (no price yet, no date) go last either way. Ties keep the
 * order the rows came in, which is the ranking. Without a sort, Rujukan keeps the ranking and Klaim
 * puts the most worrying claims first.
 */
export const sortRows = (rows: HospitalRow[], sort: SortState<SortKey> | null, view: View) => {
  if (!sort) return view === "klaim" ? [...rows].sort(byClaimRisk) : rows;
  const value = SORT_VALUE[sort.key];
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    const order = typeof x === "number" && typeof y === "number" ? x - y : compareText(String(x), String(y));
    return order * sign;
  });
};

// ------------------------------------------------------------------ the URL

/** Search, filters and sort as the URL carries them, so a filtered list can be shared. */
export type HospitalQuery = { search: string; filters: Filters; sort: SortState<SortKey> | null };

const PARAM: Record<FilterId, string> = {
  kota: "kota",
  loket: "loket",
  tipe: "tipe",
  kepemilikan: "milik",
  tarif: "tarif",
  risiko: "risiko",
  indikasi: "indikasi",
  vip: "vip",
  gl: "gl",
};

const ALLOWED: Partial<Record<FilterId, readonly string[]>> = {
  tipe: TIPES,
  tarif: ["ada", "belum-ada"],
  risiko: RISK_CHOICES.map((c) => c.value),
  indikasi: RULES.map((r) => r.id),
  vip: SHARE_CHOICES.map((c) => c.value),
  gl: SHARE_CHOICES.map((c) => c.value),
};

/** Our params, to clear before writing them again. */
export const QUERY_PARAMS = ["q", "urut", ...Object.values(PARAM)];

/** The view's search, filters and sort; `getAll` returns every value of a param, like `URLSearchParams.getAll`. */
export const parseQuery = (view: View, getAll: (param: string) => string[]): HospitalQuery => {
  const filters = Object.fromEntries(
    FILTER_IDS.map((id) => {
      // Other pages link a loket by its full name ("LOKET CABANG MADIUN").
      const values = [...new Set(getAll(PARAM[id]).filter(Boolean).map((v) => (id === "loket" ? loketLabel(v) : v)))];
      const allowed = ALLOWED[id];
      const valid = allowed ? values.filter((v) => allowed.includes(v)) : values;
      return [id, valid];
    }),
  ) as Filters;

  // "harga" sorts ascending, "-harga" descending.
  const urut = getAll("urut")[0] ?? "";
  const key = urut.replace(/^-/, "");
  const sort: SortState<SortKey> | null = SORT_OPTIONS.some((o) => o.value === key)
    ? { key: key as SortKey, dir: urut.startsWith("-") ? "desc" : "asc" }
    : null;

  return { search: getAll("q")[0] ?? "", filters: filtersFor(view, filters), sort: sortFor(view, sort) };
};

// Each view keeps its last search, filters and sort in this browser (VIEW_DEFS[view].cookie), so coming
// back to the page from the sidebar finds them as they were. A cookie rather than localStorage so the
// server reads it and the table opens already filtered. A link that carries its own params wins over it.

export const queryEntries = ({ search, filters, sort }: HospitalQuery): [string, string][] => [
  ...(search.trim() ? [["q", search.trim()] as [string, string]] : []),
  ...FILTER_IDS.flatMap((id) => filters[id].map((v): [string, string] => [PARAM[id], v])),
  ...(sort ? [["urut", `${sort.dir === "desc" ? "-" : ""}${sort.key}`] as [string, string]] : []),
];
