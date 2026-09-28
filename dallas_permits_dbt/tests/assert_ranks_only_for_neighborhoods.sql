-- Ranks must exist for every neighborhood (mapped, 10k+ residents) and for
-- nothing else, or a rank could silently be taken over the wrong set of ZIPs.
select zip_code
from {{ ref('zip_development') }}
where (is_in_dallas and has_enough_permits and is_neighborhood)
      <> (income_rank is not null and housing_rank is not null)
