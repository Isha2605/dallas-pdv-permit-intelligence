-- One row per month: the headline numbers over the 12 months ending that month,
-- plus what is new this month. The live header reads the is_latest row.

with windows as (

    select * from {{ ref('int_windows') }}
    where window_type = 'rolling_12m'

),

permits as (

    select
        w.window_id,
        count(*)                                  as total_permits,
        sum(p.value)                              as total_value,
        count_if(p.is_big_project)                as big_project_count,
        count_if(p.is_big_project) / count(*)     as big_project_share_of_permits,
        sum(iff(p.is_big_project, p.value, 0)) / sum(p.value)
                                                  as big_project_share_of_value,
        -- What arrived in the window's final month.
        count_if(p.issued_date >= date_trunc(month, w.window_end))
                                                  as permits_this_month,
        count_if(p.is_big_project and p.issued_date >= date_trunc(month, w.window_end))
                                                  as new_big_projects_this_month
    from {{ ref('int_permits_classified') }} p
    join windows w
      on p.issued_date between w.window_start and w.window_end
    group by w.window_id

),

zips as (

    select
        window_id,
        count_if(is_in_dallas and has_enough_permits)          as mapped_zip_count,
        count_if(is_in_dallas and has_enough_permits
                 and development_tier = 'High investment')     as high_investment_zip_count,
        count_if(is_in_dallas and has_enough_permits
                 and development_tier = 'Moderate investment') as moderate_investment_zip_count,
        count_if(is_in_dallas and has_enough_permits
                 and development_tier = 'Mostly maintenance')  as mostly_maintenance_zip_count,
        sum(iff(is_in_dallas and has_enough_permits and development_tier = 'High investment',
                total_value, 0))
          / nullif(sum(iff(is_in_dallas and has_enough_permits, total_value, 0)), 0)
                                                               as high_investment_share_of_value,
        count_if(is_in_dallas and has_enough_permits
                 and previous_tier is not null
                 and previous_tier <> development_tier)        as zips_changed_tier,
        count_if(income_rank is not null)                      as neighborhood_count,
        corr(income_rank, housing_rank)                        as income_housing_rank_correlation,
        median(iff(income_rank is not null, housing_value_per_resident, null))
                                                               as median_housing_value_per_resident
    from {{ ref('int_zip_windows') }}
    where window_type = 'rolling_12m'
    group by window_id

)

select
    w.window_end   as as_of_date,
    w.window_start,
    w.is_latest,
    p.* exclude (window_id),
    z.* exclude (window_id)
from windows w
join permits p on p.window_id = w.window_id
join zips    z on z.window_id = w.window_id
