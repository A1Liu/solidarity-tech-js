ATTACH 'res://f/canvass_map/database' AS canvass_map (TYPE postgres);
ATTACH 'res://f/electoral_p2p/pg' AS electoral_p2p (TYPE postgres);

WITH cancelled_rsvp AS (
  SELECT
    session_id,
    phone_number,
    is_attending,
    attended
  FROM electoral_p2p.electoral_p2p.slate_rsvps sr
  WHERE
    sr.is_attending = 'no' AND NOT sr.attended
), prof AS (
  SELECT
    id as profile_id,
    first_name,
    last_name,
    strftime(created_at, '%d %b %Y %H:%M:%S %Z') AS profile_created_at,
    email,
    right(regexp_replace(phone, '[^0-9a-zA-Z]', '', 'g'), 10) AS phone_number
  FROM canvass_map.public.profile
), cancelled_rsvp_prof AS (
  SELECT *
  FROM cancelled_rsvp cr
  JOIN prof p ON p.phone_number = cr.phone_number
)
UPDATE canvass_map.public.rsvp r
SET
  status = 'deleted'
FROM cancelled_rsvp_prof crp
WHERE
  crp.profile_id = r.profile_id
  AND CONCAT('st.', crp.session_id::text) = r.event_id
  AND r.submitted_at IS NOT NULL
  AND r.submitted_at < (current_timestamp::timestamp - INTERVAL '30 minute')
