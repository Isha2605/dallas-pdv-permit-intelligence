-- $1M+ projects in mapped ZIPs, by quarter: what share went to built-up ZIPs.
-- Shows the concentration is steady over time, not a one-off spike.

with mapped as (

    select zip_code, development_tier
    from {{ ref('zip_development') }}
    where is_in_dallas and has_enough_permits

)

select
    date_trunc('quarter', p.issued_date)::date           as quarter_start,
    'Q' || quarter(p.issued_date) || ' ' || year(p.issued_date)
                                                          as quarter_label,
    count(*)                                              as big_project_count,
    count_if(m.development_tier = 'Built up')             as built_up_big_project_count,
    count_if(m.development_tier = 'Built up') / count(*)  as built_up_share
from {{ ref('int_permits_classified') }} p
join mapped m on p.zip_code = m.zip_code
where p.is_big_project
group by 1, 2
