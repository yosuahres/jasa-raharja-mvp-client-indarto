-- Where a hospital's pin came from, so the lookup after an edit never moves or clears a pin someone
-- placed or checked, and the map and Cari Rujukan can tell an approximate pin from a found one:
--   geocoder  found by the dashboard's own lookup of its name and address (lib/geocode.ts)
--   osm       checked by hand against OpenStreetMap (hospital_locations.sql); the lookup leaves it alone
--   manual    put on the map on the hospital's page; the lookup leaves it alone
--   dummy     approximate: the lookup found only its town or city, not the hospital itself
-- Run after 008_hospital_location.sql. Safe to run more than once.

alter table public.hospitals add column if not exists location_source text;

alter table public.hospitals drop constraint if exists hospitals_location_source_check;
alter table public.hospitals add constraint hospitals_location_source_check
  check (location_source in ('geocoder', 'osm', 'manual', 'dummy'));

-- Pins from before this column were all found by the lookup; hospital_locations.sql then marks its own.
update public.hospitals set location_source = 'geocoder' where lat is not null and location_source is null;
