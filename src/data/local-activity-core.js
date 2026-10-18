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

module.exports = { recoverArchivedSubmissionEvents, mergeAccountEvents };
