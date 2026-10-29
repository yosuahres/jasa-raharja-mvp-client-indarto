"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Building2, type LucideIcon, ReceiptText, ShieldAlert, Stethoscope } from "lucide-react";

import { cn } from "@/lib/utils";

export type TabId = "tarif" | "fasilitas" | "tenaga-medis" | "klaim";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "tarif", label: "Tarif", icon: ReceiptText },
  { id: "fasilitas", label: "Fasilitas", icon: Building2 },
  { id: "tenaga-medis", label: "Tenaga medis", icon: Stethoscope },
  { id: "klaim", label: "Klaim", icon: ShieldAlert },
];

type Count = { value: number; label: string; warn?: boolean };

/** The hospital page's right pane: a row of icon tabs over a scrolling panel. A tab without a panel isn't shown. */
export function DetailTabs({
  panels,
  counts,
  defaultTab = "tarif",
}: {
  panels: Record<Exclude<TabId, "klaim">, React.ReactNode> & { klaim?: React.ReactNode };
  counts: Partial<Record<TabId, Count>>;
  defaultTab?: TabId;
}) {
  const tabs = TABS.filter((tab) => panels[tab.id] !== undefined);
  return (
    <Tabs.Root defaultValue={defaultTab} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-4">
        <Tabs.List aria-label="Bagian profil rumah sakit" className="flex items-center overflow-x-auto [scrollbar-width:none]">
          {tabs.map((tab) => {
            const count = counts[tab.id];
            return (
              <Tabs.Tab
                key={tab.id}
                value={tab.id}
                className="group flex shrink-0 cursor-pointer flex-col items-stretch gap-1 pt-1.5 text-sm whitespace-nowrap text-muted-foreground outline-none hover:text-foreground data-active:font-medium data-active:text-primary"
              >
                <span className="flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 transition-colors group-hover:bg-muted/25 group-focus-visible:ring-3 group-focus-visible:ring-ring/50 group-data-active:border-border/40 group-data-active:bg-muted/40">
                  <tab.icon className="size-3.5" />
                  {tab.label}
                  {count && <CountChip count={count} />}
                </span>
                <span className="h-0.5 rounded-full transition-colors group-data-active:bg-primary" />
              </Tabs.Tab>
            );
          })}
        </Tabs.List>
      </div>

      {tabs.map((tab) => (
        <Tabs.Panel key={tab.id} value={tab.id} className="min-h-0 flex-1 px-4 py-4 outline-none md:overflow-y-auto">
          {panels[tab.id]}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}

function CountChip({ count }: { count: Count }) {
  return (
    <span
      className={cn(
        "ml-0.5 min-w-4 rounded px-1 text-center text-[11px] leading-4 font-medium tabular-nums",
        count.warn
          ? "bg-tier-c-soft text-tier-c-ink"
          : "bg-muted text-muted-foreground group-data-active:bg-primary/10 group-data-active:text-primary",
      )}
    >
      {count.value.toLocaleString("id-ID")}
      <span className="sr-only"> {count.label}</span>
    </span>
  );
}
