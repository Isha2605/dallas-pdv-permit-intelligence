-- The live product reads "the current state" from is_latest; there must be exactly one.
select count(*) as latest_rows
from {{ ref('kpi_rolling_12m') }}
where is_latest
having count(*) <> 1
