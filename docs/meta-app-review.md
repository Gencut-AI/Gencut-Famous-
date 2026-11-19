# Meta App Review: what to submit for GenCut Famous

Until Meta approves the app, only people with an app role (Instagram Testers who accepted the invite) can connect Instagram. Every beta creator would need a manual invite. App Review with Advanced Access removes that step.

App: **GenCut Famous**, App ID 1103039515839872, business portfolio *gencutai*, login configuration "Instagram API (Unified Login)" (ID 1521964979986064).

## Before submitting

1. **Business verification** for the *gencutai* portfolio (Business settings → Security Center). Advanced Access needs it.
2. **App settings → Basic:** app icon (1024×1024), Privacy Policy URL `https://gencutfamous.netlify.app/privacy`, Terms URL `https://gencutfamous.netlify.app/terms`, User data deletion: *Data deletion callback URL* `https://gencutfamous.netlify.app/api/meta/data-deletion`, App domains `gencutfamous.netlify.app`, category *Business and pages*.
3. **Facebook Login for Business → Settings:** Deauthorize callback URL `https://gencutfamous.netlify.app/api/meta/deauthorize`; Valid OAuth Redirect URI `https://gencutfamous.netlify.app/api/connect/instagram/callback` (already set).
4. A **test account** for the reviewer: a GenCut Famous sign-in they can use (an email inbox they can open, or Google once it is on) and an Instagram professional account with a few posts, added as Instagram Tester and accepted.
5. Make at least one successful call per permission in the last 30 days (the daily sync already does this).

## Permissions and what to write for each

| Permission | What GenCut does with it | Where the reviewer sees it |
| --- | --- | --- |
| `instagram_basic` | Reads the creator's own account (username, profile picture, follower, following and post counts) and their recent posts (caption, link, date, like and comment counts), to build a media kit of their real numbers. | Channels page after connecting; Home; Analytics; the public media kit at /@handle. |
| `instagram_manage_insights` | Reads insights for the creator's own account (reach, views, accounts engaged, interactions) and for their own recent posts, shown with the period and the time they were read. Never estimated, never shared beyond what the creator publishes. | Home (Reach, Views, Accounts engaged), Analytics (per post). |
| `public_profile` | Default. | — |

Suggested wording for both: *"GenCut Famous is a media kit for creators. A creator connects their own Instagram professional account so the app can show their verified audience numbers to brands they choose to share their kit with. We read only the connected account's own profile, posts and insights; we do not post, comment, message or read other accounts. Data is shown with its source, period and time read, and the creator can disconnect and delete it at any time."*

## Screencast (one video, about 2 minutes, English captions or voice-over)

1. Open gencutfamous.netlify.app, sign in, show onboarding (name, handle, 18+).
2. Home → **Connect Instagram** → Meta's dialog: show the permissions screen, approve with the test account.
3. Back on Channels: the account shows as connected. Open Home: followers, reach, views, accounts engaged, top posts, each with "Instagram, as of …".
4. Analytics: per-post numbers.
5. Media kit: choose which numbers to show, **Publish**, open the public /@handle page.
6. Channels → **Disconnect**, then **Delete data**, to show removal.

## After approval

Switch the app from Development to Live. Creators can then connect without an invite. Set `GENCUT_INSTAGRAM_ACCESS=public` in Netlify and redeploy, so the Channels page stops telling people they need an invite.
