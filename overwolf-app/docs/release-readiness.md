# Release readiness — 0.5.1

Reviewed: 2026-09-08. This repository is the Overwolf client; the BGMS backend and replay service live in a separate repository.

## Current progress

| Area | Evidence / status |
| --- | --- |
| Existing feature work | `develop` contained 22 commits beyond `main` at review start, through `6103269`: GEP reducer, consent-based session handoff, compact HUD, desktop settings/diagnostics, review links, hotkeys, feedback and onboarding |
| BGMS receiving / reading endpoints and replay entry | Production checks are recorded in the August 2026 validation notes; database and server checks were not rerun or changed in this client-only release |
| Runtime performance and failure recovery | Automated coverage added for focus storms, notification batching, idle timers, stalled POSTs, queue draining, opt-out, stale callbacks and hotkey assignments |
| Distribution | `npm run verify` runs tests and creates a validated runtime-only `dist/bgms-companion` folder; CI checks Node 24 on Ubuntu and Windows and publishes an unpacked artifact |
| Public store release | Pending Windows/PUBG observations, gameplay screenshot, OPK validation, support/FAQ completion and Developer Console review |

## Changes and measurable limits

The following are deterministic controller/DOM test results, not FPS measurements:

| Scenario | Before | 0.5.1 |
| --- | --- | --- |
| Initial PUBG detection plus 100 unchanged focus/info updates | 101 status requests, HUD restored on every update | 1 status request; a hidden HUD stays hidden; resolution changes still reposition a visible HUD |
| Burst of 100 kill events | 100 subscriber broadcasts / whole-state snapshots | 1 broadcast after 50 ms, with all 100 events already reduced synchronously |
| No pending handoff / handoff disabled | Queue interval every 30 seconds | No queue timer |
| Session POST never settles | Queue remains in flight indefinitely | 15-second timeout; one failed attempt; next attempt after 5 seconds; late response ignored |
| First queued session is rejected | Next session waits for periodic tick | Next due entry starts on the next timer turn |
| Hidden debug / collapsed diagnostics | Every event rewrites hidden text | Hidden diagnostics skip work; reopening renders latest state; unchanged text is not rewritten |

State snapshots remain copies at the UI boundary. GEP collection and match-end summary creation are synchronous; batching only delays visual updates by approximately 50 ms, subject to runtime scheduling. Service status is fetched on PUBG detection and explicit diagnostic refresh, not on each focus update.

New installations default to English regardless of the Overwolf client language. Existing saved language choices persist, and Korean is selected explicitly in settings. No GEP feature, permission, backend endpoint, analysis trigger, media capture or monetization capability was added.

## Verification and next steps

- Baseline: 69 tests passed at `6103269`. Current local verification: 85/85 tests passed and 21 runtime files staged successfully (2026-09-08).
- Run `npm run verify` for the current regression tests, syntax/reference/version checks, and runtime staging. Check the corresponding GitHub Actions run for both operating systems before installing a downloaded artifact.
- Browser check: the real desktop markup at 980×700 loaded without JavaScript errors or horizontal overflow. A burst of 100 mock kill events produced zero text mutations inside collapsed diagnostics, and opening the panel showed the latest event. Mock session requests do not reach production.
- Follow [Windows testing](windows-test-guide.md) to clone/pull `main`, build, load the extension and record real-game performance. Actual CPU/FPS gains and long-session memory behavior remain unmeasured here.
- Prioritize correct official match IDs and review navigation during live testing; replay entry depends on those observations. Media capture, automatic analysis and a live minimap remain outside this release.
