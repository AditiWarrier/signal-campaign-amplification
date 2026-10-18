-- SIGNAL campaign foundation. This migration is additive and intentionally
-- aborts if any of its target objects already exist. Inspect the linked
-- project's schema and migration history before applying it.

do $$
declare
  object_name text;
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise exception 'Supabase Storage is not available; inspect project setup before applying this migration.';
  end if;

  foreach object_name in array array[
    'signal_campaigns',
    'signal_campaign_story_sections',
    'signal_campaign_sources',
    'signal_campaign_creatives',
    'signal_campaign_locations',
    'signal_campaign_audience_settings',
    'signal_campaign_channel_allocations',
    'signal_campaign_reach_estimates',
    'signal_campaign_contributions',
    'signal_campaign_funding_totals',
    'signal_campaign_status_history',
    'signal_activity_events'
  ] loop
    if to_regclass(format('public.%I', object_name)) is not null then
      raise exception 'Target table public.% already exists; inspect it and reconcile the migration before applying.', object_name;
    end if;
  end loop;

  foreach object_name in array array[
    'signal_campaign_status',
    'signal_contribution_status',
    'signal_creative_kind',
    'signal_distribution_channel'
  ] loop
    if to_regtype(format('public.%I', object_name)) is not null then
      raise exception 'Target type public.% already exists; inspect it and reconcile the migration before applying.', object_name;
    end if;
  end loop;

  if exists (select 1 from storage.buckets where id = 'signal-campaign-media') then
    raise exception 'Storage bucket signal-campaign-media already exists; inspect its settings and policies before applying.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'signal_campaign_media_%'
  ) then
    raise exception 'A target storage policy name already exists; inspect storage policies before applying.';
  end if;
end;
$$;

create type public.signal_campaign_status as enum (
  'draft', 'submitted', 'under_review', 'approved', 'rejected', 'cancelled', 'completed'
);
create type public.signal_contribution_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.signal_creative_kind as enum ('cover', 'ad_creative');
create type public.signal_distribution_channel as enum ('instagram', 'facebook');

create table public.signal_campaigns (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete restrict,
  title text not null default '' check (char_length(title) <= 180),
  category text check (category is null or category in ('Environment', 'Education', 'Community', 'Human Rights')),
  cause text not null default '' check (char_length(cause) <= 180),
  summary text not null default '' check (char_length(summary) <= 1000),
  status public.signal_campaign_status not null default 'draft',
  funding_goal_minor bigint check (funding_goal_minor is null or funding_goal_minor between 1 and 9007199254740991),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  starts_at timestamptz,
  ends_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete restrict,
  review_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signal_campaign_goal_currency_pair check ((funding_goal_minor is null) = (currency is null)),
  constraint signal_campaign_submission_metadata check (
    (status = 'draft' and submitted_at is null and reviewed_at is null and reviewed_by is null and review_feedback is null)
    or (status <> 'draft' and submitted_at is not null)
  ),
  constraint signal_campaign_review_metadata check (
    (reviewed_at is null) = (reviewed_by is null)
    and (status not in ('approved', 'rejected') or (reviewed_at is not null and reviewed_by is not null))
  ),
  constraint signal_campaign_date_order check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint signal_campaign_id_currency_unique unique (id, currency)
);

create table public.signal_campaign_story_sections (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.signal_campaigns(id) on delete cascade,
  display_order integer not null check (display_order >= 0),
  heading text not null default '' check (char_length(heading) <= 180),
  body_markdown text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signal_story_order_unique unique (campaign_id, display_order)
);

create table public.signal_campaign_sources (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.signal_campaigns(id) on delete cascade,
  display_order integer not null check (display_order >= 0),
  title text not null check (char_length(title) between 1 and 240),
  url text not null check (url ~* '^https?://[^[:space:]]+$'),
  publisher text check (publisher is null or char_length(publisher) <= 180),
  created_at timestamptz not null default now(),
  constraint signal_source_order_unique unique (campaign_id, display_order)
);

create table public.signal_campaign_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.signal_campaigns(id) on delete cascade,
  kind public.signal_creative_kind not null,
  channel public.signal_distribution_channel,
  storage_path text not null unique check (storage_path !~ '(^/|\.\.|//)'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 20971520),
  width integer not null check (width between 1 and 12000),
  height integer not null check (height between 1 and 12000),
  alt_text text not null default '' check (char_length(alt_text) <= 500),
  caption text not null default '' check (char_length(caption) <= 1000),
  headline text not null default '' check (char_length(headline) <= 180),
  description text not null default '' check (char_length(description) <= 2000),
  call_to_action text not null default '' check (char_length(call_to_action) <= 80),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signal_ad_creative_channel check (kind <> 'ad_creative' or channel is not null)
);

create table public.signal_campaign_locations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.signal_campaigns(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  region text check (region is null or char_length(region) <= 120),
  locality text check (locality is null or char_length(locality) <= 120),
  radius_km numeric(7,2) check (radius_km is null or radius_km between 0.1 and 500),
  created_at timestamptz not null default now(),
  constraint signal_location_unique unique (campaign_id, country_code, region, locality)
);

create table public.signal_campaign_audience_settings (
  campaign_id uuid primary key references public.signal_campaigns(id) on delete cascade,
  minimum_age smallint check (minimum_age is null or minimum_age between 18 and 100),
  maximum_age smallint check (maximum_age is null or maximum_age between 18 and 100),
  interests text[] not null default '{}',
  audience_notes text not null default '' check (char_length(audience_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signal_audience_age_order check (minimum_age is null or maximum_age is null or maximum_age >= minimum_age)
);

create table public.signal_campaign_channel_allocations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  channel public.signal_distribution_channel not null,
  amount_minor bigint not null check (amount_minor between 1 and 9007199254740991),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signal_channel_allocation_unique unique (campaign_id, channel),
  constraint signal_channel_campaign_currency_fk foreign key (campaign_id, currency)
    references public.signal_campaigns(id, currency) on delete cascade
);

create table public.signal_campaign_reach_estimates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  estimated_reach_min bigint not null check (estimated_reach_min between 0 and 9007199254740991),
  estimated_reach_max bigint not null check (estimated_reach_max between estimated_reach_min and 9007199254740991),
  basis_budget_minor bigint not null check (basis_budget_minor between 1 and 9007199254740991),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  estimator_version text not null check (char_length(estimator_version) between 1 and 80),
  assumptions jsonb not null default '{}'::jsonb check (jsonb_typeof(assumptions) = 'object'),
  estimate_type text not null default 'illustrative' check (estimate_type = 'illustrative'),
  created_at timestamptz not null default now(),
  constraint signal_reach_campaign_currency_fk foreign key (campaign_id, currency)
    references public.signal_campaigns(id, currency) on delete cascade
);

create table public.signal_campaign_contributions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  contributor_id uuid references auth.users(id) on delete set null,
  amount_minor bigint not null check (amount_minor between 1 and 9007199254740991),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status public.signal_contribution_status not null default 'pending',
  payment_provider text not null check (char_length(payment_provider) between 1 and 80),
  provider_reference text unique,
  succeeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signal_contribution_campaign_currency_fk foreign key (campaign_id, currency)
    references public.signal_campaigns(id, currency) on delete restrict
);

-- This aggregate is maintained only by a database trigger from trusted
-- contribution writes. It is deliberately separate from reach estimates.
create table public.signal_campaign_funding_totals (
  campaign_id uuid primary key,
  total_minor bigint not null default 0 check (total_minor between 0 and 9007199254740991),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now(),
  constraint signal_funding_campaign_currency_fk foreign key (campaign_id, currency)
    references public.signal_campaigns(id, currency) on delete cascade
);

create table public.signal_campaign_status_history (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.signal_campaigns(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  from_status public.signal_campaign_status,
  to_status public.signal_campaign_status not null,
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create table public.signal_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.signal_campaigns(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 80),
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint signal_activity_dedupe_unique unique (user_id, dedupe_key)
);

create index signal_campaigns_creator_updated_idx on public.signal_campaigns (creator_id, updated_at desc);
create index signal_campaigns_public_created_idx on public.signal_campaigns (created_at desc) where status = 'approved';
create index signal_campaign_story_order_idx on public.signal_campaign_story_sections (campaign_id, display_order);
create index signal_campaign_sources_order_idx on public.signal_campaign_sources (campaign_id, display_order);
create index signal_campaign_creatives_campaign_idx on public.signal_campaign_creatives (campaign_id, created_at desc);
create index signal_campaign_locations_campaign_idx on public.signal_campaign_locations (campaign_id);
create index signal_campaign_allocations_campaign_idx on public.signal_campaign_channel_allocations (campaign_id);
create index signal_campaign_estimates_campaign_created_idx on public.signal_campaign_reach_estimates (campaign_id, created_at desc);
create index signal_campaign_contributions_campaign_status_idx on public.signal_campaign_contributions (campaign_id, status);
create index signal_campaign_contributions_contributor_created_idx on public.signal_campaign_contributions (contributor_id, created_at desc);
create index signal_campaign_history_campaign_created_idx on public.signal_campaign_status_history (campaign_id, created_at desc);
create index signal_activity_user_created_idx on public.signal_activity_events (user_id, created_at desc);

create function public.signal_guard_campaign_update()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if new.creator_id is distinct from old.creator_id then
      raise exception 'Campaign ownership cannot be changed by a client.' using errcode = '42501';
    end if;
    if new.reviewed_at is distinct from old.reviewed_at
      or new.reviewed_by is distinct from old.reviewed_by
      or new.review_feedback is distinct from old.review_feedback then
      raise exception 'Review fields can only be changed by trusted server code.' using errcode = '42501';
    end if;
    if new.status is distinct from old.status
      and not (old.status = 'draft' and new.status = 'submitted') then
      raise exception 'Only trusted server code may change protected campaign statuses.' using errcode = '42501';
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

create function public.signal_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create function public.signal_record_campaign_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.signal_campaign_status_history (campaign_id, actor_id, from_status, to_status)
  values (new.id, auth.uid(), case when tg_op = 'INSERT' then null else old.status end, new.status);
  return new;
end;
$$;

create function public.signal_check_budget_allocation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  goal_minor bigint;
  already_allocated numeric;
begin
  select funding_goal_minor into goal_minor
  from public.signal_campaigns where id = new.campaign_id for update;

  if goal_minor is null then
    raise exception 'Set a funding goal before allocating channel budgets.' using errcode = '23514';
  end if;

  select coalesce(sum(amount_minor), 0) into already_allocated
  from public.signal_campaign_channel_allocations
  where campaign_id = new.campaign_id and (tg_op = 'INSERT' or id <> new.id);

  if already_allocated + new.amount_minor > goal_minor then
    raise exception 'Channel allocations cannot exceed the campaign funding goal.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.signal_check_campaign_goal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allocated_minor numeric;
begin
  if new.funding_goal_minor is distinct from old.funding_goal_minor then
    select coalesce(sum(amount_minor), 0) into allocated_minor
    from public.signal_campaign_channel_allocations where campaign_id = new.id;
    if new.funding_goal_minor is null and allocated_minor > 0
      or new.funding_goal_minor is not null and allocated_minor > new.funding_goal_minor then
      raise exception 'The funding goal cannot be lower than existing channel allocations.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create function public.signal_recalculate_funding_total(target_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  campaign_currency text;
  succeeded_total numeric;
begin
  select currency into campaign_currency
  from public.signal_campaigns where id = target_campaign_id;
  if campaign_currency is null then
    return;
  end if;

  select coalesce(sum(amount_minor), 0) into succeeded_total
  from public.signal_campaign_contributions
  where campaign_id = target_campaign_id and status = 'succeeded';

  if succeeded_total > 9007199254740991 then
    raise exception 'Succeeded contributions exceed the supported safe-integer aggregate.' using errcode = '22003';
  end if;

  insert into public.signal_campaign_funding_totals (campaign_id, total_minor, currency, updated_at)
  values (target_campaign_id, succeeded_total::bigint, campaign_currency, clock_timestamp())
  on conflict (campaign_id) do update
    set total_minor = excluded.total_minor,
        currency = excluded.currency,
        updated_at = excluded.updated_at;
end;
$$;

create function public.signal_refresh_funding_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.signal_recalculate_funding_total(old.campaign_id);
  end if;
  if tg_op <> 'DELETE' then
    perform public.signal_recalculate_funding_total(new.campaign_id);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger signal_campaigns_guard_update
before update on public.signal_campaigns
for each row execute function public.signal_guard_campaign_update();
create trigger signal_campaigns_status_insert
after insert on public.signal_campaigns
for each row execute function public.signal_record_campaign_status();
create trigger signal_campaigns_status_update
after update of status on public.signal_campaigns
for each row when (old.status is distinct from new.status)
execute function public.signal_record_campaign_status();
create trigger signal_campaigns_goal_check
before update of funding_goal_minor on public.signal_campaigns
for each row execute function public.signal_check_campaign_goal();

create trigger signal_story_updated_at before update on public.signal_campaign_story_sections
for each row execute function public.signal_touch_updated_at();
create trigger signal_creatives_updated_at before update on public.signal_campaign_creatives
for each row execute function public.signal_touch_updated_at();
create trigger signal_audience_updated_at before update on public.signal_campaign_audience_settings
for each row execute function public.signal_touch_updated_at();
create trigger signal_allocations_updated_at before update on public.signal_campaign_channel_allocations
for each row execute function public.signal_touch_updated_at();
create trigger signal_contributions_updated_at before update on public.signal_campaign_contributions
for each row execute function public.signal_touch_updated_at();
create trigger signal_allocations_goal_check
before insert or update on public.signal_campaign_channel_allocations
for each row execute function public.signal_check_budget_allocation();
create trigger signal_contributions_funding_total
after insert or update or delete on public.signal_campaign_contributions
for each row execute function public.signal_refresh_funding_total();

alter table public.signal_campaigns enable row level security;
alter table public.signal_campaign_story_sections enable row level security;
alter table public.signal_campaign_sources enable row level security;
alter table public.signal_campaign_creatives enable row level security;
alter table public.signal_campaign_locations enable row level security;
alter table public.signal_campaign_audience_settings enable row level security;
alter table public.signal_campaign_channel_allocations enable row level security;
alter table public.signal_campaign_reach_estimates enable row level security;
alter table public.signal_campaign_contributions enable row level security;
alter table public.signal_campaign_funding_totals enable row level security;
alter table public.signal_campaign_status_history enable row level security;
alter table public.signal_activity_events enable row level security;

revoke all on public.signal_campaigns, public.signal_campaign_story_sections, public.signal_campaign_sources,
  public.signal_campaign_creatives, public.signal_campaign_locations, public.signal_campaign_audience_settings,
  public.signal_campaign_channel_allocations, public.signal_campaign_reach_estimates,
  public.signal_campaign_contributions, public.signal_campaign_funding_totals,
  public.signal_campaign_status_history, public.signal_activity_events from anon, authenticated;
grant all on public.signal_campaigns, public.signal_campaign_story_sections, public.signal_campaign_sources,
  public.signal_campaign_creatives, public.signal_campaign_locations, public.signal_campaign_audience_settings,
  public.signal_campaign_channel_allocations, public.signal_campaign_reach_estimates,
  public.signal_campaign_contributions, public.signal_campaign_funding_totals,
  public.signal_campaign_status_history, public.signal_activity_events to service_role;

grant select on public.signal_campaigns to anon, authenticated;
grant insert, update, delete on public.signal_campaigns to authenticated;
grant select on public.signal_campaign_story_sections, public.signal_campaign_sources,
  public.signal_campaign_creatives, public.signal_campaign_reach_estimates,
  public.signal_campaign_funding_totals to anon, authenticated;
grant insert, update, delete on public.signal_campaign_story_sections, public.signal_campaign_sources,
  public.signal_campaign_creatives, public.signal_campaign_locations, public.signal_campaign_audience_settings,
  public.signal_campaign_channel_allocations to authenticated;
grant select on public.signal_campaign_locations, public.signal_campaign_audience_settings,
  public.signal_campaign_channel_allocations, public.signal_campaign_contributions,
  public.signal_campaign_status_history, public.signal_activity_events to authenticated;
grant usage on type public.signal_campaign_status, public.signal_contribution_status,
  public.signal_creative_kind, public.signal_distribution_channel to anon, authenticated, service_role;

create policy signal_campaigns_read on public.signal_campaigns
for select to anon, authenticated
using (status = 'approved' or creator_id = (select auth.uid()));
create policy signal_campaigns_insert_draft on public.signal_campaigns
for insert to authenticated
with check (creator_id = (select auth.uid()) and status = 'draft');
create policy signal_campaigns_update_draft on public.signal_campaigns
for update to authenticated
using (creator_id = (select auth.uid()) and status = 'draft')
with check (creator_id = (select auth.uid()) and status in ('draft', 'submitted'));
create policy signal_campaigns_delete_draft on public.signal_campaigns
for delete to authenticated
using (creator_id = (select auth.uid()) and status = 'draft');

create policy signal_story_read on public.signal_campaign_story_sections
for select to anon, authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and (c.creator_id = (select auth.uid()) or c.status = 'approved')));
create policy signal_story_insert_draft on public.signal_campaign_story_sections
for insert to authenticated
with check (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));
create policy signal_story_update_draft on public.signal_campaign_story_sections
for update to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'))
with check (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));
create policy signal_story_delete_draft on public.signal_campaign_story_sections
for delete to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));

create policy signal_sources_read on public.signal_campaign_sources
for select to anon, authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and (c.creator_id = (select auth.uid()) or c.status = 'approved')));
create policy signal_sources_insert_draft on public.signal_campaign_sources
for insert to authenticated
with check (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));
create policy signal_sources_update_draft on public.signal_campaign_sources
for update to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'))
with check (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));
create policy signal_sources_delete_draft on public.signal_campaign_sources
for delete to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));

create policy signal_creatives_read on public.signal_campaign_creatives
for select to anon, authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and ((c.creator_id = (select auth.uid())) or (c.status = 'approved' and is_public))));
create policy signal_creatives_insert_draft on public.signal_campaign_creatives
for insert to authenticated
with check (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));
create policy signal_creatives_update_draft on public.signal_campaign_creatives
for update to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'))
with check (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));
create policy signal_creatives_delete_draft on public.signal_campaign_creatives
for delete to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));

create policy signal_locations_owner_read on public.signal_campaign_locations
for select to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid())));
create policy signal_locations_insert_draft on public.signal_campaign_locations
for insert to authenticated
with check (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));
create policy signal_locations_update_draft on public.signal_campaign_locations
for update to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'))
with check (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));
create policy signal_locations_delete_draft on public.signal_campaign_locations
for delete to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));

create policy signal_audience_owner_read on public.signal_campaign_audience_settings
for select to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid())));
create policy signal_audience_insert_draft on public.signal_campaign_audience_settings
for insert to authenticated
with check (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));
create policy signal_audience_update_draft on public.signal_campaign_audience_settings
for update to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'))
with check (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));
create policy signal_audience_delete_draft on public.signal_campaign_audience_settings
for delete to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));

create policy signal_allocations_owner_read on public.signal_campaign_channel_allocations
for select to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid())));
create policy signal_allocations_insert_draft on public.signal_campaign_channel_allocations
for insert to authenticated
with check (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));
create policy signal_allocations_update_draft on public.signal_campaign_channel_allocations
for update to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'))
with check (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));
create policy signal_allocations_delete_draft on public.signal_campaign_channel_allocations
for delete to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid()) and c.status = 'draft'));

create policy signal_estimates_read on public.signal_campaign_reach_estimates
for select to anon, authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and (c.creator_id = (select auth.uid()) or c.status = 'approved')));

create policy signal_contributions_read_own on public.signal_campaign_contributions
for select to authenticated
using (contributor_id = (select auth.uid()));

create policy signal_funding_totals_read on public.signal_campaign_funding_totals
for select to anon, authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and (c.creator_id = (select auth.uid()) or c.status = 'approved')));

create policy signal_status_history_read_owner on public.signal_campaign_status_history
for select to authenticated
using (exists (select 1 from public.signal_campaigns c where c.id = campaign_id and c.creator_id = (select auth.uid())));

create policy signal_activity_read_owner on public.signal_activity_events
for select to authenticated
using (user_id = (select auth.uid()));

revoke all on function public.signal_guard_campaign_update() from public, anon, authenticated;
revoke all on function public.signal_touch_updated_at() from public, anon, authenticated;
revoke all on function public.signal_record_campaign_status() from public, anon, authenticated;
revoke all on function public.signal_check_budget_allocation() from public, anon, authenticated;
revoke all on function public.signal_check_campaign_goal() from public, anon, authenticated;
revoke all on function public.signal_recalculate_funding_total(uuid) from public, anon, authenticated;
revoke all on function public.signal_refresh_funding_total() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signal-campaign-media', 'signal-campaign-media', false, 20971520, array['image/jpeg', 'image/png', 'image/webp']);

-- Restrictive bucket-specific fences keep pre-existing permissive Storage
-- policies from unintentionally widening access to this new private bucket.
create policy signal_campaign_media_fence_select on storage.objects
as restrictive for select to anon, authenticated
using (bucket_id <> 'signal-campaign-media' or (
  exists (
    select 1 from public.signal_campaign_creatives creative
    join public.signal_campaigns campaign on campaign.id = creative.campaign_id
    where creative.storage_path = name and (
      campaign.creator_id = (select auth.uid())
      or (creative.is_public and campaign.status = 'approved')
    )
  )
));
create policy signal_campaign_media_fence_insert on storage.objects
as restrictive for insert to anon, authenticated
with check (bucket_id <> 'signal-campaign-media' or (
  (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.signal_campaign_creatives creative
    join public.signal_campaigns campaign on campaign.id = creative.campaign_id
    where creative.storage_path = name and campaign.creator_id = (select auth.uid()) and campaign.status = 'draft'
  )
));
create policy signal_campaign_media_fence_update on storage.objects
as restrictive for update to anon, authenticated
using (bucket_id <> 'signal-campaign-media' or (
  (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.signal_campaign_creatives creative
    join public.signal_campaigns campaign on campaign.id = creative.campaign_id
    where creative.storage_path = name and campaign.creator_id = (select auth.uid()) and campaign.status = 'draft'
  )
))
with check (bucket_id <> 'signal-campaign-media' or (
  (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.signal_campaign_creatives creative
    join public.signal_campaigns campaign on campaign.id = creative.campaign_id
    where creative.storage_path = name and campaign.creator_id = (select auth.uid()) and campaign.status = 'draft'
  )
));
create policy signal_campaign_media_fence_delete on storage.objects
as restrictive for delete to anon, authenticated
using (bucket_id <> 'signal-campaign-media' or (
  (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.signal_campaign_creatives creative
    join public.signal_campaigns campaign on campaign.id = creative.campaign_id
    where creative.storage_path = name and campaign.creator_id = (select auth.uid()) and campaign.status = 'draft'
  )
));

create policy signal_campaign_media_owner_read on storage.objects
for select to authenticated
using (
  bucket_id = 'signal-campaign-media'
  and exists (
    select 1 from public.signal_campaign_creatives creative
    join public.signal_campaigns campaign on campaign.id = creative.campaign_id
    where creative.storage_path = name and campaign.creator_id = (select auth.uid())
  )
);
create policy signal_campaign_media_public_read on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'signal-campaign-media'
  and exists (
    select 1 from public.signal_campaign_creatives creative
    join public.signal_campaigns campaign on campaign.id = creative.campaign_id
    where creative.storage_path = name and creative.is_public and campaign.status = 'approved'
  )
);
create policy signal_campaign_media_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'signal-campaign-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.signal_campaign_creatives creative
    join public.signal_campaigns campaign on campaign.id = creative.campaign_id
    where creative.storage_path = name and campaign.creator_id = (select auth.uid()) and campaign.status = 'draft'
  )
);
create policy signal_campaign_media_owner_update on storage.objects
for update to authenticated
using (
  bucket_id = 'signal-campaign-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.signal_campaign_creatives creative
    join public.signal_campaigns campaign on campaign.id = creative.campaign_id
    where creative.storage_path = name and campaign.creator_id = (select auth.uid()) and campaign.status = 'draft'
  )
)
with check (
  bucket_id = 'signal-campaign-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.signal_campaign_creatives creative
    join public.signal_campaigns campaign on campaign.id = creative.campaign_id
    where creative.storage_path = name and campaign.creator_id = (select auth.uid()) and campaign.status = 'draft'
  )
);
create policy signal_campaign_media_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'signal-campaign-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.signal_campaign_creatives creative
    join public.signal_campaigns campaign on campaign.id = creative.campaign_id
    where creative.storage_path = name and campaign.creator_id = (select auth.uid()) and campaign.status = 'draft'
  )
);
