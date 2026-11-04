"""One scrape run: crawl listing pages, fetch each product, normalise, score, upsert. Resumable."""
from __future__ import annotations

import time
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field

from .confidence import THRESHOLD, score
from .fetch import Fetcher, FetchError
from .normalize import normalize
from .parse import ListingItem, ParseError, parse_listing, parse_product
from .retry import fetch_with_retries
from .store import Store

SOURCE = "books.toscrape.com"  # a public sandbox built for scraping practice
START_URL = "https://books.toscrape.com/catalogue/page-1.html"


@dataclass
class Summary:
    run_id: int
    resumed: bool
    status: str
    pages: int = 0
    counts: Counter = field(default_factory=Counter)
    errors: int = 0


def _process_product(store: Store, fetcher: Fetcher, run_id: int, item: ListingItem,
                     sleep: Callable[[float], None], summary: Summary) -> None:
    try:
        res = fetch_with_retries(fetcher, item.url, sleep)
    except FetchError as e:
        store.record_error(run_id, {"url": item.url, "kind": e.kind.value, "status": e.status})
        summary.errors += 1
        return
    snapshot_id = store.save_snapshot(run_id, item.url, res.status, res.html)  # keep the page even if parsing fails
    try:
        n = normalize(parse_product(res.html, item.url))
    except ParseError as e:
        store.record_error(run_id, {"url": item.url, "kind": "parse", "message": str(e)})
        summary.errors += 1
        return
    conf, reasons = score(n, item)
    summary.counts[store.upsert_entity(SOURCE, n, conf, reasons, conf < THRESHOLD, snapshot_id)] += 1


def run(fetcher: Fetcher, store: Store, max_pages: int | None = None,
        sleep: Callable[[float], None] = time.sleep) -> Summary:
    """Resumes from the last checkpoint if the previous run did not finish. `max_pages` bounds this invocation;
    a bounded run stays `running` so the next invocation continues where it stopped."""
    r = store.open_run()
    summary = Summary(r.id, r.resumed, "running")
    url: str | None = r.cursor or START_URL
    seen: set[str] = set()
    while url and (max_pages is None or summary.pages < max_pages):
        try:
            page = parse_listing(fetch_with_retries(fetcher, url, sleep).html, url)
        except (FetchError, ParseError) as e:
            store.record_error(r.id, {"url": url, "kind": getattr(getattr(e, "kind", None), "value", "parse")})
            store.finish(r.id, "failed")  # cursor is untouched: the next run resumes at this page
            summary.status, summary.errors = "failed", summary.errors + 1
            return summary
        items = [i for i in page.items if i.url not in seen]  # dedup within the invocation
        seen.update(i.url for i in items)
        for item in items:
            _process_product(store, fetcher, r.id, item, sleep, summary)
        store.checkpoint(r.id, page.next_url, len(items))
        summary.pages += 1
        url = page.next_url
    if url is None:
        store.finish(r.id, "completed")
        summary.status = "completed"
    return summary
