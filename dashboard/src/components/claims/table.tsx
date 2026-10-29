import { type Risk, RULES, type RuleId } from "@/lib/claims/analysis";
import { cn } from "@/lib/utils";

/** The plain bordered tables of the claim pages, as on the Jasa Raharja list. */
export const TABLE_FRAME = "overflow-x-auto rounded-lg border bg-background";
export const TABLE = "w-full text-sm";
export const HEAD_ROW = "border-b bg-muted/50 text-xs text-muted-foreground";
export const TH = "px-3 py-2.5 text-left font-medium whitespace-nowrap";
export const TH_NUM = "px-3 py-2.5 text-right font-medium whitespace-nowrap";
export const TD = "px-3 py-2.5 align-top";
export const TD_NUM = "px-3 py-2.5 text-right align-top tabular-nums whitespace-nowrap";

export const num = (n: number) => n.toLocaleString("id-ID");

const RULE_SHORT: Record<RuleId, string> = {
  singkat: "LOS singkat",
  panjang: "LOS panjang",
  ringan: "Cedera ringan",
  "tanpa-operasi": "Tanpa operasi",
};

export const ruleLabel = (id: RuleId) => RULES.find((r) => r.id === id)?.label ?? id;

/** The rules a claim or hospital trips, as small pink tags; `full` spells each rule out. */
export function RuleTags({ rules, full = false, className }: { rules: RuleId[]; full?: boolean; className?: string }) {
  if (rules.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {rules.map((id) => (
        <span key={id} title={ruleLabel(id)} className="rounded bg-tier-c-soft px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-tier-c-ink">
          {full ? ruleLabel(id) : RULE_SHORT[id]}
        </span>
      ))}
    </span>
  );
}

const RISK: Record<Risk, { label: string; className: string }> = {
  tinggi: { label: "Tinggi", className: "bg-tier-c-soft text-tier-c-ink" },
  sedang: { label: "Sedang", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  rendah: { label: "Rendah", className: "bg-muted text-muted-foreground" },
};

/** A hospital's risk level as a pill. */
export function RiskBadge({ risk }: { risk: Risk | null }) {
  if (!risk) return <span className="text-muted-foreground">—</span>;
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", RISK[risk].className)}>{RISK[risk].label}</span>;
}

/** Above or below the peers' typical amount: pink when above. */
export function Excess({ value, format }: { value: number; format: (n: number) => string }) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return <span className={cn(value > 0 && "text-tier-c-ink")}>{`${sign}${format(Math.abs(value))}`}</span>;
}

export function SectionTitle({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** A row of figures along the top of a claim page. */
export function Facts({ items }: { items: { label: string; value: string; detail?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="bg-background px-4 py-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">{item.value}</dd>
          {item.detail && <dd className="text-xs text-muted-foreground">{item.detail}</dd>}
        </div>
      ))}
    </dl>
  );
}
