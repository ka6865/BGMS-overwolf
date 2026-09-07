# Windows testing — BGMS Companion 0.5.1

This build is ready for desktop validation, not yet approved for public store release.

## Prerequisites

- Windows with PUBG and the Overwolf desktop client installed.
- An Overwolf developer account approved to load this unreleased app. See the official [development environment guide](https://dev.overwolf.com/ow-native/getting-started/onboarding-resources/setting-up-dev-environment/).
- Git and Node.js 24 LTS on PATH (`git --version`, `node --version`). No npm dependencies or backend credentials are needed.

## Download and build

First download, in PowerShell:

```powershell
git clone --branch main https://github.com/ka6865/BGMS-overwolf.git
cd BGMS-overwolf
npm run verify
```

For an existing checkout, close BGMS Companion before updating:

```powershell
git status --short
git switch main
git pull --ff-only origin main
npm run verify
```

Keep any local changes before switching or pulling. A fast-forward failure means the checkout has diverged; do not discard your changes to update it.

The command runs automated tests, validates local file references and JavaScript, and rebuilds `dist/bgms-companion`. The directory contains `manifest.json` at its root and only runtime files. Development harnesses, documentation and store screenshots are excluded. It is an unpacked application directory, not a signed OPK.

## Load in Overwolf

1. Open Overwolf Settings → Support → Development options.
2. Choose **Load unpacked extension** and select `dist/bgms-companion` inside this checkout.
3. Launch BGMS Companion from Overwolf. Check that its version is `0.5.1`.
4. After every update/build, fully close and relaunch the app or reload the extension in Development options. Updating files does not replace an already running background controller.

The official [Overwolf sample app instructions](https://github.com/overwolf/sample-app#load-as-unpacked-extension) describe the unpacked workflow. If loading is refused, check account/app whitelisting before changing the code.

## Desktop and live-match checklist

| Check | Expected result |
| --- | --- |
| Fresh app storage | English UI; summary handoff off; first-run instructions visible |
| Choose Korean, then reopen | Explicit language choice persists |
| Assigned hotkeys | Display reflects actual Overwolf settings; an unassigned key says “Unassigned” |
| Start PUBG | Compact HUD appears; GEP diagnostics reports connection or an actionable warning |
| Hide HUD, then Alt-Tab repeatedly | HUD stays hidden until shown with the hotkey; normal focus updates do not restore it |
| Change resolution; try 100%/150% DPI and fullscreen/borderless | HUD stays inside the game window; mini/debug and service-warning rows are not clipped |
| Move desktop window to second monitor | Window remains usable and preserves placement after reopening |
| Open/close diagnostics during updates | Latest values appear on opening; closing does not stop event collection |
| Enable handoff and enter your nickname/platform, then finish one match | Exactly one summary per session; a second match-end notification does not duplicate it |
| Disconnect network before match end, then restore it | Queue stays pending, retries after backoff, and clears on success; the next session can still send |
| Turn handoff off during backoff | No new send begins while off; queue remains available after enabling again |
| Open session history | Browser opens the BGMS session view; a real official match ID is needed for replay linking |

Record actual `me`, `roster`, `knockedout`, `match_id`, `rank`, `map`, `headshots`, and `max_kill_distance` payload observations in `phase-0-1-validation.md`. A browser mock cannot prove that PUBG emits these fields.

## Performance evidence to record on Windows

Record the exact commit (`git rev-parse --short HEAD`), Overwolf version, PUBG version, CPU/GPU, game resolution, DPI and graphics settings. Compare the same replay/training route with the app off, HUD only, and HUD plus desktop diagnostics. After a warm-up, capture at least three comparable runs and record median FPS, 1% low FPS, and the app process CPU/memory. Also keep the app open across several matches to check memory growth.

The automated tests prove fewer redundant operations and reliable queue recovery. They do not measure game FPS, native window behavior, real GEP delivery or OPK approval.

## Before a public listing

Complete real PUBG tests above, prepare an actual gameplay screenshot with the HUD, validate the OPK using the Windows developer workflow, and finish the Overwolf Developer Console review. The support/FAQ page and store assets must also be checked. See [release readiness](release-readiness.md) for the current evidence and remaining gates.
