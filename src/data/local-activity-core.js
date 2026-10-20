function recoverArchivedSubmissionEvents(currentEvents, submissions, campaignsById, recoveredAt) {
  const knownIds = new Set(currentEvents.map((event) => event.id));
  const recovered = [];
  for (const submission of submissions) {
    const id = `local:campaign.submitted:${submission.id}`;
    if (knownIds.has(id)) continue;
    const campaign = campaignsById[submission.id];
    if (!campaign || campaign.localStatus !== 'submitted_locally') continue;
    recovered.push({
      id,
      eventType: 'campaign.submitted',
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      createdAt: submission.submittedAt || recoveredAt,
      metadata: {
        recoveredFromSavedSubmission: true,
        ...(submission.anonymousLegacy ? { recoveredFromAnonymousDevice: true } : {}),
      },
    });
    knownIds.add(id);
  }
  return [...recovered, ...currentEvents];
}

function mergeAccountEvents(localEvents, apiEvents) {
  const merged = new Map();
  for (const event of [...localEvents, ...apiEvents]) {
    const key = event.eventType === 'campaign.submitted' && event.campaignId
      ? `${event.eventType}:${event.campaignId}`
      : event.eventType === 'contribution.simulated' && event.actionId
        ? `${event.eventType}:${event.actionId}`
        : `${event.source}:${event.id}`;
    const previous = merged.get(key);
    if (!previous || event.source === 'api') merged.set(key, event);
  }
  return [...merged.values()];
}

function filterActivityEvents(events, category) {
  if (category === 'All' || category === 'Account') return [...events];
  if (category === 'Contributions') {
    return events.filter((event) => event.kind === 'account-contribution' || event.eventType === 'contribution.simulated');
  }
  return [];
}

function filterActivityNotifications(notifications, category) {
  if (category === 'Contributions') return [];
  return notifications.filter((item) => category === 'All' || item.category === category);
}

function recoverArchivedContributionEvents(currentEvents, contributionsByCampaign, recoveredAt) {
  const knownIds = new Set(currentEvents.map((event) => event.metadata?.contributionId || event.id));
  const recovered = [];
  for (const { campaignId, campaignTitle, records } of contributionsByCampaign) {
    if (!Array.isArray(records)) continue;
    for (const record of records) {
      if (!record || record.status !== 'simulated' || !record.id) continue;
      const id = `local:contribution:${record.id}`;
      if (knownIds.has(record.id) || knownIds.has(id)) continue;
      recovered.push({
        id,
        eventType: 'contribution.simulated',
        campaignId,
        campaignTitle: campaignTitle || 'Campaign',
        createdAt: record.createdAt || recoveredAt,
        metadata: {
          contributionId: record.id,
          amountMinor: record.amountMinor,
          currency: record.currency || 'USD',
          idempotencyKey: record.idempotencyKey,
          displayFirstName: record.displayFirstName,
          showFirstName: record.showFirstName,
          recoveredFromSavedLedger: true,
        },
      });
      knownIds.add(record.id);
      knownIds.add(id);
    }
  }
  return [...recovered, ...currentEvents];
}

module.exports = {
  recoverArchivedSubmissionEvents,
  recoverArchivedContributionEvents,
  mergeAccountEvents,
  filterActivityEvents,
  filterActivityNotifications,
};
