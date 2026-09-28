-- Side-by-side pairs: a high-investment ZIP and a mostly-maintenance ZIP with nearly the same
-- number of permits (within 10%), ranked by how many times more value the
-- high-investment one drew. Same activity, very different money.

with mapped as (

    select *
    from {{ ref('zip_development') }}
    where is_in_dallas and has_enough_permits

),

pairs as (

    select
        b.zip_code           as high_investment_zip,
        p.zip_code           as mostly_maintenance_zip,
        b.permit_count       as high_investment_permits,
        p.permit_count       as mostly_maintenance_permits,
        b.total_value        as high_investment_value,
        p.total_value        as mostly_maintenance_value,
        b.big_project_count  as high_investment_big_projects,
        p.big_project_count  as mostly_maintenance_big_projects,
        b.total_value / p.total_value as value_ratio
    from mapped b
    join mapped p
      on b.development_tier = 'High investment'
     and p.development_tier = 'Mostly maintenance'
     and abs(b.permit_count - p.permit_count)
         / greatest(b.permit_count, p.permit_count) <= 0.10

)

select
    row_number() over (order by value_ratio desc) as pair_rank,
    pairs.*
from pairs
