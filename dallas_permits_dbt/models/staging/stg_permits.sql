-- One row per building permit, cleaned and typed.
-- RAW.PERMITS is loaded as all-VARCHAR from the Socrata CSV; this model is the
-- only place raw text gets cast, so every downstream model sees proper types.

with source as (

    select * from {{ source('raw', 'permits') }}

),

cleaned as (

    select
        -- Kept as text: permit numbers have leading zeros ('0012011005').
        trim(permit_number)                                   as permit_number,

        -- Raw values contain double spaces ('... Single Family  Alteration').
        trim(regexp_replace(permit_type, '\\s+', ' '))        as permit_type,

        -- Two-letter trade code, e.g. 'Plumbing (PL) ...' -> 'PL'.
        -- Signs, supergraphics and demolitions have no code (null).
        regexp_substr(permit_type, '\\(([A-Z]{2,3})\\)', 1, 1, 'e', 1) as permit_code,

        -- Source dates are MM/DD/YY; data spans 2018-01 to 2020-08.
        to_date(issued_date, 'MM/DD/YY')                      as issued_date,

        nullif(trim(contractor), 'NULL')                      as contractor_raw,
        try_to_decimal(replace(value, ',', ''), 18, 2)        as value,
        try_to_decimal(replace(area, ',', ''), 18, 2)         as area,
        nullif(trim(work_description), 'NULL')                as work_description,
        nullif(trim(land_use), 'NULL')                        as land_use,
        nullif(trim(street_address), 'NULL')                  as street_address,

        -- Keep only valid Dallas-area 5-digit ZIPs.
        case
            when zip_code rlike '^75[0-9]{3}$' then zip_code
            else null
        end                                                   as zip_code

    from source

)

-- permit_type bundles three facts: '<Trade> (<CODE>) <Occupancy>  <Work type>'.
-- Split them out so the marts can group by each one.
select
    permit_number,
    permit_type,
    permit_code,

    case
        when permit_code is not null
            then trim(split_part(permit_type, ' (' || permit_code || ')', 1))
        when permit_type ilike 'Demolition%'           then 'Demolition'
        when permit_type ilike 'Electrical Sign%'      then 'Electrical Sign'
        when permit_type ilike 'Special Purpose Sign%' then 'Special Purpose Sign'
        when permit_type ilike 'Supergraphics%'        then 'Supergraphics'
        when permit_type ilike 'Sign%'                 then 'Sign'
    end                                                       as permit_trade,

    -- Null for signs/supergraphics, which have no occupancy.
    case
        when permit_type ilike '%Single Family%'
          or permit_type ilike '%SFD/Duplex%'          then 'Single Family'
        when permit_type ilike '%Multi Family%'        then 'Multi Family'
        when permit_type ilike '%Commercial%'          then 'Commercial'
    end                                                       as occupancy_type,

    case
        when permit_type ilike 'Demolition%'           then 'Demolition'
        else regexp_substr(
            permit_type,
            '(New Construction|Reconstruction|Renovation|Alteration|Addition|Finish Out)$'
        )
    end                                                       as work_type,

    issued_date,
    contractor_raw,
    value,
    area,
    work_description,
    land_use,
    street_address,
    zip_code

from cleaned
