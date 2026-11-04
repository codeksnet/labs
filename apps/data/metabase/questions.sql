-- Saved questions for the Metabase dashboard. Paste each into a new SQL question.

-- 1. Nightly runs: did they finish, how much did they see, how many errors
select id, started_at::date as day, status, pages, products, jsonb_array_length(errors) as errors,
       finished_at - started_at as duration
from data.scrape_runs order by id desc limit 14;

-- 2. Confidence distribution
select width_bucket(confidence, 0, 1.0001, 10) as bucket, count(*) from data.entities group by 1 order by 1;

-- 3. Review queue size and what puts rows in it
select r as reason, count(*) from data.entities, jsonb_array_elements_text(confidence_reasons) r
where needs_review group by 1 order by 2 desc;

-- 4. Price changes in the last 7 days
select e.title, h.changed_at, h.changes -> 'price' ->> 'old' as old_price, h.changes -> 'price' ->> 'new' as new_price
from data.entity_history h join data.entities e on e.id = h.entity_id
where h.reason = 'scrape' and h.changes ? 'price' and h.changes -> 'price' -> 'old' <> 'null'::jsonb
  and h.changed_at > now() - interval '7 days' order by h.changed_at desc;

-- 5. Corrections made and regression cases produced
select changed_at::date as day, count(*) as corrections from data.entity_history where reason = 'correction' group by 1 order by 1;
