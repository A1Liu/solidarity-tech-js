SELECT
*,
st_automation_status::text as automation_status,
1
FROM event e
WHERE
source = 'st'
AND e.campaigns && ARRAY[
'David Orkin',
'Diana Moreno',
'Christian Celeste Tate',
'Eon Huntley',
'Jabari Brisport',
'Aber Kawas',
'Claire Valdez',
'Samantha Kattan'
]
AND deleted_at IS NULL 
AND 'gotv' = ANY(tags) 
AND NOT 'phonebank' = ANY(tags)