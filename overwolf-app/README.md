# BGMS Companion Overwolf MVP

This folder contains the Phase 1 Overwolf app draft for BGMS review and Overwolf submission preparation.

## Scope

- Default language: English
- Target game: PUBG
- GEP features: `match`, `phase`, `kill`, `death`, `revived`, `killer`, `roster`, `me`
- In-game UI only: match state, phase, kills, alive count, health, weapon state, latest local event
- GEP subscription owner: `background.js`
- In-game window role: render state from the background controller only
- Optional post-match session summary handoff: disabled until `SESSION_ENDPOINT` is set in `background.js`

## Explicitly Out Of Scope

- Real-time damage meter or DPS display
- Live location, team location, minimap, zones, or coordinates
- Direct PUBG API calls from GEP events
- Supabase service role key or private backend credentials
- Database writes from the Overwolf client
- Any change to BGMS core analysis APIs

## Local Preview

Open `desktop.html` or `in-game.html` in a browser to inspect the static UI. Without Overwolf APIs, the in-game window enters preview mode with sample UI state only.

## OPK Packaging

When building an `.opk` for Windows testing, compress the contents of `overwolf-app/` so `manifest.json` is at the root of the archive. Do not zip the parent folder as an extra top-level directory.

## Controller Notes

`background.js` owns `setRequiredFeatures()`, `onInfoUpdates2`, and `onNewEvents`. It exposes `window.bgmsController` so declared windows can subscribe to state snapshots through `overwolf.windows.getMainWindow()`.

The controller keeps a single GEP listener registration and a single required-feature activation flow per background runtime. Closing and reopening the overlay only changes the renderer window; it does not register new GEP listeners.

`match_id` and `pseudo_match_id` are stored separately. `effectiveMatchId` prefers `match_id` when present and falls back to `pseudo_match_id`.

Roster parsing is intentionally conservative until GEP Simulator payloads are confirmed. The current parser counts alive players only when a roster item has a known `out` boolean-like value.

## Overwolf Review Notes

BGMS owns and operates the `bgms.kr` domain, BGMS web service, backend, and processing pipeline. BGMS does not claim ownership of PUBG or KRAFTON source game data. The app uses Overwolf GEP for live overlay context and BGMS-controlled service endpoints for post-match handoff.

Before packaging, verify the PUBG Overwolf game ID and manifest schema in the current Overwolf Developer Console.
