"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const APP_ROOT = path.resolve(__dirname, "..");
const EXPECTED_PERMISSIONS = ["GameInfo", "GameEvents", "Hotkeys"];
const EXPECTED_FEATURES = [
  "match",
  "match_info",
  "phase",
  "kill",
  "death",
  "revived",
  "killer",
  "roster",
  "me",
  "rank",
  "map"
];
const HTML_REFERENCE_PATTERN = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
const CSS_REFERENCE_PATTERN = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;

function fail(message) {
  throw new Error(message);
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(`Cannot read ${filePath}: ${error.message}`);
  }
}

function resolveLocalReference(root, owner, reference) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference)) {
    return null;
  }

  const resolved = path.resolve(path.dirname(owner), reference.split(/[?#]/, 1)[0]);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`${path.relative(root, owner)} references a file outside the runtime root: ${reference}`);
  }

  if (!fs.statSync(resolved, { throwIfNoEntry: false })?.isFile()) {
    fail(`${path.relative(root, owner)} references a missing local file: ${reference}`);
  }
  return resolved;
}

function referencesIn(content, pattern) {
  const references = [];
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(content))) {
    references.push(match[1]);
  }
  return references;
}

function validateLocalDependencies(root, manifest) {
  const manifestReferences = [manifest.meta.icon, manifest.meta.icon_gray];
  for (const windowConfig of Object.values(manifest.data.windows)) {
    manifestReferences.push(windowConfig.file);
  }

  const htmlFiles = new Set();
  for (const reference of manifestReferences) {
    const resolved = resolveLocalReference(root, path.join(root, "manifest.json"), reference);
    if (resolved.endsWith(".html")) {
      htmlFiles.add(resolved);
    }
  }

  for (const htmlFile of htmlFiles) {
    for (const reference of referencesIn(readFile(htmlFile), HTML_REFERENCE_PATTERN)) {
      const resolved = resolveLocalReference(root, htmlFile, reference);
      if (resolved?.endsWith(".css")) {
        for (const cssReference of referencesIn(readFile(resolved), CSS_REFERENCE_PATTERN)) {
          resolveLocalReference(root, resolved, cssReference);
        }
      }
    }
  }
}

function validateManifest(root) {
  const manifestPath = path.join(root, "manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(readFile(manifestPath));
  } catch (error) {
    fail(`manifest.json is not valid JSON: ${error.message}`);
  }

  const packageJson = JSON.parse(readFile(path.join(APP_ROOT, "..", "package.json")));
  if (manifest.meta?.version !== packageJson.version) {
    fail(`Version mismatch: package.json is ${packageJson.version}, manifest.json is ${manifest.meta?.version || "missing"}`);
  }

  if (JSON.stringify(manifest.permissions) !== JSON.stringify(EXPECTED_PERMISSIONS)) {
    fail(`Manifest permissions changed. Expected: ${EXPECTED_PERMISSIONS.join(", ")}`);
  }

  return manifest;
}

function validateFeatureList(root) {
  const source = readFile(path.join(root, "gep-state.js"));
  const match = source.match(/var\s+REQUIRED_FEATURES\s*=\s*\[([\s\S]*?)\];/);
  if (!match) {
    fail("Could not find REQUIRED_FEATURES in gep-state.js");
  }
  const features = Array.from(match[1].matchAll(/["']([^"']+)["']/g), (entry) => entry[1]);
  if (JSON.stringify(features) !== JSON.stringify(EXPECTED_FEATURES)) {
    fail(`GEP feature list changed. Expected: ${EXPECTED_FEATURES.join(", ")}`);
  }
}

function validateJavaScript(root) {
  const javaScriptFiles = fs.readdirSync(root, { recursive: true })
    .filter((entry) => entry.endsWith(".js"))
    .map((entry) => path.join(root, entry));

  for (const filePath of javaScriptFiles) {
    const result = spawnSync(process.execPath, ["--check", filePath], { encoding: "utf8" });
    if (result.status !== 0) {
      fail(`JavaScript syntax check failed for ${path.relative(root, filePath)}:\n${result.stderr || result.stdout}`);
    }
  }
}

function validateRuntime(root = APP_ROOT) {
  const manifest = validateManifest(root);
  validateFeatureList(root);
  validateLocalDependencies(root, manifest);
  validateJavaScript(root);
}

if (require.main === module) {
  const runtimeRoot = process.argv[2] ? path.resolve(process.argv[2]) : APP_ROOT;
  try {
    validateRuntime(runtimeRoot);
    console.log(`Runtime validation passed: ${runtimeRoot}`);
  } catch (error) {
    console.error(`Runtime validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { validateRuntime };
