"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { TipeBadge } from "@/components/tier-badge";
import { Card } from "@/components/ui/card";
import { isApproximate } from "@/lib/data/types";
import { joinFacts } from "@/lib/format";

import type { MapFocus, MapPin } from "./hospital-map";

// Leaflet reaches for `window` as it loads, so the map only renders in the browser.
const HospitalMap = dynamic(() => import("./hospital-map").then((m) => m.HospitalMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted" />,
});

export type UnplacedHospital = { id: string; name: string; city: string };

export function HospitalMapView({ pins, unplaced }: { pins: MapPin[]; unplaced: UnplacedHospital[] }) {
  const [focus, setFocus] = useState<MapFocus | null>(null);

  return (
    // Fills its full-page box: the map takes the height, the list scrolls beside it.
    <div className="grid gap-4 lg:h-full lg:grid-cols-[minmax(0,1fr)_18rem]">
      {/* `isolate` keeps Leaflet's high z-index panes under the app's drawer and dialogs. */}
      <Card className="isolate h-[60svh] min-h-80 overflow-hidden py-0 lg:h-full">
        <HospitalMap pins={pins} focus={focus} onPick={(pin) => setFocus({ pin })} />
      </Card>

      <aside className="grid content-start gap-4 lg:min-h-0 lg:overflow-y-auto">
        {pins.length > 0 && (
          <ul className="grid gap-0.5">
            {pins.map((pin) => (
              <li key={pin.id}>
                <button
                  onClick={() => setFocus({ pin })}
                  aria-current={focus?.pin.id === pin.id ? "true" : undefined}
                  className="flex w-full items-start justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted aria-[current=true]:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-pretty">{pin.name}</span>
                    {(pin.city || isApproximate(pin)) && (
                      <span className="block text-xs text-muted-foreground">{joinFacts(pin.city, isApproximate(pin) && "lokasi perkiraan")}</span>
                    )}
                  </span>
                  {pin.tipe && <TipeBadge tipe={pin.tipe} className="mt-0.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {unplaced.length > 0 && (
          <section>
            <h2 className="px-2 text-xs font-medium text-muted-foreground">Lokasi belum ditemukan</h2>
            <ul className="mt-1 grid gap-0.5">
              {unplaced.map((h) => (
                <li key={h.id}>
                  <Link href={`/rumah-sakit/${h.id}`} className="block rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
                    <span className="block text-sm text-pretty">{h.name}</span>
                    {h.city && <span className="block text-xs text-muted-foreground">{h.city}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
