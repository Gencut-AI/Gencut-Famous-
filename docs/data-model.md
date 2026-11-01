# Data model

Source of truth: `packages/db/migrations/*.up.sql`. RLS is on for every table with no policies (D-003).

| Table | What it holds |
| --- | --- |
| `workspaces`, `users`, `memberships` | One workspace per creator; roles `owner` (exactly one) and `manager`. |
| `invitations` | Manager invitations: email, token hash, expiry, accepted / revoked. |
| `audit_events` | Append-only log (trigger), with interface; deleted only with its workspace. |
| `consents` | Exact disclosure text and version agreed to by inquiry senders. |
| `model_runs` | Every model call: role, purpose, provider, model, tokens, cost, latency, status. Never prompts. |
| `creator_profiles` | Brand profile; `handle` unique and validated; private fields (legal name, rate card, brands avoided); 18+ attestation. |
| `creator_partnerships` | Self-reported partnerships (`source = 'self_reported'` enforced). |
| `media_assets` | Logo, profile photo (one current each), content examples; images ≤ 5 MB in Postgres. |
| `creator_channels` | Connected accounts: platform, external id, username, account type, granted scopes, sync status, auth error, revoked. One active connection per platform account across all workspaces. |
| `channel_credentials` | AES-256-GCM token ciphertext, nonce, key id, expiry. Deleted on disconnect. |
| `creator_content` | Posts as the platform lists them; `shown_on_profile`. |
| `creator_metric_snapshots` | Dated readings (see D-005); `value` NULL unless `available`. Unique per channel, post, metric, period kind and day. |
| `deletion_requests` | Platform data-deletion requests: confirmation code, counts. No personal data. |
| `profile_pages` | Publish state, headline, work-with-me text, inquiry form on/off, metrics to show. |
| `profile_visits` | One row per visitor per day: day, `src`, referring host, one-way hash. |
| `creator_inquiries` | Inquiries with consent id, `src`, sender hash (rate limits), status. |
| `referral_codes` | One join code per creator (their handle at sign-up, never changed). |
| `referral_visits` | Join-page visits, once per visitor per day: day, `src`, one-way hash. |
| `referral_leads` | People who left details on a join page: name, email (staff only), handle, role, consent, `src`, joined workspace. |
| `workspaces.referred_by_workspace_id` | The creator whose link a new workspace came through, with `referred_at`. |
