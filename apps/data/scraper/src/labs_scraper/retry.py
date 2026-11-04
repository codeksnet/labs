"""Retry by failure type. Not every failure deserves the same response."""
from __future__ import annotations

import time
from collections.abc import Callable

from .fetch import FailureKind, Fetcher, FetchError, FetchResult

# kind -> (max attempts, base delay seconds). Delay doubles each attempt.
POLICY: dict[FailureKind, tuple[int, float]] = {
    FailureKind.TIMEOUT: (3, 2.0),
    FailureKind.NETWORK: (3, 2.0),
    FailureKind.SERVER_ERROR: (3, 5.0),
    FailureKind.RATE_LIMITED: (5, 30.0),   # back off hard, honour Retry-After
    FailureKind.BLOCKED: (2, 10.0),        # rotate the session once, then give up
    FailureKind.NOT_FOUND: (1, 0.0),       # the page is gone: retrying cannot help
}
MAX_DELAY_S = 300.0


def delay_for(err: FetchError, attempt: int) -> float:
    _, base = POLICY[err.kind]
    if err.retry_after is not None:
        return min(err.retry_after, MAX_DELAY_S)
    return min(base * 2 ** (attempt - 1), MAX_DELAY_S)


def fetch_with_retries(fetcher: Fetcher, url: str,
                       sleep: Callable[[float], None] = time.sleep) -> FetchResult:
    attempt = 0
    while True:
        attempt += 1
        try:
            return fetcher.fetch(url)
        except FetchError as err:
            max_attempts, _ = POLICY[err.kind]
            if attempt >= max_attempts:
                raise
            if err.kind is FailureKind.BLOCKED:
                fetcher.rotate()
            sleep(delay_for(err, attempt))
