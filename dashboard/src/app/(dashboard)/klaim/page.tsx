import { redirect } from "next/navigation";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Klaim RS is now part of Rumah Sakit: older links land there, highest claim risk first. */
export default async function ClaimsPage({ searchParams }: PageProps<"/klaim">) {
  const loket = first((await searchParams).loket);
  redirect(`/rumah-sakit?urut=risiko${loket ? `&loket=${encodeURIComponent(loket)}` : ""}`);
}
