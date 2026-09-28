-- Share of permits in each work stage, by development tier (mapped ZIPs).
-- Patched-up ZIPs mostly repair; built-up ZIPs build new.

with mapped as (

    select zip_code, development_tier
    from {{ ref('zip_development') }}
    where is_in_dallas and has_enough_permits

),

counts as (

    select
        m.development_tier,
        p.work_stage,
        count(*) as permit_count
    from {{ ref('int_permits_classified') }} p
    join mapped m on p.zip_code = m.zip_code
    group by 1, 2

)

select
    development_tier,
    work_stage,
    permit_count,
    permit_count / sum(permit_count) over (partition by development_tier) as share_of_tier_permits
from counts
