-- Jasa Raharja's claim data: one row per guarantee letter (GL) paid to a hospital, from the claims
-- export spreadsheet ("LENGTH OF STAY (LOS) PER GL"). Uploaded whole from the Input Data page; each
-- upload replaces the previous one. The red flags and hospital profiles are worked out from these rows
-- in the dashboard (src/lib/claims/analysis.ts). Safe to run more than once.

create table if not exists public.claim_imports (
  id          uuid primary key default gen_random_uuid(),
  source_file text not null,
  row_count   integer not null default 0,
  -- 'loading' while its rows arrive in chunks; 'active' once complete, when the older import goes.
  status      text not null default 'loading' check (status in ('loading', 'active')),
  created_at  timestamptz not null default now()
);

create table if not exists public.claims (
  id              bigint generated always as identity primary key,
  import_id       uuid not null references public.claim_imports (id) on delete cascade,
  guarantee_id    text not null,      -- ID Jaminan
  victim_name     text,               -- Nama Korban
  los             integer,            -- LOS, days; empty for Rawat Jalan
  care_type       text,               -- Jenis Rawatan: 'Rawat Inap' | 'Rawat Jalan'
  hospital_name   text not null,      -- Nama Rumah Sakit, e.g. 'RSUD SOEDONO, KOTA MADIUN'
  diagnosis       text,               -- Diagnosa Cedera, ending in its ICD-10 code, e.g. 'Concussion S06.0'
  injury_category text,               -- Kategori Cedera: 'Ringan' | 'Sedang' | 'Berat'
  surgery         text,               -- Tindakan Operasi, 'Tidak Ada' when none
  procedure_note  text,               -- Deskripsi Tindakan
  room_class      text,               -- Kelas Kamar
  billed          numeric,            -- Nilai Klaim Diajukan
  paid            numeric,            -- Nilai Klaim Dibayarkan
  region          text,               -- Wilayah
  loket           text                -- Loket
);

create index if not exists claims_import_hospital on public.claims (import_id, hospital_name);

alter table public.claim_imports enable row level security;
alter table public.claims enable row level security;
drop policy if exists "signed-in staff" on public.claim_imports;
create policy "signed-in staff" on public.claim_imports for all to authenticated using (true) with check (true);
drop policy if exists "signed-in staff" on public.claims;
create policy "signed-in staff" on public.claims for all to authenticated using (true) with check (true);
