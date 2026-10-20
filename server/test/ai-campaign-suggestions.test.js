const test = require('node:test');
const assert = require('node:assert/strict');
const { createOpenAiCampaignSuggestions } = require('../ai-campaign-suggestions');

test('OpenAI campaign suggestions use a server-side key and parse structured editable fields', async () => {
  let request;
  const suggest = createOpenAiCampaignSuggestions({
    apiKey: 'server-secret-test-key',
    model: 'test-model',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        async json() {
          return { output: [{ content: [{ type: 'output_text', text: JSON.stringify({ title: 'A title', story: 'A story', message: 'A message' }) }] }] };
        },
      };
    },
  });

  assert.deepEqual(await suggest('A campaign idea'), { title: 'A title', story: 'A story', message: 'A message' });
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.Authorization, 'Bearer server-secret-test-key');
  assert.equal(JSON.parse(request.options.body).model, 'test-model');
  assert.equal(JSON.parse(request.options.body).store, false);
});

test('OpenAI campaign suggestions remain unavailable without server configuration', () => {
  assert.equal(createOpenAiCampaignSuggestions({ apiKey: '', model: 'test-model' }), null);
  assert.equal(createOpenAiCampaignSuggestions({ apiKey: 'test-key', model: '' }), null);
});

test('OpenAI campaign suggestions reject malformed output without exposing provider details', async () => {
  const suggest = createOpenAiCampaignSuggestions({
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async () => ({ ok: true, async json() { return { output: [] }; } }),
  });

  await assert.rejects(suggest('A campaign idea'), { code: 'AI_INVALID_RESPONSE' });
});
