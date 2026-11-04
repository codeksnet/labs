"""python -m labs_scraper run [--max-pages N]   (env: DATABASE_URL, PROXY_URL, REQUEST_DELAY_S)"""
from __future__ import annotations

import argparse
import os
import sys

from .fetch import PlaywrightFetcher
from .run import run
from .store import Store, connect


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="labs_scraper")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="run (or resume) a scrape")
    r.add_argument("--max-pages", type=int)
    args = p.parse_args(argv)

    fetcher = PlaywrightFetcher()
    try:
        with connect(os.environ["DATABASE_URL"]) as conn:
            s = run(fetcher, Store(conn), max_pages=args.max_pages)
    finally:
        fetcher.close()
    print(f"run {s.run_id} {'(resumed) ' if s.resumed else ''}{s.status}: {s.pages} pages, "
          f"{dict(s.counts)}, {s.errors} errors")
    return 1 if s.status == "failed" else 0


if __name__ == "__main__":
    sys.exit(main())
