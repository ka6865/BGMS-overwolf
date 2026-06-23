# Phase 0-1 Validation Checklist

## Phase 0 Manual Checks

- Create or confirm Overwolf developer console access.
- Run Overwolf's official events sample app locally.
- Use GEP Simulator to inspect PUBG feature payloads for:
  - `match`
  - `phase`
  - `kill`
  - `death`
  - `revived`
  - `killer`
  - `roster`
  - `me`
- Confirm whether `match_id`, `pseudo_match_id`, or both are emitted for current PUBG sessions.
- Confirm exact roster item shape and whether the `out` field is boolean, string, absent, or replaced by another status field.
- Confirm whether roster removal is emitted as `null` for a `roster_XX` key.
- Record any payload differences before enabling server handoff.

## Phase 1 App Checks

- Confirm the manifest is accepted by the current Overwolf Developer Console.
- Confirm `launch_events` starts the background page when PUBG launches.
- Confirm PUBG game targeting ID in the Developer Console before packaging.
- Confirm `setRequiredFeatures()` succeeds after PUBG starts.
- Confirm the overlay appears only for PUBG.
- Confirm `Ctrl+Shift+B` toggles the overlay.
- Confirm closing and reopening the overlay does not register duplicate GEP listeners.
- Confirm matchEnd duplicate events do not trigger multiple summary sends in one runtime session.
- Keep `SESSION_ENDPOINT` empty in `background.js` until the BGMS server endpoint is approved and implemented.

## Policy Checks

- No `damage_dealt` feature subscription.
- No location, team location, zone, coordinate, or minimap UI.
- No direct PUBG API request from the Overwolf client.
- No Supabase service role key or private credential in client files.
- English is the default manifest, desktop, overlay, and store listing language.
