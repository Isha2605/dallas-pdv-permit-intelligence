-- Ranks must exist for every neighborhood (mapped, 10k+ residents) and for
-- nothing else, or a rank could silently be taken over the wrong set of ZIPs.
-- Checked across every window, not just the study period.
select window_id, zip_code
from {{ ref('int_zip_windows') }}
where (is_in_dallas and has_enough_permits and is_neighborhood)
      <> (income_rank is not null and housing_rank is not null)
