# BGMS Companion Store Listing Draft

## App Name

BGMS Companion

## Short Description

A clean PUBG match companion overlay for live session awareness and BGMS post-match handoff.

## Full Description

BGMS Companion is a lightweight in-game overlay for PUBG players who use BGMS for match review and performance context.

During a match, the overlay focuses on simple, review-safe status: match state, phase, local health, weapon state, kills, deaths, revives, killer notice, and an approximate alive-player count from supported roster updates.

After a match ends, BGMS Companion can prepare a compact session summary for BGMS. Final analysis remains based on supported post-match data sources and BGMS processing, not live GEP data alone.

BGMS Companion does not show a real-time damage meter, live DPS, live location tracking, team location tracking, or a minimap. It does not call the PUBG API directly from live GEP events and does not include private Supabase or service role credentials in the app.

## Key Features

- Compact in-game status overlay
- Match start and match end awareness
- PUBG phase display
- Local health and weapon-state display
- Kill, death, revive, and killer event notices
- Post-match BGMS session handoff preparation

## Compliance Notes

- Default app language is English.
- Korean may be added later as optional localization.
- BGMS owns and operates the `bgms.kr` domain, web service, backend, and processing pipeline.
- BGMS does not claim ownership of PUBG or KRAFTON source game data.
- PUBG-derived final analysis is not gated as subscriber-exclusive access.
