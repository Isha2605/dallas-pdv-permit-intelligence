-- The dashboard header reads a single row; more or fewer means a broken join.
select count(*) as row_count
from {{ ref('kpi_summary') }}
having count(*) <> 1
