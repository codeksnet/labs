"""Log in as tenant A and assert nothing from tenant B is reachable, by any route."""
import psycopg
import pytest
from conftest import USER_A, USER_B, USER_NOBODY, vec

TABLES = ["tenants", "memberships", "documents", "chunks"]


def test_a_sees_only_its_own_rows(ids, as_user):
    with as_user(USER_A) as c:
        assert c.execute("select id from tenants.tenants").fetchall() == [(ids["a"]["tenant"],)]
        assert c.execute("select id from tenants.documents").fetchall() == [(ids["a"]["doc"],)]
        assert c.execute("select id from tenants.chunks").fetchall() == [(ids["a"]["chunk"],)]
        assert c.execute("select count(*) from tenants.memberships where user_id = %s", (USER_B,)).fetchone()[0] == 0


def test_retrieval_never_returns_b_chunks_even_for_b_exact_query(ids, as_user):
    # The query vector is exactly B's chunk. Without RLS it would be the top hit.
    with as_user(USER_A) as c:
        rows = c.execute("select id from tenants.match_chunks(%s::extensions.vector, 10)", (vec(ids["b"]["axis"]),)).fetchall()
    assert ids["b"]["chunk"] not in [r[0] for r in rows]
    assert [r[0] for r in rows] == [ids["a"]["chunk"]]


def test_filtering_by_b_tenant_id_returns_zero(ids, as_user):
    with as_user(USER_A) as c:
        for t in ("documents", "chunks"):
            n = c.execute(f"select count(*) from tenants.{t} where tenant_id = %s", (ids["b"]["tenant"],)).fetchone()[0]
            assert n == 0


def test_anon_sees_nothing(as_anon):
    with as_anon() as c:
        for t in TABLES:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                c.execute(f"select * from tenants.{t}")
            c.rollback()
            c.execute("set local role anon")


def test_user_without_membership_sees_nothing(as_user):
    with as_user(USER_NOBODY) as c:
        for t in TABLES:
            assert c.execute(f"select count(*) from tenants.{t}").fetchone()[0] == 0


def test_cannot_write_into_b(ids, as_user):
    with as_user(USER_A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("insert into tenants.documents (tenant_id, title) values (%s, 'x')", (ids["b"]["tenant"],))


def test_cannot_attach_a_chunk_to_b_document(ids, as_user):
    with as_user(USER_A) as c:
        with pytest.raises(psycopg.Error):  # RLS (tenant B) or the composite FK (A tenant, B doc)
            c.execute("insert into tenants.chunks (tenant_id, document_id, content, embedding) values (%s, %s, 'x', %s)",
                      (ids["a"]["tenant"], ids["b"]["doc"], vec(5)))


def test_cannot_update_or_delete_b(ids, as_user):
    with as_user(USER_A) as c:
        assert c.execute("update tenants.documents set title = 'pwned' where id = %s", (ids["b"]["doc"],)).rowcount == 0
        assert c.execute("delete from tenants.chunks where id = %s", (ids["b"]["chunk"],)).rowcount == 0


def test_every_table_has_rls_enabled():
    """Guards against a future migration adding a table and forgetting RLS."""
    import os
    with psycopg.connect(os.environ["TENANTS_TEST_DATABASE_URL"]) as c:
        rows = c.execute(
            "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace "
            "where n.nspname = 'tenants' and c.relkind = 'r' and not c.relrowsecurity").fetchall()
    assert rows == [], f"tables without RLS: {rows}"
