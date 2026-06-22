-- database f/canvass_map/database
SELECT
     e.id,
     e.title,
     e.start_time,
     e.end_time,
     e.location_name,
     e.location_address,
     e.neighborhood,
     e.url
   FROM event e
   WHERE
     e.deleted_at IS NULL
     AND 'gotv' = ANY(e.tags)

     -- GOTV window: Jun 13–23, 2026 in NYC, stored as UTC
     AND e.start_time >= TIMESTAMP '2026-06-13 04:00:00'
     AND e.start_time <  TIMESTAMP '2026-06-24 04:00:00'

     -- Does not overlap any canonical GOTV time block
     AND NOT EXISTS (
       SELECT 1
       FROM time_block tb
       WHERE
         e.start_time < tb.end_time
         AND e.end_time > tb.start_time
     )

     -- And is in the future
     AND e.start_time >= now()
   ORDER BY e.start_time ASC, e.location_name ASC
