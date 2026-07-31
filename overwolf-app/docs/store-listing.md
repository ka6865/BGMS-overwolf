# BGMS Companion Store Listing Draft

## App Name

BGMS Companion

## Short Description

A clean PUBG match companion overlay for live session awareness and BGMS post-match handoff.

## Full Description

BGMS Companion is a lightweight in-game overlay for PUBG players who use BGMS for match review and performance context.

During a match, the overlay focuses on simple, review-safe status: match state, phase, local health, weapon state, kills, deaths, revives, killer notice, and an approximate alive-player count from supported roster updates.

After a match ends, BGMS Companion can send one compact session summary to BGMS. This is off by default and requires the player to turn it on and enter a BGMS nickname. If the network is unavailable, the summary is kept locally and retried later. Final analysis remains based on supported post-match data sources and BGMS processing, not live GEP data alone.

BGMS Companion does not show a real-time damage meter, live DPS, live location tracking, team location tracking, or a minimap. It does not call the PUBG API directly from live GEP events and does not include private Supabase or service role credentials in the app.

## Key Features

- Compact in-game status overlay
- Match start and match end awareness
- PUBG phase display
- Local health and weapon-state display
- Kill, death, revive, and killer event notices
- Adjustable overlay position, opacity, and compact/debug modes
- Live diagnostics for event availability and service status
- Opt-in post-match BGMS session handoff with offline retry

## Compliance Notes

- Default app language is English.
- Korean is available as optional localization and never replaces the English default.
- BGMS owns and operates the `bgms.kr` domain, web service, backend, and processing pipeline.
- BGMS does not claim ownership of PUBG or KRAFTON source game data.
- PUBG-derived final analysis is not gated as subscriber-exclusive access.
- Session handoff is opt-in, sends one summary per match, and contains no damage, location, or team-location data.
- The app contains no private backend credentials and talks only to BGMS-controlled endpoints and the public Overwolf event status endpoint.

## Privacy Summary

BGMS Companion sends data only when the player enables session handoff. In that case it sends the match identifiers, match mode, phase, kill/death/revive/knockdown counts, alive-player count, last killer name, GEP version, app version, and the BGMS nickname and platform the player entered. It does not send chat, voice, screenshots, video, file contents, or location data. Stored summaries are removed after 90 days.
