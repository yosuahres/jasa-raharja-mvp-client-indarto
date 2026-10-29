-- Map pins for Peta Rumah Sakit, for hospitals OpenStreetMap can't find by the names their documents
-- print, so the map lists them under "Lokasi belum ditemukan".
-- Run after migrations/008_hospital_location.sql, once the hospitals are in. Safe to run more than once.
--
-- 1. The sample hospitals get OpenStreetMap's coordinates:
--   RSUD Dr. Soedono Madiun          — Jl. Dokter Sutomo 59, Kartoharjo, Kota Madiun
--   Rumah Sakit Universitas Surabaya — Jl. Raya Panjang Jiwo Permai, Tenggilis Mejoyo, Surabaya
--   RSUD Dr. Iskak Tulungagung       — Jl. Dokter Wahidin Sudirohusodo, Kepatihan, Tulungagung
-- RS Ubaya's document prints no city, so it gets Surabaya too — the map's and Cari Rujukan's city lists
-- then include it.
--
-- 2. Every other hospital still without a pin gets a DUMMY one: near the centre of its city (matched on
-- its city, else on a city in its name, else Surabaya), moved up to ~2 km by a fixed offset from its id
-- so hospitals in one city don't sit on top of each other. Re-running gives the same pins. Pins that
-- already exist are left as they are.
--
-- geocoded_query is set to exactly what the dashboard would look up (name, address, city, province,
-- the empty ones left out — lib/geocode.ts), so the geocoder leaves these pins alone. A new document
-- with a different name or address looks the hospital up again, and that lookup can clear the pin;
-- run this file again if it does.

update public.hospitals
set city = case when city = '' then 'Surabaya' else city end,
    province = case when province = '' then 'Jawa Timur' else province end
where upper(name) like '%UBAYA%';

update public.hospitals as h
set lat = pin.lat,
    lng = pin.lng,
    geocoded_query = concat_ws(', ', nullif(h.name, ''), nullif(h.address, ''), nullif(h.city, ''), nullif(h.province, '')),
    geocoded_at = now()
from (values
  ('%SOEDONO%', -7.6266935, 111.5245179),
  ('%UBAYA%',   -7.3141801, 112.7662757),
  ('%ISKAK%',   -8.0540317, 111.9181394)
) as pin (name_like, lat, lng)
where upper(h.name) like pin.name_like;

with city_centre (city, lat, lng) as (
  values
    ('surabaya', -7.2575, 112.7521), ('madiun', -7.6298, 111.5239), ('tulungagung', -8.0657, 111.9025),
    ('malang', -7.9666, 112.6326), ('batu', -7.8672, 112.5239), ('kediri', -7.8480, 112.0178),
    ('blitar', -8.0955, 112.1609), ('mojokerto', -7.4722, 112.4338), ('pasuruan', -7.6453, 112.9075),
    ('probolinggo', -7.7543, 113.2159), ('sidoarjo', -7.4478, 112.7183), ('gresik', -7.1566, 112.6555),
    ('lamongan', -7.1167, 112.4167), ('tuban', -6.8976, 112.0649), ('bojonegoro', -7.1502, 111.8817),
    ('ngawi', -7.4040, 111.4464), ('magetan', -7.6493, 111.3381), ('ponorogo', -7.8651, 111.4696),
    ('pacitan', -8.2050, 111.0930), ('trenggalek', -8.0500, 111.7167), ('nganjuk', -7.6051, 111.9035),
    ('jombang', -7.5460, 112.2330), ('lumajang', -8.1335, 113.2248), ('jember', -8.1724, 113.7000),
    ('bondowoso', -7.9135, 113.8215), ('situbondo', -7.7064, 114.0094), ('banyuwangi', -8.2191, 114.3691),
    ('bangkalan', -7.0455, 112.7351), ('sampang', -7.1873, 113.2399), ('pamekasan', -7.1568, 113.4746),
    ('sumenep', -7.0167, 113.8667), ('jakarta', -6.2088, 106.8456), ('bandung', -6.9175, 107.6191),
    ('semarang', -6.9667, 110.4167), ('yogyakarta', -7.7956, 110.3695), ('surakarta', -7.5755, 110.8243),
    ('solo', -7.5755, 110.8243), ('denpasar', -8.6705, 115.2126)
),
dummy as (
  select h.id,
         centre.lat + (abs(hashtext(h.id)) % 1000 - 500) / 25000.0 as lat,
         centre.lng + (abs(hashtext(h.id || ':lng')) % 1000 - 500) / 25000.0 as lng
  from public.hospitals as h
  cross join lateral (
    select c.lat, c.lng
    from city_centre as c
    order by
      case
        when regexp_replace(lower(trim(h.city)), '^(kota|kabupaten|kab\.?)\s+', '') = c.city then 0
        when lower(h.name) like '%' || c.city || '%' then 1
        when c.city = 'surabaya' then 2
        else 3
      end,
      length(c.city) desc
    limit 1
  ) as centre
  where h.lat is null
)
update public.hospitals as h
set lat = dummy.lat,
    lng = dummy.lng,
    geocoded_query = concat_ws(', ', nullif(h.name, ''), nullif(h.address, ''), nullif(h.city, ''), nullif(h.province, '')),
    geocoded_at = now()
from dummy
where h.id = dummy.id;

-- What the map now shows: every hospital with its pin.
select name, city, round(lat::numeric, 5) as lat, round(lng::numeric, 5) as lng from public.hospitals order by city, name;
