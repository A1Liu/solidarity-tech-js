-- database f/canvass_map/database

with brad_events as (
  select id, start_time, end_time
  from event
  where deleted_at is null
    and campaigns && ARRAY['Brad Lander']::text[]
),
brad_submissions as (
  select
    regexp_replace(data->>'phone', '[^0-9]', '', 'g') as phone_digits,
    case
      when length(regexp_replace(data->>'phone', '[^0-9]', '', 'g')) = 11
        then '+' || regexp_replace(data->>'phone', '[^0-9]', '', 'g')
      else regexp_replace(data->>'phone', '[^0-9]', '', 'g')
    end as phone,
    data->>'firstName' as first_name,
    data->>'lastName' as last_name,
    data->>'email' as email,
    data->>'zip' as zip,
    source,
    referrer,
    created_at,
    rsvp_completed_at,
    data->'availability' as availability
  from availability_submission
  where data->>'phone' is not null
    and regexp_replace(data->>'phone', '[^0-9]', '', 'g') <> ''
    and jsonb_typeof(data->'campaignFilter') = 'array'
    and exists (
      select 1
      from jsonb_array_elements_text(data->'campaignFilter') as campaign(campaign_name)
      where campaign_name = 'Brad Lander'
    )
),
deduped as (
  select distinct on (phone_digits)
    phone_digits,
    phone,
    first_name,
    last_name,
    email,
    zip,
    source,
    referrer,
    created_at,
    rsvp_completed_at,
    availability
  from brad_submissions
  order by phone_digits, created_at desc nulls last
),
profile_phones as (
  select distinct
    regexp_replace(phone, '[^0-9]', '', 'g') as phone_digits,
    id as profile_id
  from profile
  where phone is not null
    and regexp_replace(phone, '[^0-9]', '', 'g') <> ''
),
phone_rsvps as (
  select distinct
    pp.phone_digits,
    r.event_id,
    e.start_time,
    e.end_time,
    coalesce(e.campaigns, ARRAY[]::text[]) && ARRAY['Brad Lander']::text[] as is_brad_event
  from profile_phones pp
  join rsvp r on r.profile_id = pp.profile_id
  join event e on e.id = r.event_id
  where r.status = 'yes'
    and e.deleted_at is null
),
status_by_brad_event as (
  select
    d.phone_digits,
    be.id as brad_event_id,
    case
      when exists (
        select 1
        from phone_rsvps pr
        where pr.phone_digits = d.phone_digits
          and pr.event_id = be.id
      ) then 'RSVPed for Brad'
      when exists (
        select 1
        from phone_rsvps pr
        where pr.phone_digits = d.phone_digits
          and not pr.is_brad_event
          and pr.start_time < be.end_time
          and pr.end_time > be.start_time
      ) then 'RSVPed for other candidate'
      when exists (
        select 1
        from jsonb_array_elements(d.availability) as availability_block(block)
        where (availability_block.block->>'start')::timestamptz at time zone 'UTC' < be.end_time
          and (availability_block.block->>'end')::timestamptz at time zone 'UTC' > be.start_time
      ) then 'Available but no RSVP'
      else ''
    end as status
  from deduped d
  cross join brad_events be
)
select
  d.phone,
  d.first_name,
  d.last_name,
  d.email,
  d.zip,
  d.source,
  d.referrer,
  d.created_at,
  d.rsvp_completed_at,
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-19-1400') as "Thu 6/19 2-5 PM",
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-19-1700') as "Thu 6/19 5-8 PM",
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-20-1000') as "Fri 6/20 10 AM-1 PM",
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-20-1300') as "Fri 6/20 1-4 PM",
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-20-1600') as "Fri 6/20 4-7 PM",
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-21-1000') as "Sat 6/21 10 AM-1 PM",
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-21-1300') as "Sat 6/21 1-4 PM",
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-21-1600') as "Sat 6/21 4-7 PM",
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-23-0700') as "Mon 6/23 7-10 AM",
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-23-1000') as "Mon 6/23 10 AM-12 PM",
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-23-1200') as "Mon 6/23 12-3 PM",
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-23-1500') as "Mon 6/23 3-6 PM",
  max(s.status) filter (where s.brad_event_id = 'fake.brad-lander-gotv-2026-06-23-1800') as "Mon 6/23 6-8 PM"
from deduped d
left join status_by_brad_event s on s.phone_digits = d.phone_digits
group by
  d.phone_digits,
  d.phone,
  d.first_name,
  d.last_name,
  d.email,
  d.zip,
  d.source,
  d.referrer,
  d.created_at,
  d.rsvp_completed_at,
  d.availability
order by d.created_at desc nulls last, d.phone;