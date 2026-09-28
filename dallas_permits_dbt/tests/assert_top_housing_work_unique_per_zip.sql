-- Each ZIP has at most one row per rank position.
select zip_code, rank_in_zip
from {{ ref('zip_top_housing_work') }}
group by 1, 2
having count(*) > 1
