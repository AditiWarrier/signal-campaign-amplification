function createSupabaseCampaigns({ url, publishableKey, fetchImpl = fetch }) {
  const baseUrl = url?.replace(/\/$/, '');
  const configured = Boolean(baseUrl && publishableKey);

  async function request(path, accessToken, options = {}) {
    if (!configured) {
      const error = new Error('Supabase campaign storage is not configured on this backend.');
      error.status = 503;
      throw error;
    }
    if (!accessToken) {
      const error = new Error('An authenticated Supabase session is required.');
      error.status = 401;
      throw error;
    }
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/rest/v1/${path}`, {
        ...options,
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
      });
    } catch {
      const error = new Error('Supabase campaign storage could not be reached.');
      error.status = 502;
      throw error;
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const missingSchemaObject = result?.code === 'PGRST202' || result?.code === 'PGRST205';
      const rateLimited = response.status === 429;
      const message = missingSchemaObject
        ? 'Campaign storage is not ready. Apply the pending Supabase migrations.'
        : rateLimited
          ? (typeof result?.message === 'string' ? result.message : typeof result?.msg === 'string' ? result.msg : 'Supabase rate limit reached.')
        : response.status === 404
          ? 'Campaign was not found.'
        : response.status === 400 || response.status === 409
          ? (typeof result?.message === 'string' ? result.message : 'Supabase rejected the campaign request.')
          : 'Supabase could not complete the campaign request.';
      const error = new Error(message);
      error.status = missingSchemaObject ? 503 : rateLimited || [400, 401, 403, 404, 409].includes(response.status) ? response.status : 502;
      if (missingSchemaObject) error.code = 'CAMPAIGN_SCHEMA_NOT_READY';
      else if (rateLimited) error.code = typeof result?.code === 'string' ? result.code : 'SUPABASE_RATE_LIMITED';
      if (rateLimited) error.retryAfter = response.headers?.get('Retry-After') || null;
      throw error;
    }
    return result;
  }

  function rpc(name, accessToken, body) {
    return request(`rpc/${name}`, accessToken, { method: 'POST', body: JSON.stringify(body) });
  }

  function row(result) {
    return Array.isArray(result) ? result[0] : result;
  }

  function asCampaign(row) {
    if (!row) return null;
    return {
      id: row.client_id || row.id,
      databaseId: row.id,
      ownerId: row.creator_id,
      status: row.status,
      data: row.form_data || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at,
      review: row.status === 'draft' ? null : { status: row.status, reviewerId: row.reviewed_by, feedback: row.review_feedback || '', reviewedAt: row.reviewed_at },
    };
  }

  async function getCampaign(clientId, accessToken) {
    const query = new URLSearchParams({ select: '*', client_id: `eq.${clientId}`, limit: '1' });
    const rows = await request(`signal_campaigns?${query}`, accessToken);
    return asCampaign(rows?.[0]);
  }

  return {
    configured,
    async saveDraft(clientId, creatorId, data, accessToken) {
      const result = row(await rpc('signal_api_save_draft', accessToken, { p_client_id: clientId, p_data: data }));
      if (result?.creator_id !== creatorId) {
        const error = new Error('Supabase did not confirm campaign ownership.');
        error.status = 502;
        throw error;
      }
      return asCampaign(result);
    },
    getCampaign,
    async listCampaigns(accessToken, ownerId, mine = false) {
      const query = new URLSearchParams({ select: '*', order: 'updated_at.desc', limit: '200' });
      if (mine) query.set('creator_id', `eq.${ownerId}`);
      const rows = await request(`signal_campaigns?${query}`, accessToken);
      return (rows || []).map(asCampaign);
    },
    async submitCampaign(clientId, policyAccepted, accessToken) {
      const result = row(await rpc('signal_api_submit_campaign', accessToken, { p_client_id: clientId, p_policy_accepted: policyAccepted }));
      const campaign = asCampaign(result);
      if (!campaign || !['submitted', 'under_review', 'approved', 'rejected', 'completed'].includes(campaign.status)) {
        const error = new Error('Supabase did not confirm that the campaign was submitted.');
        error.status = 502;
        error.code = 'SUBMISSION_UNCONFIRMED';
        throw error;
      }
      return campaign;
    },
    async deleteDraft(clientId, accessToken) {
      await request(`signal_campaigns?${new URLSearchParams({ client_id: `eq.${clientId}`, status: 'eq.draft' })}`, accessToken, { method: 'DELETE' });
    },
    async reviewCampaign(clientId, status, feedback, accessToken) {
      const result = row(await rpc('signal_api_review_campaign', accessToken, { p_client_id: clientId, p_status: status, p_feedback: feedback }));
      return asCampaign(result);
    },
    async createDemoContribution(campaignId, amountMinor, idempotencyKey, accessToken) {
      return rpc('signal_api_create_demo_contribution', accessToken, {
        p_campaign_client_id: campaignId,
        p_amount_minor: amountMinor,
        p_idempotency_key: idempotencyKey,
      });
    },
    async listDemoContributions(campaignId, contributorId, accessToken) {
      if (campaignId) {
        const campaign = await getCampaign(campaignId, accessToken);
        if (!campaign) return [];
        const query = new URLSearchParams({ select: '*', campaign_id: `eq.${campaign.databaseId}`, order: 'created_at.desc' });
        const rows = await request(`signal_demo_contributions?${query}`, accessToken);
        return (rows || []).map((row) => ({ ...asDemoContribution(row), campaignId }));
      }
      const query = new URLSearchParams({ select: '*,campaign:signal_campaigns(client_id)', contributor_id: `eq.${contributorId}`, order: 'created_at.desc' });
      const rows = await request(`signal_demo_contributions?${query}`, accessToken);
      return (rows || []).map(asDemoContribution);
    },
    async listActivity(accessToken) {
      const query = new URLSearchParams({ select: 'id,user_id,campaign_id,event_type,metadata,created_at', order: 'created_at.desc', limit: '200' });
      const events = await request(`signal_activity_events?${query}`, accessToken);
      return (events || []).map((event) => ({
        id: event.id,
        userId: event.user_id,
        campaignId: event.metadata?.campaignClientId || event.campaign_id,
        eventType: event.event_type,
        metadata: event.metadata || {},
        campaignTitle: event.metadata?.campaignTitle || null,
        createdAt: event.created_at,
      }));
    },
  };
}

function asDemoContribution(row) {
  return {
    id: row.id,
    campaignId: row.client_id || row.campaign?.client_id || row.campaign_id,
    contributorId: row.contributor_id,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    status: 'simulated',
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  };
}

module.exports = { createSupabaseCampaigns };
