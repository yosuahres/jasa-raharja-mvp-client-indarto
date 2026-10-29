import {
  Banknote,
  BedDouble,
  Building,
  CalendarRange,
  ChevronDown,
  FileText,
  GitCompareArrows,
  HeartPulse,
  Landmark,
  ListChecks,
  type LucideIcon,
  Map as MapIcon,
  MapPin,
  RefreshCw,
  Shapes,
  Store,
  Trophy,
} from "lucide-react";
import Link from "next/link";

import { RatingPill } from "@/components/rating";
import { ScoreParameters } from "@/components/score-parameters";
import { TipeBadge } from "@/components/tier-badge";
import type { Hospital } from "@/lib/data/types";
import type { HospitalSummary } from "@/lib/scoring";
import { bookYear, type Completeness } from "@/lib/tariff-book";
import { cn } from "@/lib/utils";

import { BookFact, ProfileFact } from "./editable-facts";

const ACTION =
  "flex h-7 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-muted px-2 text-xs text-foreground transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50";

/** The hospital page's left pane: its name and actions, then every fact about it in foldable sections; the profile and document facts are edited in place. */
export function ProfileSidebar({
  summary,
  peer,
  completeness,
}: {
  summary: HospitalSummary;
  /** Who the compare button pairs it with. */
  peer?: Hospital;
  completeness: Completeness;
}) {
  const { hospital } = summary;
  const book = hospital.tariffBook;
  const compareIds = peer ? [hospital.id, peer.id] : [hospital.id];
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([hospital.name, hospital.city].filter(Boolean).join(" "))}`;
  const complete = completeness.filter((c) => c.complete).length;

  return (
    <>
      <div className="flex flex-col gap-2 border-b px-4 pt-2.5 pb-3">
        <h1 className="text-base leading-snug font-semibold text-balance break-words">
          <ProfileFact hospitalId={hospital.id} field="name" value={hospital.name} />
        </h1>
        <div className="flex w-full items-stretch gap-2">
          <Link
            href={`/bandingkan?rs=${compareIds.join(",")}`}
            title={peer ? `Bandingkan dengan ${peer.name}` : "Bandingkan"}
            className={ACTION}
          >
            <GitCompareArrows className="size-3.5 shrink-0" />
            <span className="truncate">Bandingkan</span>
          </Link>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" title="Cari di Google Maps" className={ACTION}>
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">Maps</span>
          </a>
        </div>
        <Link
          href={`/rumah-sakit/${hospital.id}/perbarui`}
          className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <RefreshCw className="size-3.5 shrink-0" />
          Perbarui data tarif
        </Link>
      </div>

      <Section title="Penilaian">
        <Field icon={Trophy} label="Peringkat">
          {summary.placing && (
            <span className="tabular-nums">
              <span className="font-medium">{summary.placing.rank}</span>
              <span className="text-muted-foreground"> dari {summary.placing.of}</span>
            </span>
          )}
        </Field>
        <Field icon={Shapes} label="Tipe">
          {summary.tipe && <TipeBadge tipe={summary.tipe} />}
        </Field>
        <Field icon={Banknote} label="Harga">
          {hospital.tariffBook ? (
            <>
              <RatingPill level={summary.price?.level ?? null} />
              {summary.price && <span className="block text-xs text-muted-foreground">{summary.price.reason}</span>}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Belum ada data tarif</span>
          )}
        </Field>
        <Field icon={HeartPulse} label="Layanan">
          {summary.services ? (
            <>
              <RatingPill level={summary.services.level} />
              <span className="block text-xs text-muted-foreground">{summary.services.reason}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Belum ada data tarif</span>
          )}
        </Field>
      </Section>

      <Section title="Penilaian per parameter">
        {/* Without a tariff document, facilities or specialists there is nothing to score: zeros would be made up. */}
        {hospital.tariffBook || hospital.facilities.length > 0 || hospital.staff.length > 0 ? (
          <ScoreParameters parameters={summary.parameters} total={summary.servicesScore} />
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada data</p>
        )}
      </Section>

      <Section title="Profil">
        <Field icon={Store} label="Loket">
          {hospital.jasaRaharja ? (
            <>
              {hospital.jasaRaharja.loketName}
              <span className="block text-xs text-muted-foreground tabular-nums">kode RS {hospital.jasaRaharja.code}</span>
            </>
          ) : (
            <Link href="/input?jenis=daftar-rs&tahap=periksa" className="text-tier-c-ink hover:underline">
              Belum terhubung ke daftar RS Jasa Raharja
            </Link>
          )}
        </Field>
        <Field icon={Landmark} label="Kepemilikan">
          <ProfileFact hospitalId={hospital.id} field="ownership" value={hospital.ownership ?? ""} />
        </Field>
        <Field icon={BedDouble} label="Tempat tidur">
          <ProfileFact hospitalId={hospital.id} field="beds" value={hospital.beds > 0 ? String(hospital.beds) : ""} />
        </Field>
        <Field icon={MapPin} label="Alamat">
          <ProfileFact hospitalId={hospital.id} field="address" value={hospital.address} />
        </Field>
        <Field icon={Building} label="Kota">
          <ProfileFact hospitalId={hospital.id} field="city" value={hospital.city} />
        </Field>
        <Field icon={MapIcon} label="Provinsi">
          <ProfileFact hospitalId={hospital.id} field="province" value={hospital.province} />
        </Field>
      </Section>

      <Section title="Data tarif">
        {book ? (
          <>
            <Field icon={FileText} label="Versi">
              <BookFact bookId={book.id} field="version" value={book.version} />
            </Field>
            <Field icon={CalendarRange} label="Tahun tarif">
              <BookFact bookId={book.id} field="year" value={String(bookYear(book) ?? "")} />
            </Field>
          </>
        ) : (
          <Field icon={FileText} label="Dokumen">
            <span className="text-tier-c-ink">Belum ada data tarif terbit</span>
          </Field>
        )}
        <Field icon={ListChecks} label="Kelengkapan">
          <span className={cn("tabular-nums", complete < completeness.length && "text-tier-c-ink")}>
            {complete}/{completeness.length}
          </span>
        </Field>
      </Section>
    </>
  );
}

/** A foldable section. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="group/section border-b">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-2 text-sm transition-colors outline-none hover:bg-accent/50 focus-visible:bg-accent/50 [&::-webkit-details-marker]:hidden">
        <span className="truncate">{title}</span>
        <ChevronDown className="size-3.5 shrink-0 -rotate-90 text-muted-foreground transition-transform group-open/section:rotate-0" />
      </summary>
      <dl className="flex flex-col gap-2 px-4 pb-4 text-sm">{children}</dl>
    </details>
  );
}

/** A label that widens with the pane, and its value; an empty value shows as a dash. */
function Field({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  const empty = children === null || children === undefined || children === false || children === "";

  return (
    <div className="flex items-start gap-2 py-0.5">
      <dt className="flex w-[clamp(6.5rem,calc(var(--sidebar-w,288px)*0.34),12rem)] shrink-0 items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className={cn("min-w-0 flex-1 break-words", empty && "text-muted-foreground")}>{empty ? "—" : children}</dd>
    </div>
  );
}
