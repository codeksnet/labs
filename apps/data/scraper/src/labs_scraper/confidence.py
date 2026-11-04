"""Confidence score in [0, 1] with machine-readable reasons. Rows below THRESHOLD go to the review queue."""
from __future__ import annotations

from decimal import Decimal

from .normalize import Normalized, clean_title, parse_price, parse_rating
from .parse import ListingItem

THRESHOLD = 0.8

# reason code -> penalty
PENALTIES = {
    "missing_title": 0.5,
    "missing_price": 0.4,
    "implausible_price": 0.3,
    "missing_rating": 0.15,
    "unrecognised_stock": 0.1,
    "missing_upc": 0.2,
    "listing_price_mismatch": 0.3,
    "listing_title_mismatch": 0.2,
    "listing_rating_mismatch": 0.15,
}


def score(n: Normalized, listing: ListingItem | None = None) -> tuple[float, list[str]]:
    reasons: list[str] = []
    if not n.title:
        reasons.append("missing_title")
    if n.price is None:
        reasons.append("missing_price")
    elif not (Decimal(0) < n.price < Decimal(1000)):
        reasons.append("implausible_price")
    if n.rating is None:
        reasons.append("missing_rating")
    if not n.in_stock_text_ok:
        reasons.append("unrecognised_stock")
    if n.source_key.startswith("title:"):
        reasons.append("missing_upc")
    if listing is not None:  # two independent views of the same item should agree
        lp, _ = parse_price(listing.price_text)
        if lp is not None and n.price is not None and lp != n.price:
            reasons.append("listing_price_mismatch")
        lt = clean_title(listing.title)
        if lt and n.title and lt != n.title:
            reasons.append("listing_title_mismatch")
        lr = parse_rating(listing.rating_text)
        if lr is not None and n.rating is not None and lr != n.rating:
            reasons.append("listing_rating_mismatch")
    return round(max(0.0, 1.0 - sum(PENALTIES[r] for r in reasons)), 2), reasons
