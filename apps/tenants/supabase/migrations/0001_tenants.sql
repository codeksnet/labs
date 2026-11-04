-- Tenant isolation demo. Isolation is enforced in the data layer (RLS), never in the app or prompt.
-- Embedding size is 64 to match lib/embed.ts (a keyless hashing embedding, swap for a real model).
create extension if not exists vector with schema extensions;
create schema if not exists tenants;

create table tenants.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

-- user_id is an auth.users id. Written only by the service role (seed script).
create table tenants.memberships (
  user_id uuid not null,
  tenant_id uuid not null references tenants.tenants(id) on delete cascade,
  primary key (user_id, tenant_id)
);

create table tenants.documents (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants.tenants(id) on delete cascade,
  title text not null,
  unique (id, tenant_id)
);

-- Composite FK: a chunk can only point at a document of the SAME tenant.
create table tenants.chunks (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  document_id bigint not null,
  content text not null,
  embedding extensions.vector(64) not null,
  foreign key (document_id, tenant_id) references tenants.documents(id, tenant_id) on delete cascade
);
create index on tenants.chunks (tenant_id);
create index on tenants.chunks using hnsw (embedding extensions.vector_cosine_ops);

-- Membership check. SECURITY DEFINER so policies on other tables can read memberships.
create function tenants.is_member(t uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from tenants.memberships m where m.tenant_id = t and m.user_id = auth.uid()
  )
$$;

alter table tenants.tenants enable row level security;
alter table tenants.memberships enable row level security;
alter table tenants.documents enable row level security;
alter table tenants.chunks enable row level security;

create policy tenants_select on tenants.tenants for select to authenticated
  using (tenants.is_member(id));
create policy memberships_select on tenants.memberships for select to authenticated
  using (user_id = auth.uid());
create policy documents_all on tenants.documents for all to authenticated
  using (tenants.is_member(tenant_id)) with check (tenants.is_member(tenant_id));
create policy chunks_all on tenants.chunks for all to authenticated
  using (tenants.is_member(tenant_id)) with check (tenants.is_member(tenant_id));

-- Retrieval has no tenant argument on purpose. SECURITY INVOKER means RLS filters the rows,
-- so a caller cannot ask for another tenant's chunks even by passing a different query.
create function tenants.match_chunks(query_embedding extensions.vector(64), match_count int default 5)
returns table (id bigint, document_id bigint, content text, similarity double precision)
language sql stable security invoker set search_path = tenants, extensions, public
as $$
  select c.id, c.document_id, c.content, 1 - (c.embedding <=> query_embedding)
  from tenants.chunks c
  order by c.embedding <=> query_embedding
  limit match_count
$$;

grant usage on schema tenants to authenticated;
grant select on tenants.tenants, tenants.memberships to authenticated;
grant select, insert, update, delete on tenants.documents, tenants.chunks to authenticated;
grant usage on all sequences in schema tenants to authenticated;
grant execute on function tenants.match_chunks(extensions.vector, int) to authenticated;
-- anon gets nothing: not even schema usage.
