# BGMS Companion Overwolf App

This folder contains the Overwolf app for BGMS review and Overwolf submission preparation. Phases 1, 1.5, 2, and the first step of Phase 3 are implemented. The client, the BGMS receiving and reading endpoints, the database schema, and the web session view are all in place.

## Release Readiness (2026-08-01)

Done and verified:

- `POST https://bgms.kr/api/overwolf/session` is deployed. Smoke-tested against the production domain: 200 `stored:true`, 200 `duplicate:true` on resend, 422 for `damage_dealt`, 400 for an empty body, 204 + CORS for `OPTIONS`, 405 for `GET`. Test rows were deleted afterwards.
- `overwolf_session_events` and `overwolf_session_quota` exist in the production database with RLS on and `anon` grants revoked.
- `event_timeline` column and the read RPCs (`list_overwolf_sessions`, `get_overwolf_session`) are applied to the production database. All five Overwolf functions grant EXECUTE to `service_role` only; the old nine-argument insert signature was dropped.
- The web session view renders against a local server backed by the production database: list, per-session stats, expandable engagement timeline, and the analysis link. No horizontal overflow at 1280 or 390 px.
- 90-day retention is wired into the daily cleanup job in the BGMS repository.
- 66 app tests, 43 server tests, 8 migration DB scenarios pass.

Not done, required before a public listing:

- Deploy the new read route. `https://bgms.kr/api/overwolf/sessions` and `/overwolf/sessions` return 404 until the BGMS repository ships. The app's "open my session history" button will fail until then.
- Real-game confirmation that `me`, `roster`, and `knockedout` updates arrive during a live PUBG match. Only the simulator and mock harness paths are confirmed.
- Real-game confirmation that `match_id` is emitted, and that its value resolves against the official PUBG API. Post-match analysis linking depends on it; a session with only `pseudo_match_id` is shown without an analysis link by design.
- `.opk` packaging on Windows and a re-check of unpacked-only limitations.
- Overwolf Developer Console submission: store listing text (see `docs/store-listing.md`), icons, screenshots. The listing copy and screenshots must be redone for the reworked overlay.

Deliberately deferred to Phase 2 (needs separate approval):

- Linking a session to that specific match's telemetry map analysis. The session view currently links to the player's stats page, not to a per-match map replay.
- Automatically triggering the BGMS analysis pipeline from a stored summary.

## Scope

- Default language: English (Korean is an optional local setting)
- Target game: PUBG, base game id `10906`
- GEP features: `match`, `match_info`, `phase`, `kill`, `death`, `revived`, `killer`, `roster`, `me`, `rank`, `map`
- In-game overlay shows only what PUBG does not: headshot count, longest kill distance, final placement, KO flag, phase, latest local event, degraded-service warning. Kills, alive count, health, and weapon state are collected but not displayed, because the game's own HUD and kill feed already show them.
- GEP subscription owner: `background.js`
- GEP payload parsing owner: `gep-state.js` (pure module, unit tested)
- In-game window role: render state from the background controller only
- Post-match session summary handoff: live against `https://bgms.kr/api/overwolf/session`, opt-in per user
- Post-match review: `death`, `killer`, `knockedout`, `revived`, and `kill` timestamps travel with the summary and render on the BGMS web session view
- Web session view: `https://bgms.kr/overwolf/sessions`, opened from the desktop window through `overwolf.utils.openUrlInDefaultBrowser`

## Session Handoff

After a match ends, BGMS Companion can send one compact session summary to BGMS.

- Off by default. The user must enable it in the desktop window and enter a BGMS nickname.
- The summary is queued in local storage first, then posted. A failed post is retried with exponential backoff (5s, 15s, 60s, 5m, 15m) and survives an app restart.
- `4xx` responses other than `429` are treated as permanent rejections and dropped without retrying.
- The server (`app/api/overwolf/session` in the BGMS repository) is idempotent on `session_id`, so duplicate `matchEnd` events cannot create duplicate rows.
- The payload carries counters, phase, match identifiers, GEP version, and the user-provided nickname/platform. No damage, location, or team-location fields.
- `session-queue.js` and `settings.js` are pure modules and unit tested.

## Explicitly Out Of Scope

- Real-time damage meter or DPS display (`damage_dealt`, `total_damage_dealt`, `damageTaken` are blocked in the reducer)
- Live location, team location, minimap, zones, or coordinates
- Direct PUBG API calls from GEP events
- Supabase service role key or private backend credentials
- Direct database writes from the Overwolf client (the client only calls the public BGMS session endpoint)
- Any change to BGMS core analysis APIs

## File Layout

| File | Role |
| --- | --- |
| `manifest.json` | Overwolf app manifest (windows, hotkeys, game targeting, GEP version floor) |
| `background.js` | Overwolf API side: game detection, GEP subscription, windows, network |
| `gep-state.js` | Pure GEP payload reducer. No Overwolf API calls, unit tested |
| `session-queue.js` | Pure session summary queue with retry/backoff, unit tested |
| `settings.js` | Handoff consent, BGMS nickname, and platform storage, unit tested |
| `in-game.js` / `in-game.html` | Compact HUD renderer |
| `desktop.js` / `desktop.html` | Settings and live diagnostics window |
| `i18n.js` | English default dictionary plus optional Korean |
| `dev-harness/` | Browser harness with a mock Overwolf API and official-shaped GEP scenarios |
| `tests/` | `node --test` suites for the reducer and the background wiring |

## Tests

```bash
npm test
```

Runs `node --test --test-force-exit overwolf-app/tests/*.test.js`. No Overwolf client, no game, and no dependencies required. `background-controller.test.js` loads the dev-harness mock API in a `vm` context to verify controller wiring, including the handoff queue against intercepted session requests. `--test-force-exit` is required because the controller keeps a queue flush interval alive.

## Local Preview

- `open overwolf-app/dev-harness/mock.html` for the interactive harness (scenario buttons for match flow, knock/revive, roster elimination, duplicate `matchEnd`, blocked payloads, GEP errors, degraded service status, and session handoff with 200/503/422 responses).
- The harness intercepts `/api/overwolf/session` requests, so no traffic reaches the production endpoint.
- Opening `desktop.html` or `in-game.html` directly shows static preview state without Overwolf APIs.

## OPK Packaging

When building an `.opk` for Windows testing, compress the contents of `overwolf-app/` so `manifest.json` is at the root of the archive. Do not zip the parent folder as an extra top-level directory.

## Controller Notes

`background.js` owns `setRequiredFeatures()`, `onInfoUpdates2`, `onNewEvents`, and `onError`. It exposes `window.bgmsController` so declared windows can subscribe to state snapshots through `overwolf.windows.getMainWindow()`.

Runtime `RunningGameInfo.id` includes an instance digit (`109061` observed for PUBG). The controller converts it to the base game id with `classId` or `Math.floor(id / 10)` before comparing against `10906`.

GEP listeners are removed before being added again, which is the documented best practice for avoiding duplicate registrations. Closing and reopening the overlay only changes the renderer window.

`match_id` and `pseudo_match_id` are stored separately. `effectiveMatchId` prefers `match_id` and falls back to `pseudo_match_id`.

`matchEnd` can fire twice (on death and on returning to the lobby). Only the first event marks the session summary as ready; later ones just increase `matchEndCount`. A new `session_id` is issued on `matchStart` so a server-side idempotency key never collides across matches.

Feature routing is keyed on the GEP `feature` field first. The `rank` feature uses info key `match_info.me`, which collides with the `me` feature if only the key is inspected.

Roster parsing stays conservative: alive count updates only when a roster item exposes a known `out`-like value, otherwise the previous count is kept.

## Diagnostics

The desktop window shows GEP status, Overwolf event service status (from `https://game-events-status.overwolf.com/10906_prod.json`), detected class/instance id, match id, seen/supported/missing/ignored features, GEP version, GEP error reason, and session handoff state. The overlay shows a short warning line when the service is degraded or `onError` fires.

## Localization

English is the default app language for Overwolf review. Korean is available as an optional local setting from the desktop window and is stored locally in `localStorage`. If the user has never chosen a language and the Overwolf client language is Korean, Korean is applied once as the initial default.

## Overwolf Review Notes

BGMS owns and operates the `bgms.kr` domain, BGMS web service, backend, and processing pipeline. BGMS does not claim ownership of PUBG or KRAFTON source game data. The app uses Overwolf GEP for live overlay context and BGMS-controlled service endpoints for post-match handoff.

Domain control is verified through `https://bgms.kr/overwolf-verification.txt`.

Before packaging, verify the PUBG Overwolf game ID and manifest schema in the current Overwolf Developer Console.
