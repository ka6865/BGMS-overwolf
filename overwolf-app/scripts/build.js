"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateRuntime } = require("./validate-runtime");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const APP_ROOT = path.join(PROJECT_ROOT, "overwolf-app");
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "dist", "bgms-companion");
const RUNTIME_FILES = [
  "manifest.json",
  "background.html",
  "background.js",
  "desktop.html",
  "desktop.js",
  "gep-state.js",
  "i18n.js",
  "in-game.html",
  "in-game.js",
  "session-queue.js",
  "settings.js",
  "styles.css",
  "assets/IconMouseNormal.png",
  "assets/IconMouseOver.png",
  "assets/Tile.jpg",
  "assets/bgms-icon-gray.png",
  "assets/bgms-icon-gray.svg",
  "assets/bgms-icon.png",
  "assets/bgms-icon.svg",
  "assets/bgms-pattern.svg",
  "assets/desktop-icon.ico"
];

function copyRuntimeFile(relativePath) {
  const source = path.join(APP_ROOT, relativePath);
  const destination = path.join(OUTPUT_ROOT, relativePath);
  if (!fs.statSync(source, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Allowlisted runtime file is missing: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

try {
  validateRuntime(APP_ROOT);
  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  for (const filePath of RUNTIME_FILES) {
    copyRuntimeFile(filePath);
  }
  validateRuntime(OUTPUT_ROOT);
  console.log(`Staged ${RUNTIME_FILES.length} runtime files in ${path.relative(PROJECT_ROOT, OUTPUT_ROOT)}`);
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
}
