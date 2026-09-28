-- The time windows every ZIP metric is computed over.
--   study_period : all loaded data. Reproduces the reference numbers in src/check_numbers.py.
--   rolling_12m  : 12 months ending at each month end. Powers the live features.
-- Derived from the data itself, so a new month of permits adds a new window automatically.

with bounds as (

    select min(issued_date) as first_date, max(issued_date) as last_date
    from {{ ref('stg_permits') }}

),

months as (

    select
        last_day(dateadd(month, row_number() over (order by seq4()) - 1,
                         date_trunc(month, b.first_date))) as month_end,
        b.first_date,
        b.last_date
    from bounds b
    cross join table(generator(rowcount => 600))

),

rolling as (

    select
        '12m_' || to_char(month_end, 'YYYY-MM')              as window_id,
        'rolling_12m'                                        as window_type,
        dateadd(day, 1, dateadd(month, -12, month_end))      as window_start,
        -- The latest month may be partial: the window ends at the last permit loaded.
        least(month_end, last_date)                          as window_end
    from months
    -- Only windows with a full 12 months of data behind them.
    where month_end >= last_day(dateadd(month, 11, date_trunc(month, first_date)))
      and month_end <= last_day(last_date)

),

study as (

    select
        'study_period'  as window_id,
        'study_period'  as window_type,
        first_date      as window_start,
        last_date       as window_end
    from bounds

),

windows as (

    select * from rolling
    union all
    select * from study

)

select
    *,
    window_end = max(window_end) over (partition by window_type) as is_latest
from windows
