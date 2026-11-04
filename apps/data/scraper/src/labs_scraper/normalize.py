"""Raw page text to typed fields. Anything that cannot be parsed becomes None; confidence handles the rest."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from .parse import RawProduct

_CURRENCY = {"£": "GBP", "$": "USD", "€": "EUR"}
_RATING = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}


@dataclass
class Normalized:
    source_key: str
    url: str
    title: str | None
    price: Decimal | None
    currency: str | None
    rating: int | None
    in_stock: int | None
    in_stock_text_ok: bool  # availability wording was recognised


def parse_price(text: str | None) -> tuple[Decimal | None, str | None]:
    if not text:
        return None, None
    text = text.replace("Â", "")  # mojibake from a mis-decoded £
    m = re.search(r"([£$€])?\s*(\d+(?:[.,]\d{1,2})?)", text)
    if not m:
        return None, None
    try:
        return Decimal(m.group(2).replace(",", ".")), _CURRENCY.get(m.group(1) or "")
    except InvalidOperation:
        return None, None


def parse_rating(text: str | None) -> int | None:
    return _RATING.get((text or "").strip().lower())


def parse_stock(text: str | None) -> tuple[int | None, bool]:
    """Returns (count, recognised). 'In stock' with no number gives (None, True)."""
    t = (text or "").lower()
    if "out of stock" in t:
        return 0, True
    m = re.search(r"\((\d+) available\)", t)
    if m:
        return int(m.group(1)), True
    return None, "in stock" in t


def clean_title(title: str | None) -> str | None:
    return re.sub(r"\s+", " ", title).strip() or None if title else None


def fallback_key(title: str | None) -> str:
    base = re.sub(r"[^a-z0-9]+", " ", (title or "").lower()).strip()
    return "title:" + hashlib.sha1(base.encode()).hexdigest()[:16]


def normalize(raw: RawProduct) -> Normalized:
    title = clean_title(raw.title)
    price, currency = parse_price(raw.price_text)
    stock, ok = parse_stock(raw.availability_text)
    return Normalized(
        source_key=raw.upc or fallback_key(title), url=raw.url, title=title, price=price,
        currency=currency, rating=parse_rating(raw.rating_text), in_stock=stock, in_stock_text_ok=ok,
    )
