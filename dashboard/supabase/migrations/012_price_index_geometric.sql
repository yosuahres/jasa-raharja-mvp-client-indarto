-- The price index, sturdier: each row is compared with the median of the same row at the other
-- hospitals (its own price left out, so with two hospitals it is simply one against the other); the
-- ratios are averaged geometrically (the usual price-index mean: one row priced per day against
-- another's per visit can't swamp the rest, and 2× dearer weighs as much as 2× cheaper); and a
-- hospital needs at least 5 shared rows to be rated at all. Safe to run more than once.

create or replace view public.hospital_price_index with (security_invoker = true) as
with current_books as (
  -- A hospital's current document is its latest published one.
  select distinct on (hospital_id) id, hospital_id
  from public.tariff_books
  where status = 'published' and hospital_id is not null
  order by hospital_id, published_at desc
),
row_prices as (
  select b.hospital_id,
         trim(regexp_replace(upper(r.raw_name), '[^A-Z0-9]+', ' ', 'g')) as name_key,
         (min(p.amount) + max(p.amount)) / 2.0 as mid
  from current_books b
  join public.tariff_rows r on r.book_id = b.id
  join public.tariff_prices p on p.row_id = r.id
  where p.amount > 0 and not p.superseded
  group by b.hospital_id, r.id, r.raw_name
),
-- One price per name per hospital: a document can list the same name in several sections.
hospital_prices as (
  select hospital_id, name_key, percentile_cont(0.5) within group (order by mid) as mid
  from row_prices
  where length(name_key) >= 4
  group by hospital_id, name_key
),
-- Each of a hospital's rows against the median of the same row at the other hospitals.
compared as (
  select h.hospital_id, h.mid, percentile_cont(0.5) within group (order by o.mid) as others
  from hospital_prices h
  join hospital_prices o on o.name_key = h.name_key and o.hospital_id <> h.hospital_id
  group by h.hospital_id, h.name_key, h.mid
)
select hospital_id,
       exp(avg(ln(mid / others))) as price_index,  -- 0.92: 8% cheaper than the other hospitals on the same rows
       count(*)::integer as compared_rows
from compared
group by hospital_id
having count(*) >= 5;
