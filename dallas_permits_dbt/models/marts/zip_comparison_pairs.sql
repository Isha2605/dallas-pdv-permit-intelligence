-- Side-by-side pairs: a built-up ZIP and a patched-up ZIP with nearly the same
-- number of permits (within 10%), ranked by how many times more value the
-- built-up one drew. Same activity, very different money.

with mapped as (

    select *
    from {{ ref('zip_development') }}
    where is_in_dallas and has_enough_permits

),

pairs as (

    select
        b.zip_code           as built_up_zip,
        p.zip_code           as patched_up_zip,
        b.permit_count       as built_up_permits,
        p.permit_count       as patched_up_permits,
        b.total_value        as built_up_value,
        p.total_value        as patched_up_value,
        b.big_project_count  as built_up_big_projects,
        p.big_project_count  as patched_up_big_projects,
        b.total_value / p.total_value as value_ratio
    from mapped b
    join mapped p
      on b.development_tier = 'Built up'
     and p.development_tier = 'Patched up'
     and abs(b.permit_count - p.permit_count)
         / greatest(b.permit_count, p.permit_count) <= 0.10

)

select
    row_number() over (order by value_ratio desc) as pair_rank,
    pairs.*
from pairs
