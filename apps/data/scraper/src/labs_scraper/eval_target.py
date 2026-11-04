"""Eval target for codeks-evals: page HTML in, canonical JSON of the normalised fields out.

Regression cases created by the correction tool use the same canonical form, so a case passes
only once the parser produces the corrected values:
    codeks-evals run evalsets/data-regressions.jsonl --target labs_scraper.eval_target:parse_json
"""
from __future__ import annotations

import json

from .normalize import normalize
from .parse import parse_product


def canonical(title, price, currency, rating, in_stock) -> str:
    """Keys sorted, compact separators, price as a 2-decimal string. The Next.js tool mirrors this exactly."""
    return json.dumps({
        "currency": currency, "in_stock": in_stock,
        "price": None if price is None else f"{float(price):.2f}", "rating": rating, "title": title,
    }, separators=(",", ":"), sort_keys=True)


def parse_json(html: str) -> str:
    n = normalize(parse_product(html, "https://example.test/"))
    return canonical(n.title, n.price, n.currency, n.rating, n.in_stock)
