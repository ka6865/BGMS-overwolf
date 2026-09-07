# BGMS Companion Store Listing Draft

## App Name

BGMS Companion

## Short Description

A PUBG companion that shows what the game does not, then replays your engagements on the map.

## Full Description

BGMS Companion is an in-game overlay for PUBG players who review their matches on BGMS.

The overlay deliberately avoids repeating what PUBG already displays. It does not show your kill count, alive-player count, health bar, or weapon slots, because the game's own HUD and kill feed already cover those. Instead it surfaces figures the game keeps hidden until the results screen: headshot count, longest kill distance, and final placement. It also shows the current match phase, a knocked-out flag, the latest local event, and a warning line when Overwolf's event service is degraded.

After a match ends, BGMS Companion can send one compact session summary to BGMS. Along with the counters, the summary records when each engagement happened: knockdowns, kills, revives, your death, and who killed you, each as an elapsed time from match start. No coordinates and no damage figures are included.

On the BGMS website, that summary becomes a review surface. Each recorded engagement links to the same moment in BGMS's map replay, so a death at 24:30 opens the map at 24:30 with the blue zone and surrounding players in place. The replay itself is built from supported post-match data, not from live overlay data.

Session handoff is off by default and requires the player to turn it on and enter a BGMS nickname. If the network is unavailable, the summary is kept locally and retried later. Final analysis remains based on supported post-match data sources and BGMS processing, not live GEP data alone.

BGMS Companion does not show a real-time damage meter, live DPS, live location tracking, team location tracking, or a minimap. It does not call the PUBG API directly from live game events and does not include private Supabase or service role credentials in the app.

## Key Features

- Headshot count and longest kill distance during the match
- Final placement when the match ends
- Match phase, knocked-out flag, and latest local event
- No duplication of PUBG's own HUD figures
- Adjustable overlay position, opacity, and compact/debug modes
- Opt-in post-match session handoff with offline retry
- Engagement timeline on the BGMS website, with per-moment map replay entry
- Collapsed diagnostics panel that opens itself when the event service is degraded

## Compliance Notes

- Default app language is English.
- Korean is available as optional localization and never replaces the English default.
- BGMS owns and operates the `bgms.kr` domain, web service, backend, and processing pipeline.
- BGMS does not claim ownership of PUBG or KRAFTON source game data.
- PUBG-derived final analysis is not gated as subscriber-exclusive access.
- Session handoff is opt-in, sends one summary per match, and contains no damage, location, or team-location data. The engagement timeline records elapsed time and event type only.
- Map replay on the BGMS website is built from supported post-match data, not from live overlay data. The overlay never displays positions during a match.
- The app contains no private backend credentials and talks only to BGMS-controlled endpoints and the public Overwolf event status endpoint.

## Privacy Summary

BGMS Companion sends data only when the player enables session handoff, which is off until the player turns it on and enters a nickname.

What one summary contains:

- Match identifiers, match mode, map name, and phase
- Kill, death, revive, and knockdown counts, headshot count, longest kill distance, alive-player count
- Final placement and total player count
- The nickname of the player who killed you, if the game reported it
- Match start and end timestamps, and an engagement timeline of elapsed seconds paired with the event type
- Overwolf event version, app version, and the BGMS nickname and platform the player entered

What it never sends: chat, voice, screenshots, video, file contents, coordinates, team positions, and damage figures. The timeline records only when something happened, never where.

The nickname is a value the player types into the app. It is not treated as a verified account identity. Stored summaries are removed after 90 days.
