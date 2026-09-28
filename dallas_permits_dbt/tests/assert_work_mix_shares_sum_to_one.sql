-- Within each tier, work-stage shares must add up to 100%.
select development_tier, sum(share_of_tier_permits) as total_share
from {{ ref('tier_work_mix') }}
group by 1
having abs(sum(share_of_tier_permits) - 1) > 0.0001
