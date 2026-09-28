-- One row holding every headline number on the dashboard.
-- Mirrors the "Header", "KPI" and "Centerpiece" sections of src/check_numbers.py.

with permits as (

    select * from {{ ref('int_permits_classified') }}

),

zips as (

    select * from {{ ref('zip_development') }}

),

-- ZIPs shown on the map: mostly inside Dallas, with enough permits to judge.
mapped as (

    select * from zips where is_in_dallas and has_enough_permits

),

-- Mapped ZIPs that are real neighborhoods -- the only ones that carry ranks.
neighborhoods as (

    select * from zips where income_rank is not null

),

overall as (

    select
        count(*)                                  as total_permits,
        sum(value)                                as total_value,
        min(issued_date)                          as first_issued_date,
        max(issued_date)                          as last_issued_date,
        count_if(is_big_project)                  as big_project_count,
        count_if(is_big_project) / count(*)       as big_project_share_of_permits,
        sum(iff(is_big_project, value, 0)) / sum(value)
                                                  as big_project_share_of_value
    from permits

),

tiers as (

    select
        count(*)                                  as mapped_zip_count,
        count_if(development_tier = 'High investment')   as high_investment_zip_count,
        count_if(development_tier = 'Moderate investment')      as moderate_investment_zip_count,
        count_if(development_tier = 'Mostly maintenance') as mostly_maintenance_zip_count,
        sum(iff(development_tier = 'High investment', total_value, 0)) / sum(total_value)
                                                  as high_investment_share_of_value
    from mapped

),

centerpiece as (

    select
        count(*)                                  as neighborhood_count,
        sum(residential_value)                    as neighborhood_housing_value,
        -- Correlation of ranks = Spearman's rank correlation (no ties in either measure).
        corr(income_rank, housing_rank)           as income_housing_rank_correlation,
        median(housing_value_per_resident)        as median_housing_value_per_resident,
        sum(residential_new_construction_value) / sum(residential_value)
                                                  as new_construction_share_all
    from neighborhoods

),

-- Top and bottom five neighborhoods by how far they beat their income rank.
ordered as (

    select
        *,
        row_number() over (order by beats_income_by desc, zip_code) as top_position,
        row_number() over (order by beats_income_by asc,  zip_code) as bottom_position
    from neighborhoods

),

extremes as (

    select
        sum(iff(top_position <= 5, residential_new_construction_value, 0))
          / sum(iff(top_position <= 5, residential_value, 0))       as new_construction_share_top5,
        sum(iff(bottom_position <= 5, residential_new_construction_value, 0))
          / sum(iff(bottom_position <= 5, residential_value, 0))    as new_construction_share_bottom5
    from ordered

),

-- The story ZIP: the lowest-income neighborhood, and how many wealthier
-- neighborhoods it out-invests in housing per resident.
poorest as (

    select zip_code, median_household_income, housing_value_per_resident
    from neighborhoods
    order by median_household_income asc
    limit 1

),

outranked as (

    select n.*
    from neighborhoods n
    cross join poorest p
    where n.median_household_income   > p.median_household_income
      and n.housing_value_per_resident < p.housing_value_per_resident

),

story as (

    select
        p.zip_code                                as story_zip,
        (select count(*) from outranked)          as story_zip_wealthier_outranked,
        (select zip_code from outranked
         order by median_household_income desc limit 1)
                                                  as story_compare_zip,
        (select count(*) from permits
         where permits.zip_code = p.zip_code
           and is_residential
           and upper(work_description) = 'CONSTRUCT NEW SFD')
                                                  as story_zip_new_sfd_permits
    from poorest p

)

select *
from overall
cross join tiers
cross join centerpiece
cross join extremes
cross join story
