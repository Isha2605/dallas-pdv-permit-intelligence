-- The five most common kinds of housing work in each ZIP.
-- Feeds the dashboard's ZIP detail panel: this is what makes a number like
-- "beats its income by 13 places" concrete -- in 75216 it is 404 permits to
-- build new single-family homes.

with housing_work as (

    select
        zip_code,
        upper(work_description) as work_description,
        count(*)                as permit_count,
        sum(value)              as total_value
    from {{ ref('int_permits_classified') }}
    where zip_code is not null
      and is_residential
      and work_description is not null
    group by zip_code, upper(work_description)

),

ranked as (

    select
        housing_work.*,
        row_number() over (
            partition by zip_code
            order by permit_count desc, work_description
        ) as rank_in_zip
    from housing_work

)

select
    zip_code,
    rank_in_zip,
    work_description,
    permit_count,
    total_value
from ranked
where rank_in_zip <= 5
