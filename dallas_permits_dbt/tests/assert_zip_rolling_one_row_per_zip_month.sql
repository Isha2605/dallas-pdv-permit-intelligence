-- Each ZIP appears at most once per as-of month.
select zip_code, as_of_date
from {{ ref('zip_rolling_12m') }}
group by 1, 2
having count(*) > 1
