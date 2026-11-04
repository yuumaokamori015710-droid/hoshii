# HOSHII live

The existing Site remains owner-private. The Vinext Worker serves the dashboard and same-origin API; D1 stores official campaigns, wishes, bookmarks, application marks, notifications, source checks, and push subscriptions. Real applications happen only at the official destination. Application marks are user-managed.

## Official sources

- Kirin: https://www.kirin.co.jp/campaign/alcohol/ — the official renderer references the public JSONP index https://campaign.kirin.co.jp/campaign/json/campaign.json . JSONP is parsed as data and never executed. `start`/`end` are Japan time; unpublished, upcoming, and expired records are excluded.
- FamilyMart: https://www.family.co.jp/campaign.html — official campaign cards. Only relevant giveaway/free-coupon entries are included. Purchase conditions without explicit evidence remain unknown.
- Panasonic: https://panasonic.jp/membership/guide/campaign.html — current official giveaway entries. Coin rewards are classified as coin rewards, not as the appliances discussed by the quiz.

- QUO Card: https://www.quocard.com/individual/campaign/ — the issuer's official listings. Lottery campaigns link to the organizer's page. Unknown deadlines remain null, and removal from the official list removes a record from discovery. A small set of manually verified organizer terms provides dates and eligibility; these are identified in evidence, not inferred from image filenames.
- Starbucks: https://stories.starbucks.co.jp/press/2026/pr-2026-1027/ — extracts the active eGift campaign's prize, recipient eligibility and application range from the official release. The sender is not the prize entrant. Also reads https://stories.starbucks.co.jp/press/2026/pr-2026-1026-2/ for the 3,000-yen holiday bingo ticket lottery, with purchase and membership requirements and the separate bingo/draw deadlines.

No third-party directory is used. Campaign images are HTTPS assets referenced by these official publishers, restricted to known publisher hosts. The image source URL is stored and shown on cards and details; images are displayed without cropping and loaded directly from the publisher, without copying files. Kirin records with Copyprotection=true do not display the asset. Missing or failed images show an official-page confirmation message. This is source attribution, not a claim of an image license; reuse terms must be confirmed before widening this owner-private Site's audience. Fields not established by the source remain null and are labeled for official confirmation. An official listing is not a guarantee that the organizer's application system is available. Source errors retain the prior records; expired records and records not seen for 48 hours are omitted from discovery. A structural parse failure is reported rather than replacing the database with an empty result.

## Unattended update contract

`GET /api/automation/instructions` returns the current updater contract. `POST /api/refresh` reads all official sources, upserts and expires records, creates only previously unseen matches, then attempts pending Web Push delivery. It is shared data and may be called through the Site's supported service access. This assumes the Site's existing owner-private audience. Do not widen the audience without adding explicit updater authorization.

A future Site-linked cloud task can call `get_site` for this Site, obtain its supported service access, then call the above paths with `OAI-Sites-Authorization: Bearer <returned token>`. Never save or print that token. No visitor identity or app connector consent is implied by service access. Visitor-owned API operations separately require `oai-authenticated-user-id` and scope all reads and writes to it. Mutations reject cross-origin browser requests.

## Notification behavior

Adding a wish backfills site-only `existing` matches. Only campaigns first discovered after the wish generate `new` matches eligible for Web Push. A unique `(user, campaign, wish)` index prevents duplicate notifications; per-device delivery receipts prevent a successful device from receiving retries intended for another device. A bounded refresh lease prevents overlapping collectors. Failed push deliveries retry up to five runs within one day; expired endpoints are removed. Disabled or deleted wishes do not receive new deliveries.

Push requires an HTTPS browser supporting Service Workers, PushManager and Notifications, and the visitor's explicit permission. `POST /api/push/test` uses the same encrypted remote delivery path as real notifications. The browser must be enabled from the site; permissions are never requested automatically. VAPID key names: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (secret), `VAPID_SUBJECT`. These are configured in Sites runtime variables, not source.

## Validation

`node scripts/test-live.mjs` verifies active-period parsing, JST dates, unknown-field handling, new/existing separation, de-duplication, visitor isolation, disabled wishes, Web Push encryption, and per-device retries. Build via the Sites build helper. Apply committed migrations to the local D1 preview in order. Sites applies hosted migrations during deployment. Use the published API's updater and readback to verify hosted data separately from local data.


## Catalogue expansion (2026-11-04)

The catalogue combines native dynamic official indexes with reviewed, source-backed records in `lib/expanded-catalog.json`. Reviewed records are revalidated against their scoped official listing or public structured row IDs during each update. They disappear when no longer listed, their verified application deadline passes, or the source has not been checked for 48 hours. Unknown deadlines remain null; a known listed/receipt period can conservatively bound visibility without pretending it is an application deadline. Only organizer/issuer/joint-campaign evidence is used for stored facts. Prize variants, past campaigns, paid trial sales and purchase-right raffles are excluded. Product selection monitors are labeled with review/post obligations.

Canonical identities preserve public application IDs and hash routing (including V-point lottery IDs). Source memberships retain the provenance of campaigns listed by multiple official feeds; ending one listing does not remove another still-current listing. Higher-priority application terms are not overwritten by a lower-priority listing period. Imported deadlines are not publication dates or prize-shipping dates.

`POST /api/refresh` is bounded to four sources and24 public page requests. Begin with `{cursor:0}` and repeat with `nextCursor` until `complete:true`. A busy result does not advance the cursor. The existing hourly Site updater reads this contract through `/api/automation/instructions`; no credentials are stored in source. The production deployment also uses a separate daily source-discovery task. Schedules are environment-specific and are not installed by cloning this repository. A new deployment must configure its own authorized scheduler.

The search loads up to 5,000 active records and renders 30 per page. The progress counter is based on actual current stored records; reviewed candidates or failed source reads do not count as successful collection. Expansion state is research/operational work, not a user-data or application-submission log.

## Extending the public catalogue

Add a native adapter in `lib/official-indexes.ts`, or add a reviewed source and records to `lib/expanded-catalog.json`. Use the `CampaignInput` type from `lib/campaign-core.ts`; unknown dates, counts and conditions remain null. Each reviewed record needs an official entry URL, source URL and verifiable evidence. Include concrete CSS/structured-row identifiers for future revalidation. Multiple prize options within the same draw remain one campaign. Known same-campaign URL aliases need direct official evidence.

Local migration setup is `npm run db:migrate:local`; `wrangler.local.jsonc` contains a placeholder D1 ID and must not be used as production configuration. The included data is a time-stamped research snapshot and is filtered/revalidated on collection. Tests do not contact organizers or submit applications.
