# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Casual PUBG PC players who look at their match record and numbers lightly and only sometimes review a match in depth. Many meet the app first in the Overwolf Appstore, so the default experience is English; Korean is an optional setting. (Confirmed 2026-11-13.)

## Product Purpose

BGMS Companion is an Overwolf companion for PUBG. During a match it shows a small overlay with values the game's own HUD does not show (headshots, longest kill, final placement, phase, knocked state). After the match it shows a short summary and, if the player opts in, sends one compact session summary to BGMS so the match can be reviewed on the BGMS web map replay at the moment something happened (knock, death, bookmark).

Success: a player who just finished a match opens the review of that match, not just the numbers.

## Positioning

Other PUBG Overwolf apps stop at numbers, match history, or video clips. BGMS Companion connects a finished match to the BGMS telemetry map replay at the exact moments that mattered, including moments the player bookmarked with a hotkey during the match.

## Operating Context

- In-game overlay: tiny, click-through, sits over a running PUBG match; must never block play or compete with the game HUD.
- Desktop window: opened between matches or on a second monitor; carries one Overwolf ad container (400x300), which Overwolf policy forbids on a pure settings page.
- The web review happens on bgms.kr in the default browser, not inside the app.

## Capabilities and Constraints

- Plain HTML/CSS/JS loaded by Overwolf windows; no build tooling, no framework.
- Desktop window: default 1200x720, minimum 1000x560, fixed 400px ad rail on the right.
- In-game window: 348px wide, transparent, click-through.
- English default for every user-facing string; Korean through `i18n.js`.
- No real-time damage, location, or minimap (Overwolf and PUBG policy). All features free; ads only.

## Brand Commitments

Same brand as bgms.kr (confirmed 2026-11-13): amber accent `#F2A900` on near-black surfaces (`#0d0d0d`, `#161616`, `#1f1f1f`), the "BGMS" wordmark in black italic uppercase ("BG" dark, "MS" white on amber), the amber pillar logo (`pubg-map-app-local/public/logo.png`), fonts Outfit / Pretendard. Do not use "PUBG" alone as the app name or logo.

## Evidence on Hand

- Web brand tokens: `pubg-map-app-local/app/globals.css`, header: `components/common/GlobalHeader.tsx`.
- Store screenshots in `overwolf-app/store-assets/` predate this redesign.
- No user testimonials, usage numbers, or performance measurements exist; do not invent them.

## Product Principles

1. The match comes first: the most recent match and the way into its review lead every screen.
2. Show only what the game does not; never duplicate the PUBG HUD.
3. Stay out of the way during play: the overlay is glanceable and silent.
4. One brand with bgms.kr, so moving from the app to the web review feels like one service.
