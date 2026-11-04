"""HTML to raw fields. No normalisation here: values stay as the page printed them."""
from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urljoin

from bs4 import BeautifulSoup


class ParseError(Exception):
    """The page is not the page we expected (block page, layout change)."""


@dataclass
class ListingItem:
    url: str
    title: str | None
    price_text: str | None
    rating_text: str | None


@dataclass
class ListingPage:
    items: list[ListingItem]
    next_url: str | None


@dataclass
class RawProduct:
    url: str
    title: str | None
    price_text: str | None
    rating_text: str | None
    availability_text: str | None
    upc: str | None


def _text(node) -> str | None:
    return node.get_text(" ", strip=True) if node else None


def _rating_class(node) -> str | None:
    if not node:
        return None
    return next((c for c in node.get("class", []) if c != "star-rating"), None)


def parse_listing(html: str, page_url: str) -> ListingPage:
    soup = BeautifulSoup(html, "html.parser")
    pods = soup.select("article.product_pod")
    if not pods and not soup.select("ol.row"):
        raise ParseError("no product list on listing page")
    items = []
    for pod in pods:
        a = pod.select_one("h3 a")
        if not a or not a.get("href"):
            continue
        items.append(ListingItem(
            url=urljoin(page_url, a["href"]),
            title=a.get("title"),
            price_text=_text(pod.select_one("p.price_color")),
            rating_text=_rating_class(pod.select_one("p.star-rating")),
        ))
    nxt = soup.select_one("li.next a")
    return ListingPage(items, urljoin(page_url, nxt["href"]) if nxt and nxt.get("href") else None)


def parse_product(html: str, url: str) -> RawProduct:
    soup = BeautifulSoup(html, "html.parser")
    main = soup.select_one("div.product_main")
    if main is None:
        raise ParseError("no product_main block: not a product page")
    upc = None
    for row in soup.select("table.table-striped tr"):
        th, td = row.find("th"), row.find("td")
        if th and td and th.get_text(strip=True) == "UPC":
            upc = td.get_text(strip=True) or None
    return RawProduct(
        url=url,
        title=_text(main.select_one("h1")),
        price_text=_text(main.select_one("p.price_color")),
        rating_text=_rating_class(main.select_one("p.star-rating")),
        availability_text=_text(main.select_one("p.availability")),
        upc=upc,
    )
