# SIGNAL

**Give community-led campaigns a clearer path to being seen.**

SIGNAL is a mobile-first campaign amplification platform concept. It is
designed to help campaign creators tell a sourced story, define who they
want to reach, and plan how a campaign could be amplified across social
channels. Supporters can explore campaigns and follow a
contribution-style demo journey, while creators can manage drafts and
submit campaigns for review.

> **Project status:** Hackathon/reviewer-facing prototype.
> Authentication and campaign data are connected to Supabase. The
> contribution journey is simulated: no real payment is collected, and
> no advertising campaign is launched on Instagram or Facebook.

------------------------------------------------------------------------

## Live demo and downloads

-   **Web app:** [Open
    SIGNAL](https://signal-campaign-amplification-1.onrender.com)
-   **Android APK:** [Download SIGNAL from Google
    Drive](https://drive.google.com/drive/folders/1Mwv8AlyYfyBJI6PsDydkenB7ZoIJzw00?usp=sharing)
-   **Backend API:** [SIGNAL
    API](https://signal-campaign-amplification.onrender.com)
-   **API health check:** [Check API
    status](https://signal-campaign-amplification.onrender.com/api/health)

The Android APK is distributed through the linked Google Drive folder.
The web app is hosted separately from the backend API.

------------------------------------------------------------------------

## What SIGNAL is trying to solve

Community initiatives can have meaningful stories but limited reach.
SIGNAL explores a workflow that makes campaign information, supporting
sources, intended audience, distribution choices, and funding targets
easier to understand in one place.

The platform is built around three ideas:

-   **Story and sources:** present a campaign narrative alongside links
    to supporting sources.
-   **Intentional reach:** describe target locations, audience settings,
    and intended distribution channels.
-   **Visibility and accountability:** make campaign status, funding
    goals, allocations, and activity easier to follow.

## Features

### Campaign discovery

-   Explore campaign listings and open individual campaign pages.
-   View campaign stories, supporting source links, target information,
    and funding details.
-   Browse featured campaign content and community impact sections on
    the home screen.

### Campaign creation

-   Create and edit multi-step campaign drafts.
-   Add campaign details, story sections, and source links.
-   Configure target locations, audience settings, campaign duration,
    and Instagram/Facebook channel allocations.
-   Prepare campaign creative details and preview the campaign before
    submission.
-   Save drafts and submit campaigns to the API review workflow.

### Accounts and creator experience

-   Register and sign in with email and password using Supabase Auth.
-   Store the signed-in session using platform-specific session storage.
-   View profile and creator-facing campaign information.
-   Access an activity feed backed by the SIGNAL API.

### Contribution demonstration

-   Walk through contribution review, simulated checkout, processing,
    result, receipt, and tracking screens.
-   Record clearly labelled demo contributions for supported campaigns.
-   Use idempotency keys to avoid duplicate demo contribution records.

**Important:** The backend explicitly returns
`501 PAYMENTS_NOT_CONFIGURED` for the real contribution endpoint. The
demo contribution endpoint records simulated transactions only. No
payment provider is contacted and no real money is transferred.

### AI-assisted campaign writing

-   Request suggested campaign title, story, and message text from the
    backend.
-   The optional server-side integration uses the OpenAI API when
    configured.

AI suggestions are optional and require a server-side API key. The key
must never be exposed through an `EXPO_PUBLIC_` variable.

------------------------------------------------------------------------

## Technology

  ---------------------------------------------------------------------
  Area                               Technologies
  ---------------------------------- ----------------------------------
  Mobile and web client              React Native, Expo SDK 57, React
                                     19

  Language                           TypeScript and JavaScript

  Navigation                         Expo Router

  Backend                            Node.js, Express 5

  Authentication                     Supabase Auth

  Database and campaign persistence  Supabase / PostgreSQL

  Session storage                    Expo SecureStore on native;
                                     web-specific storage
                                     implementation

  Optional AI suggestions            OpenAI API

  Tests                              Node.js built-in test runner
  ---------------------------------------------------------------------

## Architecture

``` mermaid
flowchart TD
    U["SIGNAL client<br/>Expo · React Native · Expo Router"]
    A["Supabase Auth<br/>Email and password"]
    API["SIGNAL API<br/>Node.js · Express"]
    DB[("Supabase PostgreSQL<br/>Campaigns · drafts · activity")]
    AI["Optional AI suggestions<br/>OpenAI API"]
    DEMO["Simulated contribution flow<br/>No payment provider"]

    U -->|"Sign up / sign in"| A
    U -->|"Bearer access token · REST"| API
    API -->|"Verify user and access data"| A
    API -->|"Campaign and activity operations"| DB
    API -->|"Optional suggestion request"| AI
    U -->|"Demo contribution journey"| API
    API --> DEMO
```

The API verifies authenticated requests and uses the signed-in user's
access token when interacting with Supabase. Campaign records and
authenticated activity are served through the Supabase-backed campaign
layer. A local JSON store remains in the backend for simulated
contribution fixtures; it is not the primary campaign database.

------------------------------------------------------------------------

## Getting started

### Requirements

-   Node.js and npm
-   A Supabase project
-   Expo-compatible development environment (Expo Go or a development
    build)
-   Android Studio / Android SDK for local Android builds, if required

### 1. Clone and install

``` bash
git clone https://github.com/AditiWarrier/signal-campaign-amplification.git
cd signal-campaign-amplification
npm install
```

### 2. Configure environment variables

Create a local `.env` file in the project root. Use `.env.example` as
the starting point:

``` env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
# Local development: use this while the API is running on your machine.
EXPO_PUBLIC_SIGNAL_API_URL=http://localhost:4000

# For the deployed app, use:
# EXPO_PUBLIC_SIGNAL_API_URL=https://signal-campaign-amplification.onrender.com

# Optional: server-side AI campaign suggestions
SIGNAL_OPENAI_API_KEY=
SIGNAL_OPENAI_MODEL=gpt-4.1-mini
```

The frontend variables prefixed with `EXPO_PUBLIC_` are bundled into the
client and must contain only values intended to be public, such as the
Supabase project URL and publishable key. Never put a Supabase
service-role key, private API key, or other secret in an `EXPO_PUBLIC_`
variable.

For local development, keep the API URL at `http://localhost:4000` while
running the backend locally. For a deployed build or the hosted web app,
set it to `https://signal-campaign-amplification.onrender.com` so the
client calls the Render API.

The backend can also read `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
If both frontend and backend Supabase values are supplied, the backend
checks that they refer to the same project and publishable key.

### 3. Set up Supabase

The repository includes SQL migrations under `supabase/migrations/`.
Apply them to the Supabase project in migration order using the Supabase
CLI or your project's SQL migration workflow.

The migrations create the SIGNAL campaign schema and supporting database
objects, including campaign stories, sources, creatives, audience
settings, channel allocations, contribution records, and activity
events.

Review the migration SQL and the target project's existing schema before
applying migrations. The first migration intentionally stops if target
objects already exist; it is not designed to silently overwrite an
existing schema.

### 4. Start the API

From the repository root:

``` bash
npm run api:start
```

The API listens on port `4000` by default. It uses `PORT` or
`SIGNAL_API_PORT` if configured.

Check the local API:

``` text
GET http://localhost:4000/
GET http://localhost:4000/api/health
```

### Deployed services

-   **Hosted API:** <https://signal-campaign-amplification.onrender.com>
-   **API health check:**
    <https://signal-campaign-amplification.onrender.com/api/health>

The hosted frontend should be configured with
`EXPO_PUBLIC_SIGNAL_API_URL=https://signal-campaign-amplification.onrender.com`.
Use this URL for client builds intended to communicate with the deployed
backend.

The health response reports whether authentication and Supabase campaign
persistence are configured.

### 5. Start the Expo app

In a separate terminal:

``` bash
npx expo start
```

Then open the project in an available Expo development environment.

Useful platform commands:

``` bash
npm run android
npm run ios
npm run web
```

For a static web export:

``` bash
npx expo export --platform web
```

The static export is written to `dist/`.

------------------------------------------------------------------------

## API overview

All `/api` routes below are served by the Express application. Routes
marked **authenticated** require a valid bearer access token.

  ------------------------------------------------------------------------------
  Method              Endpoint                             Purpose
  ------------------- ------------------------------------ ---------------------
  `GET`               `/`                                  API root/status
                                                           response

  `GET`               `/api/health`                        Authentication and
                                                           persistence
                                                           configuration status

  `POST`              `/api/auth/signup`                   Create an account

  `POST`              `/api/auth/login`                    Sign in

  `GET`               `/api/auth/me`                       Return the
                                                           authenticated user

  `GET`               `/api/campaigns`                     List campaigns
                                                           (**authenticated**)

  `POST`              `/api/campaigns`                     Create/save a
                                                           campaign draft
                                                           (**authenticated**)

  `POST`              `/api/campaigns/ai-suggestions`      Generate campaign
                                                           writing suggestions
                                                           (**authenticated**,
                                                           optional AI
                                                           configuration)

  `GET`               `/api/campaigns/:id`                 Retrieve a campaign
                                                           (**authenticated**)

  `PATCH`             `/api/campaigns/:id`                 Update a campaign
                                                           (**authenticated**)

  `DELETE`            `/api/campaigns/:id`                 Delete a campaign
                                                           (**authenticated**)

  `GET`               `/api/campaigns/:id/contributions`   List campaign
                                                           contribution records
                                                           (**authenticated**)

  `POST`              `/api/campaigns/:id/submit`          Submit a campaign for
                                                           review
                                                           (**authenticated**)

  `GET`               `/api/drafts`                        List the signed-in
                                                           user's drafts
                                                           (**authenticated**)

  `POST`              `/api/drafts`                        Create a draft
                                                           (**authenticated**)

  `GET`               `/api/drafts/:id`                    Retrieve a draft
                                                           (**authenticated**)

  `PUT`               `/api/drafts/:id`                    Replace/update a
                                                           draft
                                                           (**authenticated**)

  `PATCH`             `/api/drafts/:id`                    Partially update a
                                                           draft
                                                           (**authenticated**)

  `POST`              `/api/reviews/:campaignId/status`    Update review status
                                                           (**reviewer/admin
                                                           role required**)

  `POST`              `/api/contributions`                 Real payment
                                                           endpoint; currently
                                                           not configured

  `POST`              `/api/demo/contributions`            Record a simulated
                                                           contribution
                                                           (**authenticated**)

  `GET`               `/api/activity`                      Retrieve
                                                           authenticated
                                                           activity
                                                           (**authenticated**)

  `GET`               `/api/reports`                       Retrieve report
                                                           summary
                                                           (**authenticated**)

  `GET`               `/api/reports/campaigns/:id`         Retrieve a campaign
                                                           report
                                                           (**authenticated**)
  ------------------------------------------------------------------------------

The API validates campaign fields, supported categories and channels,
funding allocations, source URLs, and submission requirements. It also
supports idempotency keys for demo contribution records.

------------------------------------------------------------------------

## Tests

Run the backend/API test suite with:

``` bash
npm run api:test
```

The tests use Node's built-in test runner and are located in
`server/test/`.

Run the Expo lint command with:

``` bash
npm run lint
```

------------------------------------------------------------------------

## Repository layout

``` text
.
├── assets/
│   └── images/                 # App, campaign, and story imagery
├── scripts/                    # Project scripts
├── server/
│   ├── app.js                  # Express routes, validation, and API handlers
│   ├── auth.js                 # Supabase authentication integration
│   ├── env.js                  # Project environment loading
│   ├── index.js                # API entry point
│   ├── store.js                # Local JSON store for demo fixtures
│   ├── supabase-campaigns.js   # Supabase campaign persistence
│   └── test/                   # API and service tests
├── src/
│   ├── app/                    # Expo Router screens and route layouts
│   ├── auth/                   # Auth context, Supabase auth, session storage
│   ├── components/             # Reusable UI and feature components
│   ├── data/                   # API clients, campaign data, and local flows
│   ├── hooks/                  # Shared React hooks
│   └── types/                  # TypeScript data types
└── supabase/
    └── migrations/             # Database schema migrations
```

------------------------------------------------------------------------

## Current scope and limitations

SIGNAL is a prototype intended to demonstrate a campaign workflow and
its supporting application architecture. The following boundaries are
important:

-   **Payments:** real payment processing is not configured.
    Contribution screens and records are simulated.
-   **Ad delivery:** selecting Instagram or Facebook describes the
    intended distribution channel. The repository does not integrate
    with Meta's advertising APIs or launch live ads.
-   **Campaign review:** the API includes a reviewer/admin status
    workflow. A complete production moderation operation and reviewer
    console should not be assumed from the presence of these endpoints.
-   **AI writing assistance:** suggestions depend on optional
    server-side OpenAI configuration and network availability.
-   **Production readiness:** deployment, payment compliance, moderation
    operations, monitoring, and security review would be required before
    handling real funds or operating as a live advertising platform.

## Security notes

-   Keep `.env` out of version control.
-   Use only a Supabase publishable key in the client.
-   Keep private keys and the optional OpenAI API key on the server.
-   Authenticated API calls use bearer access tokens.
-   Review Supabase Row Level Security policies and storage policies
    before deploying to a production project.

## License

This repository currently includes the MIT License file. See
[`LICENSE`](./LICENSE) for its terms.

