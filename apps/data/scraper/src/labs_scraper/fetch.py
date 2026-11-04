"""Fetching, with failures classified by kind so each kind can have its own retry policy."""
from __future__ import annotations

import enum
import os
import time
from dataclasses import dataclass
from typing import Protocol


class FailureKind(enum.Enum):
    TIMEOUT = "timeout"
    NETWORK = "network"
    RATE_LIMITED = "rate_limited"
    BLOCKED = "blocked"
    NOT_FOUND = "not_found"
    SERVER_ERROR = "server_error"


class FetchError(Exception):
    def __init__(self, kind: FailureKind, url: str, status: int | None = None,
                 retry_after: float | None = None):
        super().__init__(f"{kind.value} fetching {url} (status={status})")
        self.kind, self.url, self.status, self.retry_after = kind, url, status, retry_after


@dataclass
class FetchResult:
    url: str
    status: int
    html: str


class Fetcher(Protocol):
    def fetch(self, url: str) -> FetchResult: ...
    def rotate(self) -> None: ...
    def close(self) -> None: ...


def classify_status(url: str, status: int, retry_after: float | None = None) -> FetchError | None:
    if status < 400:
        return None
    if status == 404:
        return FetchError(FailureKind.NOT_FOUND, url, status)
    if status == 429:
        return FetchError(FailureKind.RATE_LIMITED, url, status, retry_after)
    if status in (401, 403):
        return FetchError(FailureKind.BLOCKED, url, status)
    if status >= 500:
        return FetchError(FailureKind.SERVER_ERROR, url, status, retry_after if status == 503 else None)
    return FetchError(FailureKind.NETWORK, url, status)


class PlaywrightFetcher:
    """Chromium via Playwright. Optional residential proxy from PROXY_URL / PROXY_USERNAME / PROXY_PASSWORD.
    `rotate()` starts a fresh browser context, which gets a new proxy session when the provider uses sticky sessions."""

    def __init__(self, delay_s: float | None = None):
        from playwright.sync_api import sync_playwright

        self._delay = float(os.environ.get("REQUEST_DELAY_S", "1.0")) if delay_s is None else delay_s
        self._last = 0.0
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(headless=True)
        self._ctx = self._new_context()

    def _new_context(self):
        proxy = None
        if os.environ.get("PROXY_URL"):
            proxy = {"server": os.environ["PROXY_URL"]}
            if os.environ.get("PROXY_USERNAME"):
                proxy |= {"username": os.environ["PROXY_USERNAME"], "password": os.environ.get("PROXY_PASSWORD", "")}
        return self._browser.new_context(proxy=proxy, user_agent=os.environ.get(
            "USER_AGENT", "CodeksLabsBot/0.1 (+https://labs.codeks.net)"))

    def fetch(self, url: str) -> FetchResult:
        from playwright.sync_api import Error as PwError
        from playwright.sync_api import TimeoutError as PwTimeout

        wait = self._delay - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        page = self._ctx.new_page()
        try:
            resp = page.goto(url, timeout=20_000, wait_until="domcontentloaded")
            self._last = time.monotonic()
            if resp is None:
                raise FetchError(FailureKind.NETWORK, url)
            ra = resp.headers.get("retry-after")
            err = classify_status(url, resp.status, float(ra) if ra and ra.isdigit() else None)
            if err:
                raise err
            return FetchResult(url, resp.status, page.content())
        except PwTimeout as e:
            raise FetchError(FailureKind.TIMEOUT, url) from e
        except PwError as e:
            raise FetchError(FailureKind.NETWORK, url) from e
        finally:
            page.close()

    def rotate(self) -> None:
        self._ctx.close()
        self._ctx = self._new_context()

    def close(self) -> None:
        self._browser.close()
        self._pw.stop()
