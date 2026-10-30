import type { Metadata } from "next";

import { HospitalListPage } from "@/components/hospitals/hospital-list-page";

export const metadata: Metadata = {
  title: "Indikasi Klaim",
  description: "Rumah sakit dengan klaim terindikasi, prioritas pemeriksaan teratas lebih dulu",
};

/** The hospitals whose claims have an indication; each opens on its Klaim tab. */
export default function ClaimsPage({ searchParams }: PageProps<"/klaim">) {
  return <HospitalListPage view="klaim" searchParams={searchParams} />;
}
