# Phase 0-1 Validation Checklist

Last updated: 2026-07-31

## Automated Checks (no game required)

Run on macOS or any dev machine:

```bash
npm test   # node --test overwolf-app/tests/*.test.js
```

- `gep-state.test.js` covers PUBG official payload shapes: phase, match, match_info, kill, roster, me (health/weaponState), killer, knockedout, gep_internal, blocked payloads, matchEnd idempotency, session summary shape.
- `session-queue.test.js` covers enqueue de-duplication, corrupted queue recovery, backoff scheduling, permanent 4xx rejection, retry on 429/5xx/network error, and max-attempt drop.
- `settings.test.js` covers handoff consent defaults, nickname sanitization, platform validation, corrupted storage recovery, and the send precondition.
- `background-controller.test.js` loads `dev-harness/mock-overwolf.js` in a vm context and covers PUBG detection via class id, `setRequiredFeatures` success path, `getInfo` snapshot, duplicate `matchEnd`, `onError`, game switch reset, duplicate listener prevention, and the full handoff path (off, missing nickname, single send, blocked-field absence, 503 retry, 422 rejection, network-down queue retention, restart resume).
- Server-side checks live in the BGMS repository: `npm run verify:overwolf` covers payload normalization, quota, idempotency, and migration security invariants. `npm run verify:overwolf-db` applies the migration to a throwaway PostgreSQL instance and runs RPC scenarios.
- Add a failing test first whenever a real-game payload does not parse as expected.

Manual UI harness (browser, no Overwolf client):

```bash
open overwolf-app/dev-harness/mock.html
```

Scenarios cover match start, kill, knock/revive, roster elimination, death + killer, duplicate matchEnd, ignored `rank`/`map` payloads, blocked payloads, `onError`, degraded service status, the GEP-data-missing failure case, session handoff with 200/503/422 responses, network-down queue retention, and a backoff-skipping flush. The harness intercepts `/api/overwolf/session`, so no request reaches production.

To point the harness at a local BGMS server instead of the interceptor, set `window.bgmsDevEndpoint` before the harness scripts load. Overwolf runtime never defines it, so the packaged app always uses the production endpoint.

## Phase 0 Manual Checks

- Create or confirm Overwolf developer console access.
- Run Overwolf's official events sample app locally.
- Use GEP Simulator to inspect PUBG feature payloads for:
  - `match`
  - `match_info`
  - `phase`
  - `kill`
  - `death`
  - `revived`
  - `killer`
  - `roster`
  - `me`
- Confirm whether `match_id`, `pseudo_match_id`, or both are emitted for current PUBG sessions.
- Confirm the `roster_XX` item shape and the `out` field type.
- Confirm whether roster removal is emitted as an empty/null value for a `roster_XX` key.
- Confirm whether `knockedout` (present in the status endpoint but not in the PUBG feature table) is actually emitted.
- Record any payload differences before enabling server handoff.

## Phase 1 App Checks

- Confirm the manifest is accepted by the current Overwolf Developer Console.
- Confirm packaged `.opk` files expose `manifest.json` at archive root, not under an extra parent directory.
- Confirm `launch_events` starts the background page when PUBG launches.
- Confirm PUBG targeting uses base game id `10906` only. Runtime `id` is the instance id (`109061` observed locally) and must be converted with `Math.floor(id / 10)` or `classId`.
- Confirm `minimum-gep-version: "135.0"` does not block the current client while still guaranteeing `me.health`.
- Confirm `setRequiredFeatures()` succeeds after PUBG starts and `supportedFeatures` is non-empty.
- Confirm the overlay appears only for PUBG.
- Confirm `Ctrl+Shift+B` toggles the overlay and `Ctrl+Shift+G` toggles the desktop window.
- Confirm the overlay is click-through and does not steal mouse or keyboard input in-game (`clickthrough`, `ignore_keyboard_events`).
- Confirm closing and reopening the overlay does not register duplicate GEP listeners.
- Confirm matchEnd duplicate events do not trigger multiple summary sends in one match.
- Confirm the handoff toggle is off on a fresh install and no request is sent until the user enables it and enters a nickname.
- Confirm a queued summary survives an app restart and is sent on the next launch.
- Confirm the overlay shows the pending-handoff count only while a summary is waiting.
- Confirm the desktop diagnostics panel shows: GEP status, event service status, class id + instance id, match id, seen/supported/missing/ignored features, GEP version, GEP error reason, session handoff state.
- Confirm the overlay shows a warning line when the event service status is yellow/red or when `onError` fires.
- Confirm HP shows `KO` only when `health` is 0 while `ko_health` remains above 0.
- Confirm `SESSION_ENDPOINT` in `background.js` points at the deployed BGMS endpoint (`https://bgms.kr/api/overwolf/session`) and that the endpoint responds before enabling handoff for users.
- Confirm the desktop window can be dragged to a second monitor while PUBG is running, that it stays there across restarts (`keep_window_location`), and that OS maximize and taskbar minimize work (`use_os_windowing`).
- Confirm the desktop window no longer appears inside the in-game overlay context now that `desktop_only: true` is set.

## Server Endpoint Checks (BGMS repository)

- Apply `supabase/migrations/20260731070000_overwolf_gep_session_events.sql` before enabling handoff in production. Applied 2026-07-31.
- `npm run verify:overwolf-db` reproduces the schema and RPC behaviour on a throwaway instance (8 scenarios).
- Confirm the daily cleanup job (`scripts/cleanup_pubg_cache.ts`) removes session rows older than 90 days.

### Verified against the live database (2026-07-31)

- `overwolf_session_events` and `overwolf_session_quota` exist with RLS enabled.
- `record_overwolf_session_event` returns `true` on first insert and `false` on a duplicate `session_id`. The duplicate does not overwrite the stored summary.
- `consume_overwolf_session_quota` allows requests up to the limit and returns `false` beyond it.
- The `anon` key is rejected with SQL error `42501` on both a direct table select and an RPC call, so the public key cannot read or write session data.
- `POST /api/overwolf/session` returns 200 with `stored: true`, then 200 with `duplicate: true` for the same `session_id`; 422 for a `damage_dealt` payload; 400 for a missing `session_id`; 204 with CORS headers for `OPTIONS`.
- Stored rows drop unknown keys (`unknown_key`, `secret`), normalize `player_id` to lowercase, normalize `platform`, and mark localhost traffic as `is_internal: true`.
- End-to-end through the harness: the app posts over real HTTP, exactly one row lands for two `matchEnd` events, and the client queue empties.
- Network-down recovery: the summary stays queued with `network_error`, survives a simulated app restart, and reaches the database on the next flush.

Note: Supabase's `service_role` has `BYPASSRLS`, so RLS alone does not gate it. Protection for this table comes from RLS plus revoking `anon`/`authenticated` table grants and function `EXECUTE`. A throwaway test role must be created with `bypassrls` to reflect production behaviour.

### Verified against production `https://bgms.kr` (2026-07-31)

The route is deployed. Checked directly against the public domain, not a local server:

- `OPTIONS /api/overwolf/session` returns 204 with CORS headers.
- `GET /api/overwolf/session` returns 405 (no GET handler), so the route is not readable.
- `POST` with a full summary returns 200 `{"stored":true,"duplicate":false}` and the row lands in `overwolf_session_events` with `source_host: bgms.kr`, `is_internal: false`.
- The same `session_id` posted again returns 200 `{"stored":false,"duplicate":true}` and does not overwrite the stored summary.
- `POST` with `gep_summary.damage_dealt` returns 422.
- `POST {}` returns 400.
- `unknown_key` at the top level is dropped; `player_id` is stored lowercase.
- `https://bgms.kr/overwolf-verification.txt` returns 200.

All rows and quota keys created by this smoke test were deleted afterwards. Both tables are back to 0 rows.

Remaining gap: nothing on the BGMS website reads `overwolf_session_events` yet, and the Overwolf app has no link back into a BGMS session view. Consuming the stored summaries in the web UI is a Phase 2 item and needs separate approval.

## UI and Performance Audit (2026-08-01)

Measured with headless Chrome at the real manifest window sizes, plus CoreText text metrics for width budgets. No game or Overwolf client involved.

Fixed in this pass:

- In-game HUD width. At 348px the `KO` flag plus a three-digit alive count pushed the alive counter past the window edge (335px content vs 318px usable). `.overlay-card` now matches the manifest width, the brand label is shortened to `BGMS` with the full name as a tooltip, and `.mini-item` allows the label to shrink while the number stays intact. Worst measured case is now 295px against 334px usable.
- Status line wrapping. Four simultaneous items (match state, long kill notice, pending count, service warning) needed 512px on one line and were silently ellipsized. `.mini-status` now wraps, and the warning takes its own row.
- Overlay height with a warning. `background.js` raises the mini window from 78px to 100px while a warning row is visible, and returns to 78px when it clears. Measured worst case is 96px.
- Desktop window density. Content was 1748px tall in a 700px window, so the diagnostics panel and both policy cards were entirely below the fold. The diagnostics list is now an auto-fit grid (4 columns at 980px, 3 at 760px), the hero uses panel-scale type instead of 44px display type, the language switcher moved into the title bar, and fixed panel min-heights were removed. Content is now 1102px, and the handoff and overlay settings panels are fully visible in the first screen.
- Phase labels. Raw GEP values such as `loading_screen` were truncated at 72px. The HUD now shows short localized labels; the raw value stays in the debug panel.
- Duplicated degraded-service logic in `in-game.js` and `background.js` was replaced with `gepState.isServiceDegraded`, so the warning row and the window height use one rule.
- Accessibility: the close button has a localized tooltip, the opacity slider exposes its percentage as visible text and `aria-valuetext`, platform buttons carry an initial `aria-pressed`, and the handoff status no longer looks like a text input.

Measured after the fixes:

- Overlay card: 58px in mini, 73px with a warning (78px window), 187px in debug (236px window). No horizontal overflow at any state.
- Diagnostics: 4 columns / 5 rows at 980px, 3 columns / 6 rows at 760px, zero truncated values.
- Reducer cost: 6.6us per info update; with the two state clones in `patchState` and `notifySubscribers`, 18.8us per update. At 30 updates per second that is 0.06% of one core and 78KB/s of allocation.
- State does not grow: after 5000 cycles `recentUpdates` stays at 6 entries and the snapshot stays at ~1.3KB. `damage`-prefixed strings appear only in the `ignoredUpdates` diagnostic label, never in the outgoing summary (565 bytes against the 16KB server limit).

Not verified: real PUBG rendering. All of the above is headless Chrome plus computed CSS, not the Overwolf client compositor.

## Observed vs Official (keep separated)

- Official phase list has no `starting`, but `starting` was observed in real gameplay (2026-07-08).
- Official PUBG feature table has no `knockedout` event, but the status endpoint lists it under `death` (2026-07-30).
- The status endpoint lists an undocumented `victimName` feature with state 0 (unsupported). Not subscribed.
- `gep_internal` arrived without being subscribed. Used for diagnostics only.
- 2026-07-08: `Supported features` included `me`, but `Seen features` stayed at `game_info | gep_internal`. The 2026-07-30 status check reports `me` as green, so treat this as a timing/session issue rather than an outage until reproduced.

## Policy Checks

- No `damage_dealt`, `total_damage_dealt`, or `damageTaken` usage. The reducer blocks them and records them under `Ignored updates`.
- No location, team location, zone, coordinate, or minimap UI.
- No direct PUBG API request from the Overwolf client.
- No Supabase service role key or private credential in client files.
- Session handoff is opt-in and off by default. The client posts only to the BGMS session endpoint.
- The server stores only whitelisted summary keys; unknown keys are dropped and blocked keys are rejected.
- English is the default manifest, desktop, overlay, and store listing language. Korean is optional and only auto-applied when the Overwolf client language is Korean and the user has not made a choice.
