"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import type { MapFocus, MapPin } from "@/components/map/hospital-map";
import { RatingPill } from "@/components/rating";
import { TipeBadge } from "@/components/tier-badge";
import { buttonVariants } from "@/components/ui/button";
import { type HospitalLocation, isApproximate, type Tipe } from "@/lib/data/types";
import type { PriceLevel, ServiceLevel } from "@/lib/scoring";
import { cn } from "@/lib/utils";

/** One hospital under the map: its pin when its location is known, and what the table shows. */
export type HomeMapRow = {
  id: string;
  name: string;
  city: string;
  tipe: Tipe | null;
  price: { level: PriceLevel; reason: string } | null;
  services: { level: ServiceLevel; reason: string } | null;
  location: HospitalLocation | null;
};

// Leaflet reaches for `window` as it loads, so the map only renders in the browser.
const HospitalMap = dynamic(() => import("@/components/map/hospital-map").then((m) => m.HospitalMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted" />,
});

const TH = "px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground";
const TD = "px-3 py-2.5 whitespace-nowrap";

/**
 * The home page's map with a table of the hospitals under it: a click on a row zooms in on its pin.
 * The full page with filters is Peta Rumah Sakit.
 */
// `rows` defaults for hot reload, which can hand the component props from before it took them.
export function HomeMap({ rows = [] }: { rows?: HomeMapRow[] }) {
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const pinOf = (r: HomeMapRow): MapPin | null => (r.location ? { id: r.id, name: r.name, city: r.city, tipe: r.tipe, ...r.location } : null);
  const pins = rows.flatMap((r) => pinOf(r) ?? []);

  const onRowClick = (row: HomeMapRow) => (event: React.MouseEvent) => {
    // Links and buttons in the row do their own thing.
    if (event.target instanceof Element && event.target.closest("a, button")) return;
    const pin = pinOf(row);
    if (pin) setFocus({ pin });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* `isolate` keeps Leaflet's high z-index panes under the app's drawer and dialogs. */}
      <div className="isolate h-72 shrink-0 overflow-hidden rounded-xl border">
        <HospitalMap pins={pins} focus={focus} onPick={(pin) => setFocus({ pin })} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">Daftar rumah sakit</h3>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className={TH}>Rumah sakit</th>
                <th className={TH}>Tipe</th>
                <th className={TH}>Harga</th>
                <th className={TH}>Layanan</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick(row)}
                  aria-current={focus?.pin.id === row.id ? "true" : undefined}
                  className={cn("transition-colors hover:bg-muted/40 aria-[current=true]:bg-muted/60", row.location && "cursor-pointer")}
                >
                  <td className={cn(TD, "max-w-56")}>
                    <span className="block truncate font-medium">{row.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.city || "Kota tidak tercetak"}
                      {!row.location && " · lokasi belum ditemukan"}
                      {isApproximate(row.location) && " · lokasi perkiraan"}
                    </span>
                  </td>
                  <td className={TD}>{row.tipe ? <TipeBadge tipe={row.tipe} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className={TD}>
                    <span title={row.price?.reason}>
                      <RatingPill level={row.price?.level ?? null} />
                    </span>
                  </td>
                  <td className={TD}>
                    <span title={row.services?.reason}>
                      <RatingPill level={row.services?.level ?? null} />
                    </span>
                  </td>
                  <td className={TD}>
                    <span className="flex justify-end">
                      <Link href={`/rumah-sakit/${row.id}`} className={buttonVariants({ variant: "outline", size: "xs" })}>
                        Detail
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
