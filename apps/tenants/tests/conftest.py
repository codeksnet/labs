"""Leak-test fixtures. Runs against any Postgres that has supabase/migrations applied
(local Docker, CI service container, or a Supabase DB). Set TENANTS_TEST_DATABASE_URL."""
import os
import uuid
from contextlib import contextmanager

import psycopg
import pytest

URL = os.environ.get("TENANTS_TEST_DATABASE_URL")
if not URL:
    pytest.skip("set TENANTS_TEST_DATABASE_URL (see scripts/test-leak.sh)", allow_module_level=True)

USER_A, USER_B, USER_NOBODY = (str(uuid.uuid4()) for _ in range(3))
DIM = 64


def vec(i: int) -> str:
    """A unit vector along axis i, as a pgvector literal."""
    return "[" + ",".join("1" if k == i else "0" for k in range(DIM)) + "]"


@pytest.fixture(scope="session")
def ids():
    """Seed two tenants (superuser, bypasses RLS) and return their ids."""
    out = {}
    with psycopg.connect(URL, autocommit=True) as c:
        c.execute("truncate tenants.chunks, tenants.documents, tenants.memberships, tenants.tenants cascade")
        for key, user, axis in (("a", USER_A, 0), ("b", USER_B, 1)):
            tid = c.execute("insert into tenants.tenants (slug, name) values (%s, %s) returning id",
                            (f"t-{key}", f"Tenant {key.upper()}")).fetchone()[0]
            c.execute("insert into tenants.memberships values (%s, %s)", (user, tid))
            did = c.execute("insert into tenants.documents (tenant_id, title) values (%s, 'doc') returning id",
                            (tid,)).fetchone()[0]
            cid = c.execute(
                "insert into tenants.chunks (tenant_id, document_id, content, embedding) "
                "values (%s, %s, %s, %s) returning id",
                (tid, did, f"secret of {key.upper()}", vec(axis))).fetchone()[0]
            out[key] = {"tenant": tid, "doc": did, "chunk": cid, "axis": axis}
    return out


@contextmanager
def _session(role: str, user: str | None):
    """A connection that behaves like a PostgREST request: role + JWT sub, rolled back on exit."""
    with psycopg.connect(URL) as c:
        c.execute(f"set local role {role}")
        if user:
            c.execute("select set_config('request.jwt.claim.sub', %s, true)", (user,))
        try:
            yield c
        finally:
            c.rollback()


@pytest.fixture
def as_user():
    return lambda user: _session("authenticated", user)


@pytest.fixture
def as_anon():
    return lambda: _session("anon", None)
