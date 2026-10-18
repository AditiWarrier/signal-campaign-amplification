const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSupabaseCampaigns } = require('../supabase-campaigns');

test('campaign persistence uses the verified user token, stores the complete form, and retrieves account Activity', async () => {
  const calls = [];
  const campaigns = createSupabaseCampaigns({
    url: 'https://project.example.test',
    publishableKey: 'publishable-test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('/rpc/signal_api_save_draft')) return { ok: true, json: async () => ({
        id: 'database-campaign-id', client_id: 'campaign-local-id', creator_id: 'user-1',
        status: 'draft', form_data: { title: 'Save the forest', sections: [{ body: 'Story' }] },
        created_at: '2026-10-18T00:00:00Z', updated_at: '2026-10-18T00:00:00Z',
      }) };
      if (url.includes('/rpc/signal_api_submit_campaign')) return { ok: true, json: async () => ({
        id: 'database-campaign-id', client_id: 'campaign-local-id', creator_id: 'user-1', status: 'submitted',
        form_data: { title: 'Save the forest', sections: [{ body: 'Story' }] },
        created_at: '2026-10-18T00:00:00Z', updated_at: '2026-10-18T00:00:01Z', submitted_at: '2026-10-18T00:00:01Z',
      }) };
      if (url.includes('/signal_activity_events?')) return { ok: true, json: async () => [{
        id: 'event-1', user_id: 'user-1', campaign_id: 'database-campaign-id', event_type: 'campaign.submitted',
        metadata: { campaignTitle: 'Save the forest' }, created_at: '2026-10-18T00:00:01Z',
      }] };
      throw new Error(`Unexpected Supabase request: ${url}`);
    },
  });

  const form = { title: 'Save the forest', creatorName: 'Forest Group', sections: [{ body: 'Story' }] };
  const saved = await campaigns.saveDraft('campaign-local-id', 'user-1', form, 'user-access-token');
  assert.equal(saved.ownerId, 'user-1');
  assert.equal(saved.data.sections[0].body, 'Story');
  const submitted = await campaigns.submitCampaign('campaign-local-id', true, 'user-access-token');
  assert.equal(submitted.status, 'submitted');
  const events = await campaigns.listActivity('user-access-token');
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'campaign.submitted');
  assert.equal(events[0].campaignTitle, 'Save the forest');
  assert.ok(calls.every(({ options }) => options.headers.Authorization === 'Bearer user-access-token'));
  const saveCall = calls.find(({ url }) => url.includes('/rpc/signal_api_save_draft'));
  assert.deepEqual(JSON.parse(saveCall.options.body), { p_client_id: 'campaign-local-id', p_data: form });
  const submitCall = calls.find(({ url }) => url.includes('/rpc/signal_api_submit_campaign'));
  assert.deepEqual(JSON.parse(submitCall.options.body), { p_client_id: 'campaign-local-id', p_policy_accepted: true });
});

test('Supabase campaign storage never reports success when the database request fails', async () => {
  const campaigns = createSupabaseCampaigns({
    url: 'https://project.example.test', publishableKey: 'publishable-test-key',
    fetchImpl: async () => { throw new Error('offline'); },
  });
  await assert.rejects(
    campaigns.saveDraft('local-id', 'user-1', {}, 'user-access-token'),
    /could not be reached/,
  );
});

test('missing Supabase migration objects are reported as schema readiness, not missing campaigns', async () => {
  const campaigns = createSupabaseCampaigns({
    url: 'https://project.example.test', publishableKey: 'publishable-test-key',
    fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({ code: 'PGRST205', message: "Could not find table 'public.signal_campaigns'." }) }),
  });
  await assert.rejects(campaigns.getCampaign('local-id', 'user-access-token'), (error) => {
    assert.equal(error.status, 503);
    assert.equal(error.code, 'CAMPAIGN_SCHEMA_NOT_READY');
    assert.match(error.message, /pending Supabase migrations/);
    return true;
  });
});

test('submission requires a committed non-draft campaign result', async () => {
  const campaigns = createSupabaseCampaigns({
    url: 'https://project.example.test', publishableKey: 'publishable-test-key',
    fetchImpl: async () => ({ ok: true, json: async () => null }),
  });
  await assert.rejects(campaigns.submitCampaign('local-id', true, 'user-access-token'), (error) => {
    assert.equal(error.status, 502);
    assert.equal(error.code, 'SUBMISSION_UNCONFIRMED');
    return true;
  });
});
