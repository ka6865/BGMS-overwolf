---
version: 1
slug: "overwolf-app-desktop-html"
primary_target: "overwolf-app/desktop.html"
related_targets: ["overwolf-app/in-game.html"]
---

# Surface: BGMS Companion desktop window + in-game HUD

Mode: Operate. Audience: casual PUBG PC players, English default. Task: see whether the app is working, read the last match, open its review on bgms.kr, occasionally change settings. Constraints: 1000x560 minimum, fixed 400x300 ad rail (never beside a pure settings page), plain HTML/CSS/JS, Overwolf windows.

Chosen structure: status dashboard (user-locked from a dealt hand of three: status dashboard, setup-steps, timeline-first).

## Direction contract

THESIS: The window is the bgms.kr shell shrunk to a companion: amber header bar, near-black ground, one status strip, then the last match. It refuses the settings-form-first utility window and the hero-metric card grid.

OWN-WORLD: bgms.kr tokens: amber #F2A900 bar with #cc8b00 bottom rule, BG (black) MS (white) black italic uppercase wordmark, grounds #0d0d0d / #161616 / #1f1f1f, hairline rgba(255,255,255,.08), Outfit, radii 6/10/14, amber filled primary button with black text, black-on-amber active pills.

STORY: The player sees at a glance that PUBG is detected, the overlay is on, and handoff is (or is not) set up; reads the last match result and when they were knocked, died, or bookmarked; presses one amber button to review it on BGMS.

FIRST VIEWPORT: Amber bar 48px across the top (wordmark left, language pills and close right). Below, left column: one segmented status strip (Game, Overlay, Session handoff) with lamps; then the latest-match block: map + mode heading, result "#3 / 98" in amber with headshots and longest kill as one inline line, the moment track with time labels and 0:00/end ticks, the amber replay button that opens this match on the BGMS map replay (at the last death when there is one). Settings and diagnostics are collapsed rows beneath. Right: the 400x300 ad rail, top-aligned with the status strip.

FORM: status dashboard, position 5 on the grounded list; signature move: the moment track, a hairline match-length rail where knock, death, and bookmark marks sit at their elapsed time with tabular time labels. seed:e524ce92bee57b9e

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
