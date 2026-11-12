-- Add the repayment-plan collection to the private record store.
alter table public.ledge_records
  drop constraint if exists ledge_records_collection_check;

alter table public.ledge_records
  add constraint ledge_records_collection_check
  check (
    collection in (
      'people',
      'categories',
      'transactions',
      'chittis',
      'chittiPayments',
      'repaymentPlans'
    )
  );
