/**
 * Red flags and profiles from Jasa Raharja's claim data: one claim per guarantee letter (GL).
 *
 * Method, from how payers screen hospital claims elsewhere:
 *
 * 1. Every claim is compared with its peers: the claims of other hospitals (its own hospital's are left
 *    out, so a big hospital doesn't set its own bar) with the same jenis rawatan, injury (ICD-10 category,
 *    the first three characters: S06, S82…), operation status and room class (a VIP room costs about half
 *    as much again as kelas III for the same injury). This is the case-mix grouping DRG payers use before
 *    judging cost or length of stay. A peer group needs at least 11 claims (CMS PEPPER's minimum); a
 *    smaller one falls back to every room class, then to jenis rawatan and operation status alone.
 * 2. A claim is flagged by the three rules the client named, each judged on the amount billed (nilai
 *    diajukan): the amount paid stops at Jasa Raharja's Rp20 juta cap, which a third of rawat inap claims
 *    reach, so it can't tell a dear hospital from a typical one. Quartiles, so the occasional extreme
 *    amount doesn't move the bar:
 *    - singkat:       rawat inap, LOS in the shortest quarter of its peers, billed in the dearest quarter;
 *    - panjang:       rawat inap, LOS longer than 90% of its peers' (Permenkes 16/2019's prolonged stay);
 *    - ringan:        injury Ringan, billed as much as the dearest quarter of Berat injuries (same jenis rawatan and room class);
 *    - tanpa-operasi: no operation, billed as much as the dearest quarter of operated claims for the same injury.
 * 3. A hospital is an outlier on a rule when its share of flagged claims is in the top 20% of hospitals
 *    (at or above the 80th percentile), as CMS PEPPER marks hospitals, and too high to be chance against
 *    the share across all hospitals (one-sided binomial test, p < 0.05, as CMS's comparative billing
 *    reports call a provider "significantly higher"), so a hospital with few claims isn't flagged on luck.
 *    Only hospitals with at least 11 claims the rule applies to are judged. Its red flags are the rules
 *    it is an outlier on. Its share of VIP rooms and of victims with more than one GL are judged the same
 *    way, but only shown: a VIP room can be the victim's choice, and two victims can share a name.
 * 4. A hospital's risk is how many rules it is an outlier on (3 or more tinggi, 2 sedang, 1 rendah), and within a
 *    risk level hospitals are ordered by potential overpayment: what each indicated claim was paid above
 *    its peer median, summed (the peer-based "excess spending" of Shekhar, Leder-Luis & Akoglu, NBER
 *    w30946, counted on indicated claims only). An indication is not proof: it says where to look first.
 */

/** One claim, as the analysis needs it. */
export type Claim = {
  guaranteeId: string;
  victim: string | null;
  los: number | null;
  careType: string;
  hospital: string;
  diagnosis: string;
  category: string | null;
  surgery: string | null;
  procedureNote: string | null;
  roomClass: string | null;
  billed: number | null;
  paid: number;
  loket: string | null;
};

export type RuleId = "singkat" | "panjang" | "ringan" | "tanpa-operasi";

export const RULES: { id: RuleId; label: string; detail: string }[] = [
  {
    id: "singkat",
    label: "LOS singkat, biaya tinggi",
    detail: "Rawat inap dengan LOS di 25% tersingkat, tetapi nilai diajukan di 25% tertinggi untuk klaim sejenis di RS lain.",
  },
  {
    id: "panjang",
    label: "LOS panjang",
    detail: "Rawat inap dengan LOS lebih panjang dari 90% klaim sejenis di RS lain.",
  },
  {
    id: "ringan",
    label: "Cedera ringan, biaya tinggi",
    detail: "Kategori cedera Ringan, tetapi nilai diajukan setara 25% klaim cedera Berat termahal di RS lain.",
  },
  {
    id: "tanpa-operasi",
    label: "Tanpa operasi, biaya tinggi",
    detail: "Tidak ada tindakan operasi, tetapi nilai diajukan setara 25% klaim operasi termahal untuk cedera yang sama di RS lain.",
  },
];

/** Fewest claims a peer group or a hospital needs to be judged on (CMS PEPPER's minimum). */
export const MIN_CLAIMS = 11;

/** A hospital is an outlier on a rule from this percentile of hospitals' rates up (CMS PEPPER). */
export const OUTLIER_PERCENTILE = 0.8;

/** A claim's amount is high from this percentile of what it is compared with: the dearest quarter. */
const HIGH = 0.75;
/** A rawat inap stay is short up to this percentile of its peers' LOS: the shortest quarter. */
const SHORT = 0.25;
/** And long above this one: past 90% of them, as a stay runs long for many honest reasons. */
const LONG = 0.9;

export const INPATIENT = "Rawat Inap";
const NO_SURGERY = "Tidak Ada";
const MINOR = "Ringan";
const SEVERE = "Berat";
export const VIP = "VIP";

/** "Concussion S06.0" → "S06": the ICD-10 category, the level injuries are compared at. */
export const icdCategory = (diagnosis: string) => diagnosis.match(/\b([A-Z]\d{2})(?:\.\d{1,2})?\s*$/)?.[1] ?? "";

export const hadSurgery = (claim: Pick<Claim, "surgery">) => !!claim.surgery && claim.surgery !== NO_SURGERY;

/** What the hospital billed, which the rules judge: the amount paid stops at the cap. */
const billedOf = (claim: Claim): number => claim.billed ?? claim.paid;

/** Linear-interpolated percentile (as SQL's percentile_cont) of numbers already sorted ascending. */
const percentileOfSorted = (sorted: number[], p: number) => {
  if (sorted.length === 0) return null;
  const at = (sorted.length - 1) * p;
  const low = Math.floor(at);
  const high = Math.min(low + 1, sorted.length - 1);
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
};

export const percentile = (values: number[], p: number) => percentileOfSorted([...values].sort((a, b) => a - b), p);

const groupBy = <T>(items: T[], key: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
};

// ------------------------------------------------------------------------------------------ baselines

/**
 * The groups a claim can be compared within, most alike first: it is judged in the first with enough
 * claims. Null where a claim has no place at that level (an injury without an ICD-10 code).
 */
type Levels = ((claim: Claim) => string | null)[];

const operationOf = (c: Claim) => (hadSurgery(c) ? "operasi" : "non");
const injuryOf = (c: Claim) => icdCategory(c.diagnosis) || null;
const keyOf = (...parts: (string | null)[]) => (parts.includes(null) ? null : parts.join("|"));

const PEER_LEVELS: Levels = [
  (c) => keyOf(c.careType, injuryOf(c), operationOf(c), c.roomClass ?? ""),
  (c) => keyOf(c.careType, injuryOf(c), operationOf(c)),
  (c) => keyOf(c.careType, operationOf(c)),
];

/** Where a Ringan claim's Berat bar comes from. */
const SEVERE_LEVELS: Levels = [(c) => keyOf(c.careType, c.roomClass ?? ""), (c) => c.careType];

/** Where a claim without an operation finds the operated claims for the same injury. */
const SURGERY_LEVELS: Levels = [
  (c) => keyOf(c.careType, injuryOf(c), c.roomClass ?? ""),
  (c) => keyOf(c.careType, injuryOf(c)),
  (c) => c.careType,
];

/**
 * A peer group's bars: a tuple rounded to the rupiah (LOS to the tenth of a day), as the baselines of
 * every hospital are cached together and an object per group would be twice the size.
 */
export type PeerStats = [losShort: number | null, losLong: number | null, billedHigh: number, paidMedian: number];

/**
 * What one hospital's claims are judged against, worked out from every other hospital's claims. Keyed
 * by level and group ("1:Rawat Inap|S06|non"), holding only the groups its claims are judged in.
 */
export type Baselines = {
  peers: Record<string, PeerStats>;
  /** The Berat bar on the amount billed, for its Ringan claims. */
  severe: Record<string, number>;
  /** The operated bar on the amount billed, for its claims without an operation. */
  surgery: Record<string, number>;
};

/** The first group of a claim's levels the table holds. */
const lookup = <T>(table: Record<string, T>, levels: Levels, claim: Claim): T | undefined => {
  for (const [i, level] of levels.entries()) {
    const key = level(claim);
    if (key !== null && `${i}:${key}` in table) return table[`${i}:${key}`];
  }
  return undefined;
};

type Measure = (claim: Claim) => number | null;
const losOf: Measure = (c) => c.los;
const paidOf: Measure = (c) => c.paid;

/** The claims of one group, each measure sorted once so any hospital's can be left out in one pass. */
type Group = { claims: Claim[]; perHospital: Map<string, number>; sorted: Map<Measure, { value: number; hospital: string }[]> };

/** One measure of a group's claims, sorted ascending, without one hospital's. */
const valuesWithout = (group: Group, measure: Measure, hospital: string) => {
  let sorted = group.sorted.get(measure);
  if (!sorted) {
    sorted = group.claims
      .flatMap((c) => {
        const value = measure(c);
        return value === null ? [] : [{ value, hospital: c.hospital }];
      })
      .sort((a, b) => a.value - b.value);
    group.sorted.set(measure, sorted);
  }
  return sorted.flatMap((e) => (e.hospital === hospital ? [] : [e.value]));
};

/** Every claim grouped at each level. */
type Hierarchy = { levels: Levels; groups: Map<string, Group>[] };

const hierarchyOf = (claims: Claim[], levels: Levels): Hierarchy => ({
  levels,
  groups: levels.map((level) => {
    const groups = new Map<string, Group>();
    for (const claim of claims) {
      const key = level(claim);
      if (key === null) continue;
      let group = groups.get(key);
      if (!group) groups.set(key, (group = { claims: [], perHospital: new Map(), sorted: new Map() }));
      group.claims.push(claim);
      group.perHospital.set(claim.hospital, (group.perHospital.get(claim.hospital) ?? 0) + 1);
    }
    return groups;
  }),
});

/**
 * For one hospital, the first group at which each of its claims has at least MIN_CLAIMS claims of other
 * hospitals, summed up from those claims.
 */
const tableFor = <T>(hospital: string, own: Claim[], { levels, groups }: Hierarchy, summarize: (group: Group, hospital: string) => T) => {
  const table: Record<string, T> = {};
  for (const claim of own) {
    for (const [i, level] of levels.entries()) {
      const key = level(claim);
      const group = key === null ? undefined : groups[i].get(key);
      if (!group || group.claims.length - (group.perHospital.get(hospital) ?? 0) < MIN_CLAIMS) continue;
      table[`${i}:${key}`] ??= summarize(group, hospital);
      break;
    }
  }
  return table;
};

const rupiah = (value: number | null) => Math.round(value ?? 0);
const days = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

const peerStatsOf = (group: Group, hospital: string): PeerStats => {
  const los = valuesWithout(group, losOf, hospital);
  return [
    days(percentileOfSorted(los, SHORT)),
    days(percentileOfSorted(los, LONG)),
    rupiah(percentileOfSorted(valuesWithout(group, billedOf, hospital), HIGH)),
    rupiah(percentileOfSorted(valuesWithout(group, paidOf, hospital), 0.5)),
  ];
};

const billedHighOf = (group: Group, hospital: string) => rupiah(percentileOfSorted(valuesWithout(group, billedOf, hospital), HIGH));

/** Which rules a claim applies to: rules can only flag claims they apply to. */
export const appliesTo = (rule: RuleId, claim: Claim) =>
  rule === "singkat" || rule === "panjang"
    ? claim.careType === INPATIENT && claim.los !== null
    : rule === "ringan"
      ? claim.category === MINOR
      : claim.surgery === NO_SURGERY;

type Comparisons = { peers: Hierarchy; severe: Hierarchy; surgery: Hierarchy };

const comparisonsOf = (claims: Claim[]): Comparisons => ({
  peers: hierarchyOf(claims, PEER_LEVELS),
  severe: hierarchyOf(
    claims.filter((c) => c.category === SEVERE),
    SEVERE_LEVELS,
  ),
  surgery: hierarchyOf(claims.filter(hadSurgery), SURGERY_LEVELS),
});

const baselinesFor = (hospital: string, own: Claim[], compare: Comparisons): Baselines => ({
  peers: tableFor(hospital, own, compare.peers, peerStatsOf),
  severe: tableFor(
    hospital,
    own.filter((c) => appliesTo("ringan", c)),
    compare.severe,
    billedHighOf,
  ),
  surgery: tableFor(
    hospital,
    own.filter((c) => appliesTo("tanpa-operasi", c)),
    compare.surgery,
    billedHighOf,
  ),
});

/** The claims of other hospitals this one is compared with. */
export const peerOf = (claim: Claim, b: Baselines): PeerStats | undefined => lookup(b.peers, PEER_LEVELS, claim);

/** Whether a claim trips a rule, judged against its hospital's baselines. */
const trips = (rule: RuleId, claim: Claim, b: Baselines) => {
  if (!appliesTo(rule, claim)) return false;
  const billed = billedOf(claim);
  if (rule === "ringan" || rule === "tanpa-operasi") {
    const bar = rule === "ringan" ? lookup(b.severe, SEVERE_LEVELS, claim) : lookup(b.surgery, SURGERY_LEVELS, claim);
    return bar !== undefined && billed >= bar;
  }
  const peer = peerOf(claim, b);
  const los = claim.los;
  if (!peer || los === null) return false;
  const [losShort, losLong, billedHigh] = peer;
  return rule === "singkat" ? losShort !== null && los <= losShort && billed >= billedHigh : losLong !== null && los > losLong;
};

export const flagsOf = (claim: Claim, b: Baselines): RuleId[] => RULES.flatMap(({ id }) => (trips(id, claim, b) ? [id] : []));

export type Risk = "tinggi" | "sedang" | "rendah";

/** How urgently a hospital needs checking: by how many rules it is an outlier on. */
export const riskOf = (redFlags: number): Risk | null => (redFlags >= 3 ? "tinggi" : redFlags === 2 ? "sedang" : redFlags === 1 ? "rendah" : null);

/** Paid minus the peers' median: what this claim cost Jasa Raharja above (or below) a typical one like it. */
export const excessOf = (claim: Claim, b: Baselines) => {
  const [, , , paidMedian = claim.paid] = peerOf(claim, b) ?? [];
  return claim.paid - paidMedian;
};

// ------------------------------------------------------------------------------------------ hospitals

/** A share of a hospital's claims (or victims), and whether it stands out among hospitals. */
export type RuleResult = {
  /** Claims the rule applies to, and how many of them it flags. */
  eligible: number;
  flagged: number;
  rate: number;
  /** Null when there are too few claims to judge. */
  outlier: boolean | null;
};

type Mix = { label: string; claims: number }[];

export type HospitalClaims = {
  name: string;
  loket: string | null;
  claims: number;
  inpatient: number;
  avgLos: number | null;
  paidTotal: number;
  paidAvg: number;
  billedTotal: number;
  excessTotal: number;
  excessAvg: number;
  severeShare: number;
  /** Share of rawat inap claims in a VIP room; null without enough rawat inap claims. */
  vipShare: number | null;
  vipOutlier: boolean | null;
  /** Victims (by name) with more than one GL at this hospital, of its named victims. */
  repeatVictims: RuleResult;
  rules: Record<RuleId, RuleResult>;
  /** Rules this hospital is an outlier on. */
  redFlags: RuleId[];
  /** Its claims that trip at least one rule. */
  flaggedClaims: number;
  /** What its indicated claims were paid above their peer medians, summed. */
  overpayment: number;
  topDiagnosis: string | null;
  topSurgery: string | null;
};

export type LoketClaims = {
  loket: string;
  hospitals: number;
  claims: number;
  paidTotal: number;
  paidAvg: number;
  avgLos: number | null;
  severeShare: number;
  redFlagHospitals: number;
  topDiagnosis: string | null;
};

/** Each hospital's limit per rule: rates at or above it are outliers. */
export type Limits = Record<RuleId | "vip" | "repeat", number | null>;

export type ClaimAnalysis = {
  claims: number;
  paidTotal: number;
  /** What each hospital's claims are judged against, by hospital name: for its claim detail. */
  baselines: Record<string, Baselines>;
  limits: Limits;
  hospitals: HospitalClaims[];
  lokets: LoketClaims[];
};

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** The most frequent value, ties to the first seen. */
const mostCommon = (values: (string | null)[]) => mixOf(values)[0]?.label ?? null;

/** How many claims carry each value, most first; empty values left out. */
export const mixOf = (values: (string | null)[]): Mix =>
  [...groupBy(values.filter((v): v is string => !!v), (v) => v)].map(([label, g]) => ({ label, claims: g.length })).sort((a, b) => b.claims - a.claims);

type Count = Omit<RuleResult, "outlier">;

const countOf = (eligible: number, flagged: number): Count => ({ eligible, flagged, rate: eligible ? flagged / eligible : 0 });

/** The limit on hospitals' rates, from those with enough claims to judge. */
const limitOf = (counts: Count[]) => percentile(counts.flatMap((c) => (c.eligible >= MIN_CLAIMS ? [c.rate] : [])), OUTLIER_PERCENTILE);

/** The rate across every hospital, each claim counted once. */
const overallOf = (counts: Count[]) => {
  const eligible = sum(counts.map((c) => c.eligible));
  return eligible ? sum(counts.map((c) => c.flagged)) / eligible : 0;
};

/** Below this chance, a hospital's rate is too high to be luck. */
const SIGNIFICANCE = 0.05;

/** The chance of at least `k` of `n` at rate `p`: the one-sided binomial tail. */
const binomialTail = (k: number, n: number, p: number) => {
  if (k <= 0) return 1;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let logChance = k * Math.log(p) + (n - k) * Math.log(1 - p);
  for (let i = 1; i <= k; i++) logChance += Math.log((n - k + i) / i);
  let chance = Math.exp(logChance);
  let tail = 0;
  for (let i = k; i <= n && chance > 0; i++) {
    tail += chance;
    chance *= ((n - i) / (i + 1)) * (p / (1 - p));
  }
  return Math.min(1, tail);
};

/**
 * An outlier sits at or above the limit and too far above the overall rate to be chance; null with too
 * few claims to judge.
 */
const judge = (count: Count, limit: number | null, overall: number): RuleResult => ({
  ...count,
  outlier:
    count.eligible < MIN_CLAIMS || limit === null
      ? null
      : count.flagged > 0 && count.rate >= limit && binomialTail(count.flagged, count.eligible, overall) < SIGNIFICANCE,
});

/** Victims with more than one GL, of the victims named: names written alike are taken as one person. */
const repeatCountOf = (claims: Claim[]) => {
  const perVictim = groupBy(
    claims.filter((c) => c.victim),
    (c) => (c.victim ?? "").toUpperCase(),
  );
  return countOf(perVictim.size, [...perVictim.values()].filter((g) => g.length > 1).length);
};

export const analyzeClaims = (claims: Claim[]): ClaimAnalysis => {
  const compare = comparisonsOf(claims);
  const byHospital = [...groupBy(claims, (c) => c.hospital)];
  const baselines = Object.fromEntries(byHospital.map(([name, group]) => [name, baselinesFor(name, group, compare)]));
  const flags = new Map(claims.map((c) => [c, flagsOf(c, baselines[c.hospital])]));

  const counted = byHospital.map(([name, group]) => {
    const rules = Object.fromEntries(
      RULES.map(({ id }) => {
        const eligible = group.filter((c) => appliesTo(id, c));
        return [id, countOf(eligible.length, eligible.filter((c) => flags.get(c)?.includes(id)).length)];
      }),
    ) as Record<RuleId, Count>;
    const inpatient = group.filter((c) => c.careType === INPATIENT);
    const vip = countOf(inpatient.length, inpatient.filter((c) => c.roomClass === VIP).length);
    return { name, group, rules, inpatient, vip, repeat: repeatCountOf(group) };
  });

  const ruleCounts = (id: RuleId) => counted.map((h) => h.rules[id]);
  const vipCounts = counted.map((h) => h.vip);
  const repeatCounts = counted.map((h) => h.repeat);
  const limits = {
    ...(Object.fromEntries(RULES.map(({ id }) => [id, limitOf(ruleCounts(id))])) as Record<RuleId, number | null>),
    vip: limitOf(vipCounts),
    repeat: limitOf(repeatCounts),
  } satisfies Limits;
  const overall = {
    ...(Object.fromEntries(RULES.map(({ id }) => [id, overallOf(ruleCounts(id))])) as Record<RuleId, number>),
    vip: overallOf(vipCounts),
    repeat: overallOf(repeatCounts),
  };

  const hospitals: HospitalClaims[] = counted.map(({ name, group, rules, inpatient, vip, repeat }) => {
    const results = Object.fromEntries(RULES.map(({ id }) => [id, judge(rules[id], limits[id], overall[id])])) as Record<RuleId, RuleResult>;
    const excess = group.map((c) => excessOf(c, baselines[name]));
    return {
      name,
      loket: mostCommon(group.map((c) => c.loket)),
      claims: group.length,
      inpatient: inpatient.length,
      avgLos: average(inpatient.flatMap((c) => (c.los === null ? [] : [c.los]))),
      paidTotal: sum(group.map((c) => c.paid)),
      paidAvg: sum(group.map((c) => c.paid)) / group.length,
      billedTotal: sum(group.map((c) => c.billed ?? 0)),
      excessTotal: sum(excess),
      excessAvg: sum(excess) / group.length,
      severeShare: group.filter((c) => c.category === SEVERE).length / group.length,
      vipShare: vip.eligible >= MIN_CLAIMS ? vip.rate : null,
      vipOutlier: judge(vip, limits.vip, overall.vip).outlier,
      repeatVictims: judge(repeat, limits.repeat, overall.repeat),
      rules: results,
      redFlags: RULES.filter(({ id }) => results[id].outlier).map(({ id }) => id),
      flaggedClaims: group.filter((c) => (flags.get(c) ?? []).length > 0).length,
      overpayment: sum(group.filter((c) => (flags.get(c) ?? []).length > 0).map((c) => Math.max(0, excessOf(c, baselines[name])))),
      topDiagnosis: mostCommon(group.map((c) => c.diagnosis)),
      topSurgery: mostCommon(group.filter(hadSurgery).map((c) => c.surgery)),
    };
  });

  const lokets: LoketClaims[] = [...groupBy(claims, (c) => c.loket ?? "")]
    .filter(([loket]) => loket)
    .map(([loket, group]) => {
      const names = new Set(group.map((c) => c.hospital));
      return {
        loket,
        hospitals: names.size,
        claims: group.length,
        paidTotal: sum(group.map((c) => c.paid)),
        paidAvg: sum(group.map((c) => c.paid)) / group.length,
        avgLos: average(group.flatMap((c) => (c.careType === INPATIENT && c.los !== null ? [c.los] : []))),
        severeShare: group.filter((c) => c.category === SEVERE).length / group.length,
        redFlagHospitals: hospitals.filter((h) => h.loket === loket && h.redFlags.length > 0).length,
        topDiagnosis: mostCommon(group.map((c) => c.diagnosis)),
      };
    })
    .sort((a, b) => b.claims - a.claims);

  return {
    claims: claims.length,
    paidTotal: sum(claims.map((c) => c.paid)),
    baselines,
    limits,
    hospitals: hospitals.sort((a, b) => b.claims - a.claims),
    lokets,
  };
};

// ------------------------------------------------------------------------------------------ one hospital

export type FlaggedClaim = Claim & { flags: RuleId[]; excess: number };

export type BreakdownRow = { label: string; claims: number; paidAvg: number; excessAvg: number };

export type HospitalDetail = {
  diagnoses: BreakdownRow[];
  surgeries: BreakdownRow[];
  roomClasses: Mix;
  categories: Mix;
  careTypes: Mix;
  flagged: FlaggedClaim[];
};

const breakdown = (claims: Claim[], label: (c: Claim) => string | null, b: Baselines): BreakdownRow[] =>
  [...groupBy(claims, (c) => label(c) ?? "")]
    .filter(([key]) => key)
    .map(([key, g]) => ({
      label: key,
      claims: g.length,
      paidAvg: sum(g.map((c) => c.paid)) / g.length,
      excessAvg: sum(g.map((c) => excessOf(c, b))) / g.length,
    }))
    .sort((x, y) => y.claims - x.claims);

/** What one hospital treats, how it is paid for it against peers, and which of its claims are flagged. */
export const hospitalDetail = (claims: Claim[], b: Baselines): HospitalDetail => ({
  diagnoses: breakdown(claims, (c) => c.diagnosis, b),
  surgeries: breakdown(claims.filter(hadSurgery), (c) => c.surgery, b),
  roomClasses: mixOf(claims.filter((c) => c.careType === INPATIENT).map((c) => c.roomClass)),
  categories: mixOf(claims.map((c) => c.category)),
  careTypes: mixOf(claims.map((c) => c.careType)),
  flagged: claims
    .map((c) => ({ ...c, flags: flagsOf(c, b), excess: excessOf(c, b) }))
    .filter((c) => c.flags.length > 0)
    .sort((x, y) => y.flags.length - x.flags.length || y.excess - x.excess),
});

/** "RSUD SOEDONO, KOTA MADIUN" → "rsud-soedono-kota-madiun": the hospital's claims page. */
export const claimSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
