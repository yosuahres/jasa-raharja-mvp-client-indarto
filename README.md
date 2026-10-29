# Jasa Raharja — Hospital Tiering

Prototype for recommending referral hospitals for traffic-accident victims based on
tariff books, facilities, and medical staff.

- `dashboard/` — Next.js 16 + Tailwind + shadcn/ui + Recharts, on Supabase (auth, database, file storage).
  Scoring logic lives in `src/lib/scoring.ts`.
- `extractor/` — Python extractor that turns tariff book PDFs into reviewable tariff rows, plus a
  worker that picks up books uploaded from the dashboard.
- `dashboard/supabase/` — `schema.sql` (tables, access rules, storage bucket) and an optional `seed_catalog.sql`.

## Setup

1. **Create a Supabase project.** In the SQL editor run `dashboard/supabase/schema.sql`. A database set up
   with an earlier version runs the files in `dashboard/supabase/migrations/` it hasn't run yet, in order.
   There is no data to load: hospitals and tariffs come from uploaded documents. The facilities and
   specialists the system recognises live in `extractor/app/catalog.py`, and the worker writes them to the
   database when it starts.
2. **Dashboard:** copy `dashboard/.env.example` to `dashboard/.env.local` and fill in the project URL
   and publishable key, then:

   ```bash
   cd dashboard
   pnpm install
   pnpm dev        # http://localhost:3000, sign up, then sign in
   ```

   Supabase asks new users to confirm their email by default (Authentication → Sign In / Providers).
3. **Extractor worker:** copy `extractor/.env.example` to `extractor/.env` and fill in the project URL
   and secret key, then keep it running:

   ```bash
   cd extractor
   python -m venv .venv && .venv/bin/pip install -r requirements.txt
   .venv/bin/python -m app.worker
   ```

A tariff document is the only input. Upload it from **Upload dokumen** (top bar); nothing is typed:

1. **Upload.** Drop the PDF. It goes to Storage and the worker picks it up.
2. **Read.** The worker finds which hospital the document is about (a regulation listing many hospitals:
   the one the file name names, else the one with the most pages) and extracts all of that hospital's
   rows. It reads the hospital's profile from the text: name, city and province, year, address,
   ownership and whether it is a partner ("Rekanan"). Facilities and specialists are recognised from the
   rows; how many and their hours aren't printed, so they stay empty. Nothing is looked up elsewhere; a
   field the document doesn't print stays empty.
3. **File.** Every row is kept and filed under a kind of service (tindakan operatif, radiologi,
   laboratorium, kamar & rawat inap, …) from its name and the headings it sits under
   (`extractor/app/categories.py`). There is no predefined list of injury cases or procedures.
4. **Preview and save.** The dashboard shows every field with where it was read, and every row by
   category. Saving creates the hospital, or updates the one with the same name, and publishes.

**Rumah Sakit** ranks hospitals on their prices against other hospitals' and on what their document
shows they offer: specialists and facilities recognised, how many kinds of service it prices, and an
emergency room and ambulance. That ranking, split into quarters, is the hospital's tipe (A to D); it is
not read from the document. **Cari Rujukan** takes what is needed in words
("kraniotomi", "CT scan kepala") and a city, finds the rows that name it in every hospital's document, and
ranks those hospitals by that price against the median, their general score, and same city / province.

**Klaim RS** works from Jasa Raharja's claim export (one row per guarantee letter: LOS, diagnosis, operation,
room class, amount billed and paid), uploaded as an .xlsx from Input Data; each upload replaces the last.
Each claim is compared with similar claims at other hospitals (same jenis rawatan, ICD-10 category, operation
status and room class; a hospital's own claims never set its bar) and flagged when it is a short stay at a high
cost, a stay longer than 90% of its peers', a minor injury at the cost of a severe one, or no operation at the
cost of an operated case. Cost is the amount billed, as the amount paid stops at the Rp20 juta cap. A hospital is
a red flag on a rule when its share of flagged claims is in the top 20% of hospitals (CMS PEPPER's 80th
percentile, at least 11 claims) and too high to be chance (one-sided binomial test, p < 0.05), and red flags
are ordered by what the hospital was paid above the peer median. The method is in `src/lib/claims/analysis.ts`.

## Deploying (VPS)

Both services run on the majorsales VPS beside the `majorsales-binapatria` stack, which already runs
Traefik and Watchtower on the external `project-network`. `docker-compose.yml` here starts only the
dashboard and the worker: Traefik serves the dashboard at `JR_DOMAIN` (default
`jasaraharja.majorsaleshub.com`, under the existing wildcard) with its `myresolver` certificate and
`crowdsec` middleware. The worker is woken over HTTPS at `JR_EXTRACTOR_DOMAIN` (default
`jasaraharja-extractor.majorsaleshub.com`): the dashboard calls `POST /wake` with `EXTRACTOR_SECRET` when it
queues a book (`extractor/app/wake.py`). It still polls Supabase every 60 seconds, so a book queued while the
endpoint is unreachable is picked up anyway. Set the same `EXTRACTOR_SECRET` in `extractor/.env` and, with
`EXTRACTOR_URL`, wherever the dashboard runs (Vercel → Settings → Environment Variables).

Every push to `main` runs the extractor tests and the dashboard lint, then builds
`ghcr.io/yosuahres/jasa-raharja-extractor:prod` and `ghcr.io/yosuahres/jasa-raharja-dashboard:prod`
(`.github/workflows/deploy.yml`). Watchtower pulls new images within 30 seconds.

Once, before the first deploy:

1. GitHub repository → Settings → Secrets → Actions: add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. They are inlined into the dashboard image when it is built.
2. Let the VPS pull the images. The server and its Watchtower are logged in to `ghcr.io` as the majorsales
   account (`/home/majorsales/.docker/config.json`), so give that account read access to both packages
   (package → Package settings → Manage access), or make the packages public.
3. On the server:

   ```bash
   git clone https://github.com/yosuahres/jasa-raharja-mvp.git jasa-raharja && cd jasa-raharja
   cp .env.docker.example .env                      # JR_DOMAIN
   cp extractor/.env.example extractor/.env         # SUPABASE_URL, SUPABASE_SECRET_KEY
   docker compose pull && docker compose up -d
   ```
4. Supabase → Authentication → URL Configuration: set the Site URL to `https://<JR_DOMAIN>` so sign-up
   confirmation emails link to the server, not localhost.

A change to `docker-compose.yml` (a label, the domain) needs `git pull && docker compose up -d` on the
server; an image swap doesn't deliver it. Logs: `docker compose logs -f extractor`.

## Extracting a tariff book

```bash
cd extractor
python -m venv .venv && .venv/bin/pip install -r requirements.txt

# A hospital's own book (its name only appears on a scanned cover)
.venv/bin/python -m app.cli "../data/Buku Tarif Rekanan RS Ubaya Tahun 2025_Update.pdf" \
    --facility-name "RS Ubaya" --out ubaya.json --csv ubaya.csv

# One hospital out of a regulation that lists many (Pergub Jatim: ~2 min for 2,954 pages)
.venv/bin/python -m app.cli "../data/1. TARIF RSUD DR SOEDONO MADIUN.pdf" \
    --facility SOEDONO --out soedono.json --csv soedono.csv

.venv/bin/python -m pytest      # regression tests against the sample books in data/
```

The extractor is plain Python on top of pymupdf: it reads the ruled tables from the
PDF's text layer, with no AI model or API calls. It works on any book whose tables are
drawn with lines, whatever its columns:

- **Price columns** are labelled from their full header path, e.g. `KELAS PERAWATAN / VIP`,
  `TARIF BARU / EKSEKUTIF`, `TARIF / NON. PAV`. Prices under `TARIF LAMA` are marked
  `superseded`. A price cell merged across several class columns applies to each.
- **Rows** carry `facility`, `part` (which part of a regulation), `section` (headings),
  `parents` (list nesting such as `Rawat Inap Kelas III › a. Kamar`), `unit`, and `members`:
  unpriced lines listed under a priced line, such as the procedures in
  "Kelompok Bedah F", which all take its price.
- **Nothing unclear is guessed.** Each run also writes `<out>_review.csv`, listing what a
  person should check against the PDF: prices that aren't plain numbers (text, typos, `0`),
  names joined across a page break, tables with no header row, and scanned pages that
  have no text to read.

