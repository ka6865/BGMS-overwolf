# Store Submission Screenshots

All files are 1920x1080 (16:9), which is what the Overwolf Developer Console expects for store screenshots.

| File | Shows | Captured from |
| --- | --- | --- |
| `01-session-timeline.png` | The BGMS session view with an engagement timeline expanded and the map replay entry points | `https://bgms.kr/overwolf/sessions` (production) |
| `02-replay-at-death.png` | The map replay opened at the death moment (`27:47`), with the final blue zone and 4 players alive | `https://bgms.kr/replay/3d?...&t=1667` (production) |
| `03-desktop-window.png` | The desktop window: handoff settings, overlay settings, and the diagnostics panel expanded | Local `desktop.html` with sample values |
| `04-overlay-in-game.png` | The in-game overlay showing headshots, longest kill, phase, and the latest event | Local `in-game.html` with sample values |

## Recapture rules

Recapture whenever overlay display fields change, because the listing copy in `../docs/store-listing.md` describes exactly what these screenshots show. A mismatch between the two is a review risk.

`03` and `04` use sample values rather than a live match, so they contain no real player data beyond the placeholder nickname. `01` and `02` come from production and show a real match; the nickname visible there belongs to the project owner's own account.

## Still missing

A screenshot of the overlay composited over actual PUBG gameplay. That requires a Windows machine running the game, so it has to wait for real-game testing. Overwolf reviewers generally expect at least one in-game screenshot, so plan to capture it during that session.
