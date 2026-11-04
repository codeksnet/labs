from pathlib import Path

from labs_scraper.fetch import FailureKind, FetchError, FetchResult

FIX = Path(__file__).parent / "fixtures"
LISTING_1 = "https://books.toscrape.com/catalogue/page-1.html"
LISTING_2 = "https://books.toscrape.com/catalogue/page-2.html"


def read(name: str) -> str:
    return (FIX / name).read_text(encoding="utf-8")


def product_html(upc: str, title: str, price: str = "£51.77", rating: str = "Three") -> str:
    """Variant of the real product fixture with a different identity."""
    h = read("product_light_attic.html")
    h = h.replace("a897fe39b1053632", upc).replace("A Light in the Attic", title).replace("£51.77", price)
    return h.replace("star-rating Three", f"star-rating {rating}")


def _listing_index() -> dict:
    from labs_scraper.parse import parse_listing

    out = {}
    for name, url in (("listing_1.html", LISTING_1), ("listing_50.html", LISTING_2)):
        for item in parse_listing(read(name), url).items:
            out[item.url] = item
    return out


class FakeFetcher:
    """Serves fixtures. page-1 is the real listing; page-2 is the real last listing (no next link).
    Product pages are generated per URL. `fail` maps url -> list of errors to raise before succeeding."""

    def __init__(self, fail=None, product_overrides=None):
        self.fail = {k: list(v) for k, v in (fail or {}).items()}
        self.overrides = product_overrides or {}
        self.calls: list[str] = []
        self.rotations = 0

    def fetch(self, url):
        self.calls.append(url)
        if self.fail.get(url):
            raise self.fail[url].pop(0)
        if url == LISTING_1:
            return FetchResult(url, 200, read("listing_1.html"))
        if url == LISTING_2:
            return FetchResult(url, 200, read("listing_50.html"))
        slug = url.rstrip("/").split("/")[-2]
        item = _listing_index()[url]  # product pages agree with their listing entry, like a healthy site
        html = self.overrides.get(url) or product_html(f"upc-{slug}", item.title, item.price_text, item.rating_text)
        return FetchResult(url, 200, html)

    def rotate(self):
        self.rotations += 1

    def close(self):
        pass


def err(kind: FailureKind, url="u", status=None, retry_after=None):
    return FetchError(kind, url, status, retry_after)
