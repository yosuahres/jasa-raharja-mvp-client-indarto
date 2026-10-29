const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export const formatRupiah = (value: number) => rupiah.format(value);

/**
 * Money as Indonesian reports write it (PUEBI: no space after Rp, unit spelled out):
 * "Rp1,24 miliar", "Rp13,9 juta", "Rp950.000".
 */
export const formatRupiahShort = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `Rp${(value / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 })} miliar`;
  if (abs >= 1e6) return `Rp${(value / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} juta`;
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
};

export const formatJuta = (value: number) => {
  const juta = value / 1_000_000;
  return `Rp ${juta.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
};

export const formatRange = (min: number, max: number) => {
  const toJuta = (v: number) => (v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return `Rp ${toJuta(min)} – ${toJuta(max)} jt`;
};

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Facts joined with " · ", skipping the ones that are unknown. */
export const joinFacts = (...facts: (string | null | false | undefined)[]) => facts.filter(Boolean).join(" · ");

export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;

/** "KAB. GRESIK" → "Kab. Gresik": a place Jasa Raharja's data writes in capitals. */
export const titleCase = (text: string) =>
  text.toLowerCase().replace(/(^|[\s.(-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
