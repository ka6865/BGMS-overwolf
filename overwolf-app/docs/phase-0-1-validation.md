# Phase 0-1 Validation Checklist

Last updated: 2026-07-30

## Automated Checks (no game required)

Run on macOS or any dev machine:

```bash
npm test   # node --test overwolf-app/tests/*.test.js
```

- `gep-state.test.js` covers PUBG official payload shapes: phase, match, match_info, kill, roster, me (health/weaponState), killer, knockedout, gep_internal, blocked payloads, matchEnd idempotency, session summary shape.
- `background-controller.test.js` loads `dev-harness/mock-overwolf.js` in a vm context and covers PUBG detection via class id, `setRequiredFeatures` success path, `getInfo` snapshot, duplicate `matchEnd`, `onError`, game switch reset, and duplicate listener prevention.
- Add a failing test first whenever a real-game payload does not parse as expected.

Manual UI harness (browser, no Overwolf client):

```bash
open overwolf-app/dev-harness/mock.html
```

Scenarios cover match start, kill, knock/revive, roster elimination, death + killer, duplicate matchEnd, ignored `rank`/`map` payloads, blocked payloads, `onError`, degraded service status, and the GEP-data-missing failure case.

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
- Confirm the desktop diagnostics panel shows: GEP status, event service status, class id + instance id, match id, seen/supported/missing/ignored features, GEP version, GEP error reason, session handoff state.
- Confirm the overlay shows a warning line when the event service status is yellow/red or when `onError` fires.
- Confirm HP shows `KO` only when `health` is 0 while `ko_health` remains above 0.
- Keep `SESSION_ENDPOINT` empty in `background.js` until the BGMS server endpoint is approved and implemented.

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
- English is the default manifest, desktop, overlay, and store listing language. Korean is optional and only auto-applied when the Overwolf client language is Korean and the user has not made a choice.
