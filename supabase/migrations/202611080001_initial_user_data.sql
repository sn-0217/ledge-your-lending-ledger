-- Ledge cloud storage foundation. Each account owns a private set of records.
-- The JSON payload preserves the existing Dexie record shape while allowing
-- the sync layer to evolve independently from UI components.

create table if not exists public.ledge_records (
  owner_id uuid not null references auth.users (id) on delete cascade,
  collection text not null check (
    collection in ('people', 'categories', 'transactions', 'chittis', 'chittiPayments')
  ),
  record_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (owner_id, collection, record_id)
);

create index if not exists ledge_records_owner_updated_idx
  on public.ledge_records (owner_id, updated_at);

alter table public.ledge_records enable row level security;

create policy "Users can read their own Ledge records"
  on public.ledge_records for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Users can create their own Ledge records"
  on public.ledge_records for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Users can update their own Ledge records"
  on public.ledge_records for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own Ledge records"
  on public.ledge_records for delete to authenticated
  using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.ledge_records to authenticated;

-- Required before clients can subscribe to changes in this table.
alter publication supabase_realtime add table public.ledge_records;
