-- One row per ZIP per month: every ZIP metric over the 12 months ending that month.
-- Powers the live features: current state (is_latest), tier movement, and trends.

select
    window_end as as_of_date,
    window_start,
    is_latest,
    * exclude (window_id, window_type, window_start, window_end, is_latest),
    previous_tier is not null and previous_tier <> development_tier as tier_changed
from {{ ref('int_zip_windows') }}
where window_type = 'rolling_12m'
