# SIGNAL Supabase foundation

The migration in `migrations/` adds the first SIGNAL-owned campaign schema. It has not been applied to any Supabase project. Before applying it, inspect the linked project's migration history, `public` schema, grants, `storage.buckets`, and all policies on `storage.objects`. The migration aborts if its prefixed target tables, enum types, bucket, or policy names already exist; it cannot determine whether existing broad Storage policies are appropriate.

## Apply only after review

Use a non-production project or Supabase branch first. With the Supabase CLI installed and authenticated, link this repository to the intended project, inspect migration status, review the remote schema/policies, and then apply only after approval:

```sh
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase migration list --linked
npx supabase db push
```

The project reference is intentionally not stored here. Do not run `db reset` against a linked or production project. `db push` applies pending migrations, so review the migration and remote state first. The migration is transactional; an error rolls back the changes.

## Data and trust boundaries

- Money is stored as integer minor units with an explicit three-letter ISO-style currency code. Values are bounded to JavaScript's safe integer range because the current app types use `number`.
- `signal_campaign_funding_totals` is a separate succeeded-contribution aggregate. Reach estimates are separate, explicitly illustrative records with versioned assumptions.
- Client access is restricted by RLS and explicit table grants. Owners can manage drafts and submit them. Public reads are limited to approved campaign content, public creatives, estimates, and aggregate funding totals. Review transitions, contributions, aggregate totals, status history writes, and activity writes are reserved for trusted server code.
- Contribution state is not payment verification. A trusted Edge Function/provider webhook must validate provider signatures, deduplicate provider events, and write contribution state using server credentials. Never ship a service-role key to the app.
- Storage uses a private `signal-campaign-media` bucket. The intended object path begins `<creator-user-uuid>/<campaign-uuid>/...`; draft metadata must exist before the upload policy accepts an object. Add metadata only after validating actual file bytes and dimensions in a trusted upload flow. Client MIME/size claims are not a security boundary.
- The private bucket can serve an object only when an owner or approved-public creative metadata row authorizes it. Storage policies include restrictive bucket-specific fences to prevent unrelated permissive policies from widening access. Existing Storage policies still need manual inspection before rollout.
- Creator deletion is restricted while campaigns or review records reference the user; define an account deletion/anonymization workflow before enabling permanent user deletion.

## Current app integration

`src/data/supabase-rest.ts` uses the current public URL/key environment variable names and accepts the existing auth access token. It is a small PostgREST transport helper, not an auth client, session manager, or campaign workflow. Existing fixture-backed screens remain unchanged until a later phase.
