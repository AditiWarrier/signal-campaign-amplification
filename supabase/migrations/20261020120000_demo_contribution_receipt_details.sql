-- Keep demo transaction totals explicit while allowing only an opted-in first name.
alter table public.signal_demo_contributions
  add column if not exists fee_minor bigint not null default 0 check (fee_minor >= 0),
  add column if not exists total_minor bigint not null default 0 check (total_minor >= 0),
  add column if not exists display_first_name text check (display_first_name is null or char_length(display_first_name) between 1 and 40);

update public.signal_demo_contributions
set total_minor = amount_minor
where total_minor = 0;

drop function if exists public.signal_api_create_demo_contribution(text, bigint, text);

create function public.signal_api_create_demo_contribution(
  p_campaign_client_id text,
  p_amount_minor bigint,
  p_idempotency_key text,
  p_display_first_name text default null
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
  cleaned_first_name text := nullif(left(btrim(coalesce(p_display_first_name, '')), 40), '');
begin
  if authenticated_id is null then
    raise exception 'An authenticated account is required.' using errcode = '42501';
  end if;
  if p_amount_minor not between 100 and 100000
    or p_idempotency_key is null
    or char_length(p_idempotency_key) not between 8 and 120
    or (p_display_first_name is not null and (btrim(p_display_first_name) = '' or char_length(p_display_first_name) > 40 or p_display_first_name ~ E'[\\r\\n]')) then
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

  insert into public.signal_demo_contributions (
    campaign_id, contributor_id, amount_minor, fee_minor, total_minor,
    display_first_name, idempotency_key
  ) values (
    target_campaign.id, authenticated_id, p_amount_minor, 0, p_amount_minor,
    cleaned_first_name, p_idempotency_key
  )
  on conflict (contributor_id, campaign_id, idempotency_key) do nothing
  returning * into contribution;
  if contribution.id is null then
    select * into contribution from public.signal_demo_contributions
    where contributor_id = authenticated_id and campaign_id = target_campaign.id and idempotency_key = p_idempotency_key;
    if contribution.campaign_id <> target_campaign.id
      or contribution.amount_minor <> p_amount_minor
      or contribution.display_first_name is distinct from cleaned_first_name then
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
    'feeMinor', contribution.fee_minor,
    'totalMinor', contribution.total_minor,
    'displayFirstName', contribution.display_first_name,
    'currency', contribution.currency,
    'status', 'simulated',
    'idempotencyKey', contribution.idempotency_key,
    'createdAt', contribution.created_at
  );
end;
$$;

revoke all on function public.signal_api_create_demo_contribution(text, bigint, text, text) from public, anon;
grant execute on function public.signal_api_create_demo_contribution(text, bigint, text, text) to authenticated;
