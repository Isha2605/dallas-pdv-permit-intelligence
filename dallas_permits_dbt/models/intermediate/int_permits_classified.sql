-- Every permit, tagged with the two classifications the marts depend on.
-- Defined once here so the rules can never drift between models.

select
    permit_number,
    issued_date,
    zip_code,
    value,
    area,
    land_use,
    permit_type,
    work_description,
    street_address,

    land_use ilike any (
        '%SINGLE FAMILY%', '%MULTI-FAMILY%', '%DUPLEX%',
        '%CONDO%', '%TOWNHOUSE%', '%APARTMENT%'
    ) as is_residential,

    case
        when permit_type ilike '%new construction%' then 'New construction'
        when permit_type ilike '%alteration%'       then 'Alterations'
        else 'Other'
    end as work_stage,

    value >= 1000000 as is_big_project

from {{ ref('stg_permits') }}
