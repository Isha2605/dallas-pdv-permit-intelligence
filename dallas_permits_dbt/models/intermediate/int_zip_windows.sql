-- One row per ZIP per time window: permit activity, development tier, Census context,
-- housing investment per resident, and income vs housing ranks.
-- The single definition of every ZIP metric -- zip_development (study period) and
-- zip_rolling_12m (live) both read from here, so the rules can never drift apart.

{{ config(materialized='table') }}

with windows as (

    select * from {{ ref('int_windows') }}

),

permit_summary as (

    select
        w.window_id,
        p.zip_code,
        count(*)                                   as permit_count,
        sum(p.value)                               as total_value,
        count_if(p.is_big_project)                 as big_project_count,
        sum(iff(p.is_residential, p.value, 0))     as residential_value,
        sum(iff(p.is_residential and p.work_stage = 'New construction', p.value, 0))
                                                   as residential_new_construction_value,
        count_if(p.work_stage = 'New construction') as new_construction_count,
        count_if(p.work_stage = 'Alterations')     as alteration_count,
        count_if(p.work_stage = 'Other')           as other_stage_count
    from {{ ref('int_permits_classified') }} p
    join windows w
      on p.issued_date between w.window_start and w.window_end
    where p.zip_code is not null
    group by w.window_id, p.zip_code

),

joined as (

    select
        w.window_id,
        w.window_type,
        w.window_start,
        w.window_end,
        w.is_latest,
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
    join windows w on p.window_id = w.window_id
    left join {{ ref('stg_census_zips') }} c on p.zip_code = c.zip_code

),

flagged as (

    select
        window_id,
        window_type,
        window_start,
        window_end,
        is_latest,
        zip_code,
        permit_count,
        total_value,
        big_project_count,
        round(big_projects_per_1000, 1) as big_projects_per_1000,

        -- Share of $1M+ projects. Cutoffs fixed across windows so a tier change
        -- means something changed on the ground, not that the goalposts moved.
        case
            when big_projects_per_1000 >= 30 then 'High investment'
            when big_projects_per_1000 >= 10 then 'Moderate investment'
            else 'Mostly maintenance'
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
    -- neighborhoods in the same window. Every other ZIP gets null, so a rank can
    -- never quietly be taken over the wrong set of ZIPs somewhere downstream.
    select
        flagged.*,
        case when is_in_dallas and has_enough_permits and is_neighborhood then
            rank() over (
                partition by window_id, (is_in_dallas and has_enough_permits and is_neighborhood)
                order by median_household_income desc
            )
        end as income_rank,
        case when is_in_dallas and has_enough_permits and is_neighborhood then
            rank() over (
                partition by window_id, (is_in_dallas and has_enough_permits and is_neighborhood)
                order by housing_value_per_resident desc
            )
        end as housing_rank
    from flagged

)

select
    ranked.*,
    -- Positive: more housing investment than this neighborhood's income would predict.
    income_rank - housing_rank as beats_income_by,
    -- Tier in the previous window of the same type (null for the first window).
    lag(development_tier) over (
        partition by window_type, zip_code order by window_end
    ) as previous_tier
from ranked
