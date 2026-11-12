-- Keep the batch RPC in sync with the collections accepted by ledge_records.
alter table public.ledge_records
  drop constraint if exists ledge_records_collection_check;

alter table public.ledge_records
  add constraint ledge_records_collection_check
  check (
    collection in (
      'people', 'categories', 'transactions', 'chittis', 'chittiPayments', 'repaymentPlans'
    )
  );

create or replace function public.ledge_sync_write_batch(p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  change jsonb;
  result jsonb := '[]'::jsonb;
  saved public.ledge_records;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 100 then
    raise exception 'Expected an array of at most 100 record changes';
  end if;

  for change in select value from jsonb_array_elements(p_changes)
  loop
    if change ->> 'collection' not in (
      'people', 'categories', 'transactions', 'chittis', 'chittiPayments', 'repaymentPlans'
    ) then
      raise exception 'Invalid Ledge collection';
    end if;
    if coalesce(change ->> 'record_id', '') = '' then
      raise exception 'Record ID is required';
    end if;

    insert into public.ledge_records (
      owner_id, collection, record_id, payload, client_updated_at, updated_at, deleted_at
    ) values (
      auth.uid(),
      change ->> 'collection',
      change ->> 'record_id',
      coalesce(change -> 'payload', jsonb_build_object('id', change ->> 'record_id')),
      greatest(0, coalesce((change ->> 'client_updated_at')::bigint, 0)),
      now(),
      case when coalesce((change ->> 'deleted')::boolean, false) then now() else null end
    )
    on conflict (owner_id, collection, record_id) do update set
      payload = excluded.payload,
      client_updated_at = excluded.client_updated_at,
      updated_at = now(),
      deleted_at = excluded.deleted_at,
      revision = public.ledge_records.revision + 1
    where public.ledge_records.client_updated_at <= excluded.client_updated_at
    returning * into saved;

    if found then
      result := result || jsonb_build_array(to_jsonb(saved));
    else
      select * into saved from public.ledge_records
      where owner_id = auth.uid()
        and collection = change ->> 'collection'
        and record_id = change ->> 'record_id';
      result := result || jsonb_build_array(to_jsonb(saved));
    end if;
  end loop;
  return result;
end;
$$;

revoke all on function public.ledge_sync_write_batch(jsonb) from public, anon;
grant execute on function public.ledge_sync_write_batch(jsonb) to authenticated;
