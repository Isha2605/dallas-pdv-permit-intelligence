-- One row per ZIP over the full study period: permit activity joined to Census context.
-- The logic lives in int_zip_windows; this is its study-period slice.

select * exclude (window_id, window_type, window_start, window_end, is_latest, previous_tier)
from {{ ref('int_zip_windows') }}
where window_type = 'study_period'
