"""Runs against a Postgres with supabase/migrations applied. Set DATABASE_URL (see scripts/test.sh)."""
import os

import psycopg
import pytest

from labs_scraper.fetch import FailureKind
from labs_scraper.run import SOURCE, run
from labs_scraper.store import Store

from .helpers import LISTING_1, LISTING_2, FakeFetcher, err, product_html

URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="set DATABASE_URL (see scripts/test.sh)")

NOSLEEP = lambda s: None


@pytest.fixture
def conn():
    with psycopg.connect(URL, autocommit=True) as c:
        c.execute("truncate data.regression_cases, data.entity_history, data.entities, data.raw_snapshots, "
                  "data.scrape_runs restart identity cascade")
        yield c


def count(conn, table, where="true"):
    return conn.execute(f"select count(*) from data.{table} where {where}").fetchone()[0]


def test_full_run_dedups_and_writes_history(conn):
    s = run(FakeFetcher(), Store(conn), sleep=NOSLEEP)
    assert s.status == "completed" and s.pages == 2 and s.errors == 0
    assert count(conn, "entities") == 40 and s.counts["created"] == 40
    assert count(conn, "entity_history") == 40
    assert conn.execute("select status, cursor from data.scrape_runs").fetchone() == ("completed", None)
    # second night, nothing changed: nothing created, no new history
    s2 = run(FakeFetcher(), Store(conn), sleep=NOSLEEP)
    assert s2.counts["unchanged"] == 40 and count(conn, "entities") == 40 and count(conn, "entity_history") == 40
    assert count(conn, "raw_snapshots") == 40  # identical pages stored once


def test_price_change_is_recorded_in_history(conn):
    run(FakeFetcher(), Store(conn), sleep=NOSLEEP)
    url = "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
    f = FakeFetcher(product_overrides={url: product_html("upc-a-light-in-the-attic_1000", "A Light In The Attic", "£60.00")})
    s = run(f, Store(conn), sleep=NOSLEEP)
    assert s.counts["updated"] == 1
    changes = conn.execute("select changes from data.entity_history where changes ? 'price' and reason='scrape' "
                           "order by id desc limit 1").fetchone()[0]
    assert changes["price"] == {"old": "51.77", "new": "60.00"}


def test_low_confidence_rows_are_flagged(conn):
    url = "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
    f = FakeFetcher(product_overrides={url: product_html("upc-bad", "Broken Book", "price tbd")})
    run(f, Store(conn), max_pages=1, sleep=NOSLEEP)
    flagged = conn.execute("select source_key, confidence, confidence_reasons from data.entities where needs_review").fetchall()
    assert [r[0] for r in flagged] == ["upc-bad"] and "missing_price" in flagged[0][2]


def test_resume_after_listing_failure_continues_at_checkpoint(conn):
    f = FakeFetcher(fail={LISTING_2: [err(FailureKind.BLOCKED)] * 5})
    s = run(f, Store(conn), sleep=NOSLEEP)
    assert s.status == "failed" and s.pages == 1 and count(conn, "entities") == 20
    assert conn.execute("select status, cursor from data.scrape_runs").fetchone() == ("failed", LISTING_2)
    f2 = FakeFetcher()
    s2 = run(f2, Store(conn), sleep=NOSLEEP)
    assert s2.resumed and s2.status == "completed" and count(conn, "scrape_runs") == 1
    assert LISTING_1 not in f2.calls and count(conn, "entities") == 40  # did not re-crawl page 1


def test_bounded_run_stays_resumable(conn):
    s = run(FakeFetcher(), Store(conn), max_pages=1, sleep=NOSLEEP)
    assert s.status == "running" and s.pages == 1
    s2 = run(FakeFetcher(), Store(conn), sleep=NOSLEEP)
    assert s2.resumed and s2.status == "completed" and count(conn, "entities") == 40


def test_product_failures_do_not_abort_the_run(conn):
    url = "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
    f = FakeFetcher(fail={url: [err(FailureKind.NOT_FOUND)]}, product_overrides={})
    s = run(f, Store(conn), sleep=NOSLEEP)
    assert s.status == "completed" and s.errors == 1 and count(conn, "entities") == 39
    errors = conn.execute("select errors from data.scrape_runs").fetchone()[0]
    assert errors[0]["kind"] == "not_found"


def test_parse_failure_is_recorded_and_snapshot_kept(conn):
    url = "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
    f = FakeFetcher(product_overrides={url: "<html><body>Access denied</body></html>"})
    s = run(f, Store(conn), max_pages=1, sleep=NOSLEEP)
    assert s.errors == 1 and count(conn, "raw_snapshots", f"url = '{url}'") == 1


def test_corrected_entity_is_not_overwritten_by_scrape(conn):
    run(FakeFetcher(), Store(conn), sleep=NOSLEEP)
    conn.execute("update data.entities set price = 5.00, corrected = true where source = %s and source_key = 'upc-a-light-in-the-attic_1000'", (SOURCE,))
    run(FakeFetcher(), Store(conn), sleep=NOSLEEP)  # the page still says 51.77
    assert float(conn.execute("select price from data.entities where source_key = 'upc-a-light-in-the-attic_1000'").fetchone()[0]) == 5.0
    ignored = conn.execute("select changes from data.entity_history where changes -> 'price' ? 'ignored'").fetchall()
    assert len(ignored) == 1


def test_every_table_has_rls(conn):
    rows = conn.execute("select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace "
                        "where n.nspname = 'data' and c.relkind = 'r' and not c.relrowsecurity").fetchall()
    assert rows == []
