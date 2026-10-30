"use client";

import "leaflet/dist/leaflet.css";

import Link from "next/link";
import { useEffect } from "react";
import { AttributionControl, CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";

import { isApproximate, type LocationSource, type Tier } from "@/lib/data/types";
import { formatKm, type Origin, type Point } from "@/lib/origin";

/** A ranked hospital on the map. */
export type RankedPin = Point & { id: string; name: string; rank: number; tier: Tier; distanceKm: number; source?: LocationSource };

const PIN_STYLE: Record<Tier, string> = {
  A: "fill-tier-a stroke-background",
  B: "fill-tier-b stroke-background",
  C: "fill-tier-c stroke-background",
};

/** Frames the accident and every ranked hospital. */
function Fit({ origin, pins }: { origin: Origin; pins: RankedPin[] }) {
  const map = useMap();
  const key = pins.map((p) => p.id).join(",");
  useEffect(() => {
    const points: [number, number][] = [[origin.lat, origin.lng], ...pins.map((p): [number, number] => [p.lat, p.lng])];
    if (points.length === 1) map.setView(points[0], 12);
    else map.fitBounds(points, { padding: [36, 36], maxZoom: 13 });
    // The key stands in for the pins: a new array with the same hospitals shouldn't move the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, origin.lat, origin.lng, key]);
  return null;
}

/** The accident and the hospitals ranked for it, each tied to it by a line as long as the way there. */
export function ReferralMap({ origin, pins }: { origin: Origin; pins: RankedPin[] }) {
  return (
    <MapContainer center={[origin.lat, origin.lng]} zoom={11} attributionControl={false} scrollWheelZoom={false} className="size-full">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <AttributionControl prefix={false} />
      {pins.map((pin) => (
        <Polyline
          key={`line-${pin.id}`}
          positions={[
            [origin.lat, origin.lng],
            [pin.lat, pin.lng],
          ]}
          pathOptions={{ className: "stroke-muted-foreground", weight: 1.5, opacity: 0.5, dashArray: "4 6" }}
        />
      ))}
      {pins.map((pin) => (
        <CircleMarker key={pin.id} center={[pin.lat, pin.lng]} radius={9} pathOptions={{ className: PIN_STYLE[pin.tier], weight: 2, fillOpacity: 0.95 }}>
          <Tooltip permanent direction="top" offset={[0, -8]} className="font-semibold">
            {pin.rank}
          </Tooltip>
          <Popup>
            <div className="grid gap-1">
              <p className="font-medium text-balance">{pin.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {isApproximate(pin) && "± "}
                {formatKm(pin.distanceKm)} dari lokasi kejadian
              </p>
              {isApproximate(pin) && <p className="text-xs text-muted-foreground">Lokasi perkiraan</p>}
              <Link href={`/rumah-sakit/${pin.id}`} className="text-xs font-medium underline underline-offset-4">
                Lihat rumah sakit
              </Link>
            </div>
          </Popup>
        </CircleMarker>
      ))}
      <CircleMarker center={[origin.lat, origin.lng]} radius={9} pathOptions={{ className: "fill-destructive stroke-background", weight: 3, fillOpacity: 1 }}>
        <Tooltip direction="bottom" offset={[0, 8]}>
          {origin.label}
        </Tooltip>
      </CircleMarker>
      <Fit origin={origin} pins={pins} />
    </MapContainer>
  );
}
