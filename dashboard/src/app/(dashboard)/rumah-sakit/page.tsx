import type { Metadata } from "next";

import { HospitalListPage } from "@/components/hospitals/hospital-list-page";

export const metadata: Metadata = {
  title: "Rumah Sakit",
  description: "Semua rumah sakit: tipe, harga, dan layanan dari dokumen tarifnya",
};

export default function HospitalsPage({ searchParams }: PageProps<"/rumah-sakit">) {
  return <HospitalListPage view="rujukan" searchParams={searchParams} />;
}
