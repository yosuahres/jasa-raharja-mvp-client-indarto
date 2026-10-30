import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { TierBadge } from "@/components/tier-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatRupiah, joinFacts } from "@/lib/format";
import { isApproximate } from "@/lib/data/types";
import type { CaseMatch, CaseTreatment } from "@/lib/scoring";

import { distanceText } from "./results";

const priceText = (t: CaseTreatment) => {
  if (t.priceMin === null || t.priceMax === null) return "—";
  return t.priceMin === t.priceMax ? formatRupiah(t.priceMin) : `${formatRupiah(t.priceMin)} – ${formatRupiah(t.priceMax)}`;
};

/**
 * One hospital for an accident case, like a hotel in a travel search: who and where on the left, how
 * much of the case it covers on the right, and folded inside, the tindakan its document prices for
 * each step. Each tindakan opens every hospital that prices it.
 */
export function CaseResultCard({
  match: m,
  caseId,
  locationParams,
  hasOrigin,
  open = false,
}: {
  match: CaseMatch;
  caseId: string;
  /** Where the search is from, to keep in the tindakan links. */
  locationParams: Record<string, string>;
  hasOrigin: boolean;
  open?: boolean;
}) {
  const hospital = m.summary.hospital;
  const treatments = m.steps.reduce((sum, step) => sum + step.treatments.length, 0);
  const igd = hospital.facilities.some((f) => f.facilityId === "igd");
  const distance = distanceText(m.distanceKm, hasOrigin, isApproximate(hospital.location));

  const href = (key: string) => `/rekomendasi?${new URLSearchParams({ tindakan: key, kasus: caseId, ...locationParams })}`;

  return (
    <li className="overflow-hidden rounded-xl bg-card ring-1 ring-border transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/rumah-sakit/${hospital.id}`} className="truncate text-base font-semibold tracking-tight hover:underline">
              {hospital.name}
            </Link>
            <TierBadge tier={m.tier} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {joinFacts(hospital.city, m.summary.tipe && `Tipe ${m.summary.tipe}`, igd && "IGD", hospital.jasaRaharja?.loketName)}
          </p>
          {distance && <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{distance}</p>}
        </div>

        <div className="flex shrink-0 items-start gap-3">
          <p className="text-right text-xs text-muted-foreground">
            <span className="block text-base font-bold text-foreground tabular-nums">
              {m.covered}/{m.steps.length}
            </span>
            tahap
          </p>
          <Link href={`/rumah-sakit/${hospital.id}`} className={buttonVariants({ size: "sm" })}>
            Lihat RS
          </Link>
        </div>
      </div>

      <details open={open} className="group border-t">
        <summary className="flex cursor-pointer list-none items-center gap-1 px-4 py-2 text-sm font-medium text-primary outline-none hover:bg-muted/60 focus-visible:bg-muted/60 [&::-webkit-details-marker]:hidden">
          {treatments} tindakan
          <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <ol className="grid gap-3 bg-muted/30 px-4 pt-1 pb-4">
          {m.steps.map((step, index) => (
            <li key={step.label}>
              <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span className="grid size-5 place-items-center rounded-full bg-muted tabular-nums">{index + 1}</span>
                {step.label}
              </h3>
              {step.treatments.length === 0 ? (
                <p className="mt-1.5 pl-7 text-sm text-muted-foreground">Tidak tersedia</p>
              ) : (
                <ul className="mt-1.5 divide-y overflow-hidden rounded-lg bg-card ring-1 ring-border">
                  {step.treatments.map((t) => (
                    <li key={t.key}>
                      <Link
                        href={href(t.key)}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-sm outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
                      >
                        <span className="min-w-0 truncate">{t.name}</span>
                        <span className="whitespace-nowrap font-medium tabular-nums">{priceText(t)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}
