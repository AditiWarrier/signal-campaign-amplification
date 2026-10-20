const path = require('node:path');
const { loadProjectEnv } = require('./env');
const { createSupabaseAuth } = require('./auth');
const { createApp, AUTH_DIAGNOSTIC_CONTRACT } = require('./app');
const { JsonStore } = require('./store');
const { createSupabaseCampaigns } = require('./supabase-campaigns');
const { createOpenAiCampaignSuggestions } = require('./ai-campaign-suggestions');

loadProjectEnv();

const projectRoot = path.resolve(__dirname, '..');
const port = Number(process.env.SIGNAL_API_PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SIGNAL_API_PORT must be a valid TCP port.');

const frontendSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const backendSupabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
if (frontendSupabaseUrl && backendSupabaseUrl && new URL(frontendSupabaseUrl).origin !== new URL(backendSupabaseUrl).origin) {
  throw new Error('SUPABASE_URL must match EXPO_PUBLIC_SUPABASE_URL so frontend access tokens are verified against their issuing project.');
}
const frontendPublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const backendPublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (frontendPublishableKey && backendPublishableKey && frontendPublishableKey !== backendPublishableKey) {
  throw new Error('SUPABASE_PUBLISHABLE_KEY must match EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY so frontend access tokens are verified by the same project.');
}
const supabaseUrl = frontendSupabaseUrl || backendSupabaseUrl;
const publishableKey = frontendPublishableKey || backendPublishableKey;

const auth = createSupabaseAuth({
  url: supabaseUrl,
  publishableKey,
});
const campaigns = createSupabaseCampaigns({
  url: supabaseUrl,
  publishableKey,
});
// This file store remains for simulated contribution fixtures only. Campaigns
// and authenticated account Activity are served from Supabase.
const store = new JsonStore(process.env.SIGNAL_DATA_FILE || path.resolve(projectRoot, '.data', 'signal-api.json'));
const aiSuggestions = createOpenAiCampaignSuggestions();
const app = createApp({ store, campaigns, auth, aiSuggestions });

app.listen(port, '0.0.0.0', () => {
  process.stdout.write(`SIGNAL API listening on port ${port}; pid: ${process.pid}; campaign storage driver: ${campaigns.configured ? 'supabase' : 'unconfigured'}; auth contract: ${AUTH_DIAGNOSTIC_CONTRACT}; entrypoint: ${__filename}; app module: ${require.resolve('./app')}; cwd: ${process.cwd()}\n`);
});
