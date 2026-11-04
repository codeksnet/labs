from decimal import Decimal

import pytest

from labs_scraper.confidence import THRESHOLD, score
from labs_scraper.eval_target import canonical, parse_json
from labs_scraper.fetch import FailureKind, FetchError, classify_status
from labs_scraper.normalize import normalize, parse_price, parse_rating, parse_stock
from labs_scraper.parse import ParseError, parse_listing, parse_product
from labs_scraper.retry import POLICY, delay_for, fetch_with_retries

from .helpers import LISTING_1, FakeFetcher, err, product_html, read


def test_parse_listing_real_page():
    page = parse_listing(read("listing_1.html"), LISTING_1)
    assert len(page.items) == 20
    assert page.items[0].url == "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
    assert page.items[0].title == "A Light in the Attic" and page.items[0].rating_text == "Three"
    assert page.next_url == "https://books.toscrape.com/catalogue/page-2.html"
    assert parse_listing(read("listing_50.html"), LISTING_1).next_url is None


def test_parse_product_real_page():
    raw = parse_product(read("product_light_attic.html"), "u")
    assert (raw.title, raw.price_text, raw.rating_text, raw.upc) == ("A Light in the Attic", "£51.77", "Three", "a897fe39b1053632")
    n = normalize(raw)
    assert (n.price, n.currency, n.rating, n.in_stock) == (Decimal("51.77"), "GBP", 3, 22)


def test_block_page_is_a_parse_error():
    with pytest.raises(ParseError):
        parse_product("<html><body>Access denied</body></html>", "u")
    with pytest.raises(ParseError):
        parse_listing("<html><body>Access denied</body></html>", "u")


@pytest.mark.parametrize("text,expected", [
    ("£51.77", (Decimal("51.77"), "GBP")), ("Â£51.77", (Decimal("51.77"), "GBP")),
    ("€9,50", (Decimal("9.50"), "EUR")), ("12", (Decimal(12), None)), ("free", (None, None)), (None, (None, None)),
])
def test_parse_price(text, expected):
    assert parse_price(text) == expected


def test_rating_and_stock():
    assert parse_rating("Five") == 5 and parse_rating("Zero") is None
    assert parse_stock("In stock (22 available)") == (22, True)
    assert parse_stock("Out of stock") == (0, True)
    assert parse_stock("In stock") == (None, True)
    assert parse_stock("???") == (None, False)


def test_confidence_clean_record_is_high():
    n = normalize(parse_product(read("product_light_attic.html"), "u"))
    assert score(n) == (1.0, [])


def test_confidence_flags_bad_records():
    n = normalize(parse_product(product_html("u1", "T", "price tbd"), "u"))
    conf, reasons = score(n)
    assert "missing_price" in reasons and conf < THRESHOLD


def test_confidence_cross_checks_listing_vs_detail():
    listing = parse_listing(read("listing_1.html"), LISTING_1).items[0]  # £51.77
    n = normalize(parse_product(product_html("a897fe39b1053632", "A Light in the Attic", "£99.99"), listing.url))
    conf, reasons = score(n, listing)
    assert reasons == ["listing_price_mismatch"] and conf == 0.7 and conf < THRESHOLD


def test_confidence_implausible_and_fallback_key():
    n = normalize(parse_product(read("product_light_attic.html").replace("a897fe39b1053632", ""), "u"))
    assert n.source_key.startswith("title:")
    assert "missing_upc" in score(n)[1]
    n.price = Decimal(99999)
    assert "implausible_price" in score(n)[1]


def test_classify_status():
    assert classify_status("u", 200) is None
    assert classify_status("u", 404).kind is FailureKind.NOT_FOUND
    assert classify_status("u", 429, 7).retry_after == 7
    assert classify_status("u", 403).kind is FailureKind.BLOCKED
    assert classify_status("u", 502).kind is FailureKind.SERVER_ERROR


def test_retry_succeeds_after_transient_failures():
    sleeps = []
    f = FakeFetcher(fail={LISTING_1: [err(FailureKind.TIMEOUT), err(FailureKind.TIMEOUT)]})
    assert fetch_with_retries(f, LISTING_1, sleeps.append).status == 200
    assert sleeps == [2.0, 4.0] and len(f.calls) == 3  # exponential backoff


def test_retry_gives_up_per_policy_and_not_found_is_not_retried():
    f = FakeFetcher(fail={LISTING_1: [err(FailureKind.TIMEOUT)] * 10})
    with pytest.raises(FetchError):
        fetch_with_retries(f, LISTING_1, lambda s: None)
    assert len(f.calls) == POLICY[FailureKind.TIMEOUT][0]
    f = FakeFetcher(fail={LISTING_1: [err(FailureKind.NOT_FOUND)] * 10})
    with pytest.raises(FetchError):
        fetch_with_retries(f, LISTING_1, lambda s: None)
    assert len(f.calls) == 1


def test_blocked_rotates_session_and_rate_limit_honours_retry_after():
    sleeps = []
    f = FakeFetcher(fail={LISTING_1: [err(FailureKind.BLOCKED)]})
    fetch_with_retries(f, LISTING_1, sleeps.append)
    assert f.rotations == 1
    assert delay_for(err(FailureKind.RATE_LIMITED, retry_after=7), 1) == 7
    assert delay_for(err(FailureKind.RATE_LIMITED, retry_after=9999), 1) == 300


def test_eval_target_canonical_form():
    out = parse_json(read("product_light_attic.html"))
    assert out == '{"currency":"GBP","in_stock":22,"price":"51.77","rating":3,"title":"A Light in the Attic"}'
    assert canonical("T", Decimal(10), "GBP", 1, 0) == '{"currency":"GBP","in_stock":0,"price":"10.00","rating":1,"title":"T"}'
