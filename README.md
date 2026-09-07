# BGMS Companion

BGMS Companion is an Overwolf runtime for a compact PUBG overlay and an opt-in post-match handoff to BGMS.

## Windows quick start

Install Git and Node.js 24 LTS first. No dependency installation is required.

```powershell
git clone --branch main https://github.com/ka6865/BGMS-overwolf.git
cd BGMS-overwolf
npm run verify
```

`npm run verify` runs the app tests, validates the manifest and runtime references, and stages an unpacked runtime at `dist/bgms-companion`. In Overwolf, load that directory as an unpacked app for Windows testing.

The staging directory is not an OPK or a release archive. Account and game whitelisting in the Overwolf Developer Console, plus live Windows and PUBG testing, are still required before any public release.

See [the app guide](overwolf-app/README.md), [official API notes](overwolf-app/docs/official-api-notes.md), and [the live validation checklist](overwolf-app/docs/phase-0-1-validation.md) for detailed setup and verification.

For an existing checkout: `git switch main`, `git pull --ff-only origin main`, then `npm run verify`. Close and reload the Overwolf extension after rebuilding. See the [Windows test guide](overwolf-app/docs/windows-test-guide.md) and [release readiness report](overwolf-app/docs/release-readiness.md).
