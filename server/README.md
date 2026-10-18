# SIGNAL API

The API verifies sessions against the existing Supabase Auth project. Submitted campaigns, account Activity, reviewer updates, and simulated contribution records use Supabase Postgres through PostgREST with the caller's verified access token. Row Level Security remains active. Device storage is retained for offline drafts and recovery; the app only marks a submission synced after the database confirms it.

## Configure and run

The server reads `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, falling back to the existing `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` values in the project `.env`. No service-role credential is used. The server forwards the already verified user's bearer token to PostgREST so database authorization is evaluated for that account.

Before running the API against the project, inspect its existing schema and migration history, then apply these migrations in order in the Supabase SQL Editor:

1. `supabase/migrations/20261018090000_signal_campaign_foundation.sql`
2. `supabase/migrations/20261018103000_campaign_api_storage.sql`

The foundation migration intentionally aborts when target objects already exist. Reconcile with any existing project objects rather than rerunning it blindly. Start the API with `npm run api:start` and tests with `npm run api:test`. Configure `EXPO_PUBLIC_SIGNAL_API_URL` to the Express API origin. On a physical phone, use an address reachable from the phone; `localhost` means the phone itself. If Supabase configuration or the database is unavailable, campaign API requests fail clearly and the Create flow keeps the device draft marked as unsynced.

Optional settings are `SIGNAL_API_PORT` (default `4000`), `SIGNAL_CORS_ORIGIN` (default `*` for local preview), and `SIGNAL_DATA_FILE` (legacy JSON store path; campaign and Activity routes in the production entry point do not use it).

## Authentication and access

`POST /api/auth/signup` and `POST /api/auth/login` proxy to Supabase Auth. Protected routes require `Authorization: Bearer <Supabase access token>`. The API validates this token with Supabase Auth and derives its user ID and reviewer role from the returned user; request-supplied owner IDs and editable user metadata roles are not trusted. Database RPCs independently require `auth.uid()` and restrict draft edits to the owner. RLS permits campaign reads only for the creator or for approved public campaigns; Activity reads are scoped to the authenticated account.

## Routes

| Group | Routes | Access |
| --- | --- | --- |
| Auth | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` | Supabase Auth; `/me` requires a verified session |
| Campaigns | `GET/POST /api/campaigns`, `GET/PATCH/DELETE /api/campaigns/:id`, `POST /api/campaigns/:id/submit` | Authenticated; RLS limits records by owner/public visibility; only drafts can be edited/deleted |
| Drafts | `GET/POST /api/drafts`, `GET/PATCH/PUT /api/drafts/:id` | Authenticated owner only; `PUT` upserts the local client ID for Create flow sync |
| Review | `POST /api/reviews/:campaignId/status` | Verified reviewer/admin only; database role check and allowed transitions |
| Contributions | `GET /api/campaigns/:id/contributions`, `POST /api/demo/contributions`, `POST /api/contributions` | Simulated records only; duplicate idempotency keys do not double count; real payments return 501 |
| Activity | `GET /api/activity` | Supabase returns the authenticated account's events |
| Reports | `GET /api/reports`, `GET /api/reports/campaigns/:id` | Authenticated; private campaign reports require owner or reviewer/admin |

Campaign submission and its `campaign.submitted` Activity event are committed together in a database function. The event has a unique owner/dedupe key and stores the local campaign ID for matching on-device and server copies. Reviewer outcomes and simulated contribution events are also account-scoped. Simulated contributions use `signal_demo_contributions`, remain separate from verified payment totals, and do not enable payment processing or advertising delivery.

## Verification limits

Automated adapter/API tests use test tokens and mocked Supabase responses; they do not prove live project migration compatibility, live RLS behavior, or cross-device behavior. The migrations have not been applied or verified against the linked Supabase project from this workspace. The actual cross-device demo requires the dashboard migration step above and a reachable Express API host configured in the Expo app.
