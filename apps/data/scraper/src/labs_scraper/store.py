"""Postgres access (schema `data`). Works against Supabase's DB URL or any Postgres with the migration applied."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import psycopg

from .normalize import Normalized

FIELDS = ("title", "price", "currency", "rating", "in_stock", "url")


@dataclass
class Run:
    id: int
    cursor: str | None
    resumed: bool


def _jsonable(v: Any) -> Any:
    return str(v.quantize(Decimal('0.01'))) if isinstance(v, Decimal) else v


class Store:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn  # expected autocommit=True; multi-statement work uses transaction()

    # --- runs and checkpoints
    def open_run(self) -> Run:
        """Resume the latest unfinished run (its cursor is the next page to fetch), else start a new one."""
        row = self.conn.execute(
            "select id, cursor from data.scrape_runs where status in ('running', 'failed') "
            "and cursor is not null order by id desc limit 1").fetchone()
        if row:
            self.conn.execute("update data.scrape_runs set status = 'running', finished_at = null where id = %s", (row[0],))
            return Run(row[0], row[1], True)
        return Run(self.conn.execute("insert into data.scrape_runs default values returning id").fetchone()[0], None, False)

    def checkpoint(self, run_id: int, cursor: str | None, products: int) -> None:
        self.conn.execute(
            "update data.scrape_runs set cursor = %s, pages = pages + 1, products = products + %s where id = %s",
            (cursor, products, run_id))

    def record_error(self, run_id: int, error: dict) -> None:
        self.conn.execute("update data.scrape_runs set errors = errors || %s::jsonb where id = %s",
                          (json.dumps([error]), run_id))

    def finish(self, run_id: int, status: str) -> None:
        self.conn.execute("update data.scrape_runs set status = %s, finished_at = now() where id = %s", (status, run_id))

    # --- data
    def save_snapshot(self, run_id: int, url: str, status: int, html: str) -> int:
        digest = hashlib.sha256(html.encode()).hexdigest()
        return self.conn.execute(
            "insert into data.raw_snapshots (run_id, url, status_code, content_hash, html) values (%s, %s, %s, %s, %s) "
            "on conflict (url, content_hash) do update set fetched_at = now(), run_id = excluded.run_id returning id",
            (run_id, url, status, digest, html)).fetchone()[0]

    def upsert_entity(self, source: str, n: Normalized, confidence: float, reasons: list[str],
                      needs_review: bool, snapshot_id: int) -> str:
        """Insert or update by (source, source_key). Returns created | updated | unchanged.
        Field changes are written to entity_history. A corrected entity keeps its human-fixed fields."""
        new = {f: _jsonable(getattr(n, f)) for f in FIELDS}
        with self.conn.transaction():
            row = self.conn.execute(
                "select id, title, price, currency, rating, in_stock, url, corrected from data.entities "
                "where source = %s and source_key = %s for update", (source, n.source_key)).fetchone()
            if row is None:
                eid = self.conn.execute(
                    "insert into data.entities (source, source_key, url, title, price, currency, rating, in_stock, "
                    "confidence, confidence_reasons, needs_review) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) returning id",
                    (source, n.source_key, n.url, n.title, n.price, n.currency, n.rating, n.in_stock,
                     confidence, json.dumps(reasons), needs_review)).fetchone()[0]
                self._history(eid, "scrape", {f: {"old": None, "new": v} for f, v in new.items()}, snapshot_id)
                return "created"
            eid, corrected = row[0], row[7]
            old = {f: _jsonable(v) for f, v in zip(FIELDS, row[1:7])}
            changes = {f: {"old": old[f], "new": new[f]} for f in FIELDS if old[f] != new[f]}
            if corrected:
                # Keep the human's values; record what the scrape saw so a parser regression stays visible.
                self.conn.execute("update data.entities set last_seen = now() where id = %s", (eid,))
                if changes:
                    self._history(eid, "scrape", {f: {**c, "ignored": True} for f, c in changes.items()}, snapshot_id)
                return "unchanged"
            if not changes:
                self.conn.execute("update data.entities set last_seen = now() where id = %s", (eid,))
                return "unchanged"
            self.conn.execute(
                "update data.entities set url=%s, title=%s, price=%s, currency=%s, rating=%s, in_stock=%s, confidence=%s, "
                "confidence_reasons=%s, needs_review=%s, last_seen=now(), updated_at=now() where id=%s",
                (n.url, n.title, n.price, n.currency, n.rating, n.in_stock, confidence, json.dumps(reasons),
                 needs_review, eid))
            self._history(eid, "scrape", changes, snapshot_id)
            return "updated"

    def _history(self, entity_id: int, reason: str, changes: dict, snapshot_id: int | None) -> None:
        self.conn.execute(
            "insert into data.entity_history (entity_id, reason, changes, snapshot_id) values (%s, %s, %s, %s)",
            (entity_id, reason, json.dumps(changes), snapshot_id))


def connect(url: str) -> psycopg.Connection:
    return psycopg.connect(url, autocommit=True)
