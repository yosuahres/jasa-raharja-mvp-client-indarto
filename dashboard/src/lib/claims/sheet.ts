/** The claim export's columns, as its header prints them, in the order a ClaimRow holds them. */
export const CLAIM_COLUMNS = [
  "ID Jaminan",
  "Nama Korban",
  "LOS",
  "Jenis Rawatan",
  "Nama Rumah Sakit",
  "Diagnosa Cedera",
  "Kategori Cedera",
  "Tindakan Operasi",
  "Deskripsi Tindakan",
  "Kelas Kamar",
  "Nilai Klaim Diajukan",
  "Nilai Klaim Dibayarkan",
  "Wilayah",
  "Loket",
] as const;

/** Most rows one server call takes; the browser sends the sheet in chunks of this size. */
export const CLAIM_CHUNK = 1000;

/**
 * One claim as it travels from the browser to the server: a tuple in CLAIM_COLUMNS order, which is
 * a third the size of an object per row (the 1 MB limit on a server action's body sets the chunk size).
 */
export type ClaimRow = [
  guaranteeId: string,
  victim: string | null,
  los: number | null,
  careType: string | null,
  hospital: string,
  diagnosis: string | null,
  category: string | null,
  surgery: string | null,
  procedureNote: string | null,
  roomClass: string | null,
  billed: number | null,
  paid: number,
  region: string | null,
  loket: string | null,
];

const cell = (value: unknown) => {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return s || null;
};

const amount = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  // A cell typed as text: "5.491.255" or "5,491,255".
  const digits = String(value ?? "").replace(/[^\d-]/g, "");
  return digits ? Number(digits) : null;
};

const header = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Every claim of the sheet (rows as XLSX's sheet_to_json with header: 1 gives them), or why it can't
 * be read. Rows without a hospital or a paid amount are skipped: the export ends with a note of the
 * filters it was made with.
 */
export const readClaimRows = (rows: unknown[][]): { error: string; claims?: undefined } | { error?: undefined; claims: ClaimRow[] } => {
  const at = rows.findIndex((r) => r.some((v) => header(v) === "id jaminan"));
  if (at < 0) return { error: `Kolom "ID Jaminan" tidak ditemukan. Kolom yang dibutuhkan: ${CLAIM_COLUMNS.join(", ")}.` };
  const names = rows[at].map(header);
  const columns = CLAIM_COLUMNS.map((c) => names.indexOf(c.toLowerCase()));
  const missing = CLAIM_COLUMNS.filter((_, i) => columns[i] < 0);
  if (missing.length > 0) return { error: `Kolom ${missing.join(", ")} tidak ditemukan.` };

  const claims: ClaimRow[] = [];
  for (const r of rows.slice(at + 1)) {
    const v = columns.map((i) => r[i]);
    const id = cell(v[0]);
    const hospital = cell(v[4]);
    const paid = amount(v[11]);
    if (!id || !hospital || paid === null) continue;
    const los = amount(v[2]);
    claims.push([
      id,
      cell(v[1]),
      los,
      cell(v[3]),
      hospital,
      cell(v[5]),
      cell(v[6]),
      cell(v[7]),
      cell(v[8]),
      cell(v[9]),
      amount(v[10]),
      paid,
      cell(v[12]),
      cell(v[13]),
    ]);
  }
  if (claims.length === 0) return { error: "Tidak ada baris klaim yang terbaca." };
  return { claims };
};
