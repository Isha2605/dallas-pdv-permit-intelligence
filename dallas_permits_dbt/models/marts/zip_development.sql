-- One row per ZIP: permit activity joined to Census context.
-- This is what the dashboard reads.

with permit_summary as (

    select
        zip_code,
        count(*)                                   as permit_count,
        sum(value)                                 as total_value,
        count_if(is_big_project)                   as big_project_count,
        sum(iff(is_residential, value, 0))         as residential_value,
        sum(iff(is_residential and work_stage = 'New construction', value, 0))
                                                   as residential_new_construction_value,
        count_if(work_stage = 'New construction')  as new_construction_count,
        count_if(work_stage = 'Alterations')       as alteration_count,
        count_if(work_stage = 'Other')             as other_stage_count
    from {{ ref('int_permits_classified') }}
    where zip_code is not null
    group by zip_code

),

joined as (

    select
        p.zip_code,
        p.permit_count,
        p.total_value,
        p.big_project_count,
        p.residential_value,
        p.residential_new_construction_value,
        p.new_construction_count,
        p.alteration_count,
        p.other_stage_count,
        c.population,
        c.median_household_income,
        c.pct_in_dallas,
        1000.0 * p.big_project_count / p.permit_count as big_projects_per_1000
    from permit_summary p
    left join {{ ref('stg_census_zips') }} c on p.zip_code = c.zip_code

),

flagged as (

    select
        zip_code,
        permit_count,
        total_value,
        big_project_count,
        round(big_projects_per_1000, 1) as big_projects_per_1000,

        case
            when big_projects_per_1000 >= 30 then 'Built up'
            when big_projects_per_1000 >= 10 then 'Mixed'
            else 'Patched up'
        end as development_tier,

        residential_value,
        residential_new_construction_value,

        -- Share of this ZIP's housing dollars going into new homes rather than
        -- repairs -- the "why" behind a neighborhood beating its income.
        case when residential_value > 0
            then residential_new_construction_value / residential_value
        end as new_construction_share_of_housing,

        new_construction_count,
        alteration_count,
        other_stage_count,

        population,
        median_household_income,
        pct_in_dallas,

        -- Housing dollars per resident -- the equity measure. Residential value only:
        -- hospitals and warehouses are construction, but not investment in where people live.
        case when population > 0 then residential_value / population end
            as housing_value_per_resident,

        -- Each cutoff sits at a natural gap in the data, not a chosen round number.
        -- See src/check_numbers.py for the distributions these come from.
        coalesce(pct_in_dallas >= 90, false) as is_in_dallas,      -- no ZIP falls between 72% and 94%
        permit_count >= 100                  as has_enough_permits,
        coalesce(population >= 10000, false) as is_neighborhood    -- no Dallas ZIP between 8,673 and 14,308

    from joined

),

ranked as (

    -- Ranks are only meaningful within the set the dashboard talks about -- the
    -- neighborhoods. Partitioning on that flag ranks those against each other and
    -- leaves every other ZIP null, so a rank can never quietly be taken over the
    -- wrong set of ZIPs somewhere downstream.
    select
        flagged.*,
        case when is_in_dallas and has_enough_permits and is_neighborhood then
            rank() over (
                partition by (is_in_dallas and has_enough_permits and is_neighborhood)
                order by median_household_income desc
            )
        end as income_rank,
        case when is_in_dallas and has_enough_permits and is_neighborhood then
            rank() over (
                partition by (is_in_dallas and has_enough_permits and is_neighborhood)
                order by housing_value_per_resident desc
            )
        end as housing_rank
    from flagged

)

select
    ranked.*,
    -- Positive: more housing investment than this neighborhood's income would predict.
    income_rank - housing_rank as beats_income_by
from ranked
