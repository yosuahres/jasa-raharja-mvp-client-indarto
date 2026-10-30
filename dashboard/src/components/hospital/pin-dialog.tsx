"use client";

import { MapPinned } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { savePin } from "@/app/(dashboard)/rumah-sakit/[id]/actions";
import type { ContextPin } from "@/components/search/location-map";
import { Button } from "@/components/ui/button";
import type { HospitalLocation } from "@/lib/data/types";
import { formatCoords, type Point } from "@/lib/origin";

import { FormDialog } from "./form-dialog";

// Leaflet reaches for `window` as it loads, so the map only renders in the browser.
const LocationMap = dynamic(() => import("@/components/search/location-map").then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted" />,
});

/** Puts the hospital's pin where it really is: a click on the map, with the hospitals around it for bearings. */
export function PinDialog({ hospitalId, location, nearby }: { hospitalId: string; location: HospitalLocation | null; nearby: ContextPin[] }) {
  const [point, setPoint] = useState<Point | null>(location && { lat: location.lat, lng: location.lng });

  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="xs" className="-my-0.5 text-muted-foreground">
          <MapPinned data-icon="inline-start" />
          Atur pin
        </Button>
      }
      title="Lokasi di peta"
      description="Klik peta di letak rumah sakit."
      action={savePin}
      savedMessage="Lokasi tersimpan"
      secondary={
        location?.source === "manual" && (
          <Button type="submit" name="intent" value="otomatis" variant="ghost" className="mr-auto">
            Cari otomatis
          </Button>
        )
      }
    >
      <input type="hidden" name="hospital_id" value={hospitalId} />
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lng" value={point?.lng ?? ""} />
      {/* `isolate` keeps Leaflet's high z-index panes inside the dialog. */}
      <div className="isolate h-72 shrink-0 overflow-hidden rounded-lg ring-1 ring-border">
        <LocationMap value={point} onChange={setPoint} pins={nearby} />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">{point ? formatCoords(point) : "Belum ada pin"}</p>
    </FormDialog>
  );
}
