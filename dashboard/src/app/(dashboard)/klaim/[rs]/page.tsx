import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ClaimProfile } from "@/components/claims/claim-profile";
import { RiskBadge, RuleTags } from "@/components/claims/table";
import { claimSlug, hospitalDetail, riskOf } from "@/lib/claims/analysis";
import { claimNameOf, getClaimAnalysis, getHospitalClaims } from "@/lib/data/claims";
import { getHospitals } from "@/lib/data/queries";
import { jrNameParts } from "@/lib/hospital-match";

const findHospital = async (slug: string) => (await getClaimAnalysis())?.hospitals.find((h) => claimSlug(h.name) === slug);

export async function generateMetadata({ params }: PageProps<"/klaim/[rs]">): Promise<Metadata> {
  const hospital = await findHospital((await params).rs);
  return { title: hospital ? jrNameParts(hospital.name).name : "Rumah Sakit" };
}

/**
 * A hospital only in the claim data: no tariff document, so its page is its claims. A hospital the app
 * has goes to its own page, which shows its claims in a tab.
 */
export default async function HospitalClaimsPage({ params }: PageProps<"/klaim/[rs]">) {
  const { rs } = await params;
  const [analysis, hospitals] = await Promise.all([getClaimAnalysis(), getHospitals()]);
  const hospital = analysis?.hospitals.find((h) => claimSlug(h.name) === rs);
  if (!analysis || !hospital) notFound();

  const inApp = hospitals.find((h) => claimNameOf(h, [hospital.name]) === hospital.name);
  if (inApp) redirect(`/rumah-sakit/${inApp.id}?tab=klaim`);

  const detail = hospitalDetail(await getHospitalClaims(hospital.name), analysis.baselines[hospital.name]);
  const { name, place } = jrNameParts(hospital.name);

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-4 sm:px-6">
      <div>
        <Link href="/rumah-sakit" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3.5" />
          Rumah Sakit
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
          {hospital.redFlags.length > 0 && <RiskBadge risk={riskOf(hospital.redFlags.length)} />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {[place, hospital.loket].filter(Boolean).join(" · ")}
          <span>· Belum ada data tarif</span>
          {hospital.redFlags.length > 0 && <RuleTags rules={hospital.redFlags} />}
        </div>
      </div>
      <ClaimProfile hospital={hospital} detail={detail} limits={analysis.limits} />
    </div>
  );
}
