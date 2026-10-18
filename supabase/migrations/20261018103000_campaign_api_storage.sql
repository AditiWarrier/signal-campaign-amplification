-- Preserve the normalized foundation while retaining every existing five-step
-- form field and the local client ID used by device drafts.
do $$
begin
  if to_regclass('public.signal_demo_contributions') is not null then
    raise exception 'public.signal_demo_contributions already exists; inspect it before applying this migration.';
  end if;
end;
$$;

alter table public.signal_campaigns
  add column if not exists client_id text,
  add column if not exists form_data jsonb not null default '{}'::jsonb;

create unique index if not exists signal_campaigns_creator_client_id_unique
  on public.signal_campaigns (creator_id, client_id)
  where client_id is not null;

create table public.signal_demo_contributions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.signal_campaigns(id) on delete cascade,
  contributor_id uuid not null references auth.users(id) on delete cascade,
  amount_minor bigint not null check (amount_minor between 100 and 100000),
  currency text not null default 'USD' check (currency = 'USD'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  created_at timestamptz not null default now(),
  unique (contributor_id, campaign_id, idempotency_key)
);
alter table public.signal_demo_contributions enable row level security;
revoke all on public.signal_demo_contributions from anon, authenticated;
grant select on public.signal_demo_contributions to authenticated;
grant all on public.signal_demo_contributions to service_role;
create policy signal_demo_contributions_read on public.signal_demo_contributions
for select to authenticated using (
  contributor_id = (select auth.uid())
  or exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()))
  or exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.status = 'approved')
);

create or replace function public.signal_guard_campaign_update()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  trusted_reviewer boolean := coalesce(auth.jwt()->'app_metadata'->>'role' in ('reviewer', 'admin'), false);
begin
  if auth.role() is distinct from 'service_role' then
    if new.creator_id is distinct from old.creator_id then
      raise exception 'Campaign ownership cannot be changed by a client.' using errcode = '42501';
    end if;
    if (new.reviewed_at is distinct from old.reviewed_at
      or new.reviewed_by is distinct from old.reviewed_by
      or new.review_feedback is distinct from old.review_feedback) and not trusted_reviewer then
      raise exception 'Review fields can only be changed by a reviewer.' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'draft' and new.status = 'submitted')
      or (trusted_reviewer and (
        (old.status = 'submitted' and new.status in ('under_review', 'approved', 'rejected'))
        or (old.status = 'under_review' and new.status in ('approved', 'rejected'))
      ))
    ) then
      raise exception 'The requested campaign status transition is not permitted.' using errcode = '42501';
    end if;
    if new.submitted_at is distinct from old.submitted_at
      and not (old.status = 'draft' and new.status = 'submitted') then
      raise exception 'Submission timestamps are managed by the database.' using errcode = '42501';
    end if;
  end if;

  if new.status = 'submitted' and new.status is distinct from old.status then
    new.submitted_at := clock_timestamp();
  elsif new.status = 'draft' then
    new.submitted_at := null;
  else
    new.submitted_at := old.submitted_at;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function public.signal_api_save_draft(p_client_id text, p_data jsonb)
returns public.signal_campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_id uuid := auth.uid();
  saved public.signal_campaigns;
begin
  if authenticated_id is null then
    raise exception 'An authenticated account is required.' using errcode = '42501';
  end if;
  if p_client_id is null or char_length(p_client_id) not between 1 and 100
    or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text) > 48000 then
    raise exception 'Invalid campaign draft.' using errcode = '22023';
  end if;

  insert into public.signal_campaigns (
    creator_id, client_id, form_data, title, category, cause, summary,
    funding_goal_minor, currency, starts_at, ends_at, status
  ) values (
    authenticated_id,
    p_client_id,
    p_data,
    coalesce(p_data->>'title', ''),
    nullif(p_data->>'category', ''),
    coalesce(p_data->>'cause', p_data->>'creatorName', ''),
    coalesce(p_data->>'summary', ''),
    nullif(nullif(p_data->>'fundingGoalMinor', '')::bigint, 0),
    case when coalesce(nullif(p_data->>'fundingGoalMinor', '')::bigint, 0) > 0
      then coalesce(nullif(p_data->>'currency', ''), 'USD') else null end,
    nullif(p_data->>'startsAt', '')::timestamptz,
    nullif(p_data->>'endsAt', '')::timestamptz,
    'draft'
  )
  on conflict (creator_id, client_id) where client_id is not null
  do update set
    form_data = excluded.form_data,
    title = excluded.title,
    category = excluded.category,
    cause = excluded.cause,
    summary = excluded.summary,
    funding_goal_minor = excluded.funding_goal_minor,
    currency = excluded.currency,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at
  where public.signal_campaigns.status = 'draft'
  returning * into saved;

  if saved.id is null then
    raise exception 'Only an owned draft can be updated.' using errcode = '42501';
  end if;
  return saved;
end;
$$;

create or replace function public.signal_api_submit_campaign(p_client_id text, p_policy_accepted boolean)
returns public.signal_campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_id uuid := auth.uid();
  saved public.signal_campaigns;
begin
  if authenticated_id is null then
    raise exception 'An authenticated account is required.' using errcode = '42501';
  end if;
  if p_policy_accepted is distinct from true then
    raise exception 'Submission rules must be accepted.' using errcode = '22023';
  end if;

  select * into saved
  from public.signal_campaigns
  where creator_id = authenticated_id and client_id = p_client_id
  for update;
  if saved.id is null then
    raise exception 'Campaign was not found.' using errcode = 'P0002';
  end if;
  if saved.status = 'draft' then
    if coalesce(saved.form_data->>'title', '') = ''
      or coalesce(saved.category, '') not in ('Environment', 'Education', 'Community', 'Human Rights')
      or coalesce(saved.form_data->>'creatorName', '') = ''
      or coalesce(saved.form_data->>'storyHeadline', '') = ''
      or coalesce(saved.form_data->>'introduction', '') = ''
      or coalesce(saved.form_data->>'policyAccepted', 'false') <> 'true'
      or coalesce((saved.form_data->>'durationDays')::integer, 0) not between 1 and 90
      or coalesce((saved.form_data->>'fundingGoalMinor')::bigint, 0) <= 0
      or coalesce((saved.form_data->>'instagramBudgetMinor')::bigint, 0)
        + coalesce((saved.form_data->>'facebookBudgetMinor')::bigint, 0) <= 0
      or coalesce((saved.form_data->>'instagramBudgetMinor')::bigint, 0)
        + coalesce((saved.form_data->>'facebookBudgetMinor')::bigint, 0)
        > coalesce((saved.form_data->>'fundingGoalMinor')::bigint, 0) then
      raise exception 'Campaign does not meet submission requirements.' using errcode = '22023';
    end if;

    if jsonb_typeof(saved.form_data->'sections') is distinct from 'array' then
      raise exception 'Campaign does not meet submission requirements.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(saved.form_data->'sections') as section(value)
      where coalesce(section.value->>'body', '') <> ''
    ) then
      raise exception 'Campaign does not meet submission requirements.' using errcode = '22023';
    end if;

    if jsonb_typeof(saved.form_data->'locations') is distinct from 'array' then
      raise exception 'Campaign does not meet submission requirements.' using errcode = '22023';
    end if;
    if jsonb_array_length(saved.form_data->'locations') = 0 then
      raise exception 'Campaign does not meet submission requirements.' using errcode = '22023';
    end if;

    if jsonb_typeof(saved.form_data->'channels') is distinct from 'array' then
      raise exception 'Campaign does not meet submission requirements.' using errcode = '22023';
    end if;
    if jsonb_array_length(saved.form_data->'channels') = 0 then
      raise exception 'Campaign does not meet submission requirements.' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(saved.form_data->'channels') as channel(value)
      where channel.value not in ('instagram', 'facebook')
    ) then
      raise exception 'Campaign does not meet submission requirements.' using errcode = '22023';
    end if;

    update public.signal_campaigns set status = 'submitted'
    where id = saved.id returning * into saved;
    insert into public.signal_activity_events (user_id, campaign_id, event_type, dedupe_key, metadata)
    values (
      authenticated_id,
      saved.id,
      'campaign.submitted',
      'campaign.submitted:' || saved.id::text,
      jsonb_build_object('campaignTitle', saved.title, 'campaignClientId', saved.client_id, 'status', 'submitted')
    ) on conflict (user_id, dedupe_key) do nothing;
  elsif saved.status not in ('submitted', 'under_review', 'approved', 'rejected', 'completed') then
    raise exception 'Campaign cannot be submitted in its current state.' using errcode = '55000';
  end if;
  return saved;
end;
$$;

create or replace function public.signal_api_create_demo_contribution(
  p_campaign_client_id text, p_amount_minor bigint, p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_id uuid := auth.uid();
  target_campaign public.signal_campaigns;
  contribution public.signal_demo_contributions;
begin
  if authenticated_id is null then
    raise exception 'An authenticated account is required.' using errcode = '42501';
  end if;
  if p_amount_minor not between 100 and 100000
    or p_idempotency_key is null
    or char_length(p_idempotency_key) not between 8 and 120 then
    raise exception 'Invalid simulated contribution.' using errcode = '22023';
  end if;

  select * into target_campaign from public.signal_campaigns
  where client_id = p_campaign_client_id and status = 'approved';
  if target_campaign.id is null then
    raise exception 'Only approved campaigns accept simulated contributions.' using errcode = 'P0002';
  end if;
  if target_campaign.creator_id = authenticated_id then
    raise exception 'Creators cannot contribute to their own campaign.' using errcode = '42501';
  end if;

  insert into public.signal_demo_contributions (campaign_id, contributor_id, amount_minor, idempotency_key)
  values (target_campaign.id, authenticated_id, p_amount_minor, p_idempotency_key)
  on conflict (contributor_id, campaign_id, idempotency_key) do nothing
  returning * into contribution;
  if contribution.id is null then
    select * into contribution from public.signal_demo_contributions
    where contributor_id = authenticated_id and campaign_id = target_campaign.id and idempotency_key = p_idempotency_key;
    if contribution.campaign_id <> target_campaign.id or contribution.amount_minor <> p_amount_minor then
      raise exception 'The idempotency key was already used for a different contribution.' using errcode = '23505';
    end if;
  end if;

  insert into public.signal_activity_events (user_id, campaign_id, event_type, dedupe_key, metadata)
  values
    (authenticated_id, target_campaign.id, 'contribution.simulated', 'contribution.simulated:' || contribution.id::text || ':' || authenticated_id::text,
      jsonb_build_object('campaignTitle', target_campaign.title, 'campaignClientId', target_campaign.client_id, 'contributionId', contribution.id, 'amountMinor', contribution.amount_minor, 'currency', 'USD')),
    (target_campaign.creator_id, target_campaign.id, 'contribution.simulated', 'contribution.simulated:' || contribution.id::text || ':' || target_campaign.creator_id::text,
      jsonb_build_object('campaignTitle', target_campaign.title, 'campaignClientId', target_campaign.client_id, 'contributionId', contribution.id, 'amountMinor', contribution.amount_minor, 'currency', 'USD'))
  on conflict (user_id, dedupe_key) do nothing;

  return jsonb_build_object(
    'id', contribution.id,
    'campaignId', target_campaign.client_id,
    'contributorId', contribution.contributor_id,
    'amountMinor', contribution.amount_minor,
    'currency', contribution.currency,
    'status', 'simulated',
    'idempotencyKey', contribution.idempotency_key,
    'createdAt', contribution.created_at
  );
end;
$$;

create or replace function public.signal_api_review_campaign(p_client_id text, p_status text, p_feedback text)
returns public.signal_campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_id uuid := auth.uid();
  caller_role text := auth.jwt()->'app_metadata'->>'role';
  campaign_row public.signal_campaigns;
  previous_status public.signal_campaign_status;
begin
  if authenticated_id is null or caller_role not in ('reviewer', 'admin') then
    raise exception 'A verified reviewer or admin role is required.' using errcode = '42501';
  end if;
  if p_status not in ('under_review', 'approved', 'rejected')
    or char_length(coalesce(p_feedback, '')) > 2000 then
    raise exception 'Invalid review update.' using errcode = '22023';
  end if;
  select * into campaign_row from public.signal_campaigns
  where client_id = p_client_id for update;
  if campaign_row.id is null then
    raise exception 'Campaign was not found.' using errcode = 'P0002';
  end if;
  if campaign_row.status not in ('submitted', 'under_review') then
    raise exception 'Only submitted campaigns can be reviewed.' using errcode = '55000';
  end if;
  previous_status := campaign_row.status;
  update public.signal_campaigns set
    status = p_status::public.signal_campaign_status,
    reviewed_at = clock_timestamp(),
    reviewed_by = authenticated_id,
    review_feedback = coalesce(p_feedback, '')
  where id = campaign_row.id returning * into campaign_row;
  insert into public.signal_activity_events (user_id, campaign_id, event_type, dedupe_key, metadata)
  values (
    campaign_row.creator_id,
    campaign_row.id,
    'campaign.' || campaign_row.status::text,
    'campaign.' || campaign_row.status::text || ':' || campaign_row.id::text,
    jsonb_build_object('campaignTitle', campaign_row.title, 'campaignClientId', campaign_row.client_id, 'status', campaign_row.status, 'feedback', coalesce(p_feedback, ''))
  ) on conflict (user_id, dedupe_key) do nothing;
  return campaign_row;
end;
$$;

revoke all on function public.signal_api_save_draft(text, jsonb) from public, anon;
revoke all on function public.signal_api_submit_campaign(text, boolean) from public, anon;
grant execute on function public.signal_api_save_draft(text, jsonb) to authenticated;
grant execute on function public.signal_api_submit_campaign(text, boolean) to authenticated;
revoke all on function public.signal_api_create_demo_contribution(text, bigint, text) from public, anon;
grant execute on function public.signal_api_create_demo_contribution(text, bigint, text) to authenticated;
revoke all on function public.signal_api_review_campaign(text, text, text) from public, anon;
grant execute on function public.signal_api_review_campaign(text, text, text) to authenticated;
