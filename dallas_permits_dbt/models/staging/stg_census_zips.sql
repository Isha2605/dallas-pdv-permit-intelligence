select
    zip_code,
    try_to_number(population)                as population,
    try_to_number(median_household_income)   as median_household_income,
    try_to_decimal(pct_in_dallas, 5, 2)      as pct_in_dallas
from {{ source('raw', 'census_zips') }}
