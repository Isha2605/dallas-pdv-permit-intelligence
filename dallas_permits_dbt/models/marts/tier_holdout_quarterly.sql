-- Non-circular check on "big projects keep returning to the same places".
-- The study-period tiers are defined from the same $1M+ projects that
-- tier_quarterly_big_projects counts, so that chart is partly circular.
-- Here the tier is set from 2018 permits only (same cutoff: >= 30 $1M+ projects
-- per 1,000 permits), then we measure where the LATER $1M+ projects went.

with mapped as (

    select zip_code
    from {{ ref('zip_development') }}
    where is_in_dallas and has_enough_permits

),

baseline as (

    select
        p.zip_code,
        1000.0 * count_if(p.is_big_project) / count(*) >= 30 as is_high_in_baseline
    from {{ ref('int_permits_classified') }} p
    join mapped m on p.zip_code = m.zip_code
    where year(p.issued_date) = 2018
    group by p.zip_code

),

counts as (

    select
        count_if(is_high_in_baseline) as baseline_high_zip_count,
        count(*)                      as baseline_zip_count
    from baseline

)

select
    date_trunc('quarter', p.issued_date)::date                        as quarter_start,
    'Q' || quarter(p.issued_date) || ' ' || year(p.issued_date)       as quarter_label,
    count(*)                                                           as big_project_count,
    count_if(b.is_high_in_baseline)                                    as baseline_high_big_project_count,
    count_if(b.is_high_in_baseline) / count(*)                         as baseline_high_share,
    any_value(c.baseline_high_zip_count)                               as baseline_high_zip_count,
    any_value(c.baseline_zip_count)                                    as baseline_zip_count
from {{ ref('int_permits_classified') }} p
join baseline b on p.zip_code = b.zip_code
cross join counts c
where p.is_big_project
  and p.issued_date >= '2019-01-01'
group by 1, 2
