/*
 * 오버레이/데스크탑 UI의 불필요한 DOM 쓰기 회귀 테스트.
 * 실제 브라우저 없이 작은 DOM 모사로 구독 렌더링과 창 종료 정리를 확인한다.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appDir = path.join(__dirname, "..");

function createClassList(initial) {
  const values = new Set(initial || []);

  return {
    add: function (name) {
      values.add(name);
    },
    contains: function (name) {
      return values.has(name);
    },
    toggle: function (name, force) {
      const enabled = arguments.length > 1 ? force : !values.has(name);

      if (enabled) {
        values.add(name);
      } else {
        values.delete(name);
      }

      return enabled;
    }
  };
}

function createElement(initialClasses) {
  let text = "";
  const listeners = {};

  return {
    classList: createClassList(initialClasses),
    parentElement: null,
    open: false,
    value: "",
    checked: false,
    textWrites: 0,
    addEventListener: function (name, listener) {
      (listeners[name] || (listeners[name] = [])).push(listener);
    },
    emit: function (name, event) {
      (listeners[name] || []).forEach(function (listener) {
        listener(event || { target: this });
      }, this);
    },
    getAttribute: function () {
      return null;
    },
    setAttribute: function () {},
    closest: function () {
      return null;
    },
    get textContent() {
      return text;
    },
    set textContent(value) {
      text = String(value);
      this.textWrites += 1;
    }
  };
}

function createDocument(ids) {
  const elements = {};

  ids.forEach(function (id) {
    elements[id] = createElement();
  });

  return {
    elements: elements,
    documentElement: { style: { setProperty: function () {} } },
    body: { setAttribute: function () {} },
    getElementById: function (id) {
      return elements[id] || null;
    },
    querySelectorAll: function () {
      return [];
    }
  };
}

function createWindowListeners(target) {
  const listeners = {};

  target.addEventListener = function (name, listener) {
    (listeners[name] || (listeners[name] = [])).push(listener);
  };
  target.emitWindowEvent = function (name, event) {
    (listeners[name] || []).forEach(function (listener) {
      listener(event || {});
    });
  };
}

function loadScript(sandbox, relativePath) {
  vm.runInContext(fs.readFileSync(path.join(appDir, relativePath), "utf8"), sandbox, {
    filename: relativePath
  });
}

function createController() {
  let subscriber = null;
  let hotkeyReads = 0;
  let assignedHotkeys = { toggle_overlay: "Ctrl+Alt+B", open_desktop: "Ctrl+Alt+G" };

  return {
    subscribe: function (listener) {
      subscriber = listener;
      return function () {};
    },
    emit: function (state) {
      subscriber(state);
    },
    getAssignedHotkeys: function (callback) {
      hotkeyReads += 1;
      callback(assignedHotkeys);
    },
    setAssignedHotkeys: function (next) {
      assignedHotkeys = next;
    },
    hotkeyReads: function () {
      return hotkeyReads;
    }
  };
}

function createHotkeyHub() {
  const listeners = [];

  return {
    addListener: function (listener) {
      listeners.push(listener);
    },
    removeListener: function (listener) {
      const index = listeners.indexOf(listener);

      if (index !== -1) {
        listeners.splice(index, 1);
      }
    },
    emit: function () {
      listeners.slice().forEach(function (listener) {
        listener({ name: "toggle_overlay", binding: "Ctrl+Alt+B" });
      });
    },
    count: function () {
      return listeners.length;
    }
  };
}

function createI18n(overlayMode) {
  let settings = { opacity: 1, mode: overlayMode || "minimal", position: "top-left" };

  return {
    applyTranslations: function () {},
    translate: function (key) {
      return key === "hotkeyUnassigned" ? "Unassigned" : key;
    },
    getLanguage: function () {
      return "en";
    },
    setLanguage: function () {},
    getOverlaySettings: function () {
      return settings;
    },
    setOverlaySettings: function (next) {
      settings = next;
      return settings;
    }
  };
}

function createSettings() {
  return {
    STORAGE_KEY: "settings",
    read: function () {
      return { handoffEnabled: false, playerName: "", platform: "steam" };
    },
    write: function (settings) {
      return settings;
    },
    canSendHandoff: function () {
      return false;
    }
  };
}

function createState(lastEvent) {
  return {
    gepStatus: "connected",
    serviceStatusState: 1,
    serviceStatusMessage: "",
    detectedClassId: 10906,
    detectedGameId: 109061,
    detectedGameRunning: true,
    effectiveMatchId: "match-id",
    lastEvent: lastEvent,
    recentUpdates: ["info:phase:phase"],
    seenInfoFeatures: { game_info: true },
    supportedFeatures: ["match", "phase"],
    ignoredUpdates: [],
    gepLocalVersion: "135.0",
    gepPublicVersion: "135.0",
    gepErrorReason: "",
    handoffPending: 0,
    handoffOutcome: "idle",
    lastRequiredFeaturesResult: "ok",
    phase: "landed",
    headshots: 2,
    maxKillDistance: 143.5,
    rankPlace: null,
    rankTotal: null,
    knocked: false,
    weaponState: "Ready",
    matchStartedAt: "2026-09-07T00:00:00.000Z",
    matchEnded: false,
    lastInfoReceivedAt: "2026-09-07T00:00:00.000Z",
    lastFeature: "phase",
    lastKey: "phase",
    lastRawValue: "landed",
    lastGepEventName: ""
  };
}

function createOverlaySandbox() {
  const controller = createController();
  const document = createDocument([
    "match-state", "phase", "headshots", "headshot-item", "longest-kill", "longest-item",
    "rank-place", "rank-item", "knocked-flag", "weapon-state", "last-event", "service-warning",
    "handoff-indicator", "debug-gep", "debug-game", "debug-last", "debug-raw", "debug-recent",
    "debug-service", "debug-error"
  ]);
  const debugPanel = createElement(["is-hidden"]);
  const sandbox = {
    document: document,
    bgmsI18n: createI18n("minimal"),
    bgmsGepState: { isServiceDegraded: function () { return false; } },
    overwolf: { windows: { getMainWindow: function () { return { bgmsController: controller }; } } },
    CustomEvent: function () {}
  };

  document.elements["debug-gep"].parentElement = debugPanel;
  createWindowListeners(sandbox);
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  loadScript(sandbox, "in-game.js");

  return { sandbox: sandbox, controller: controller, document: document, debugPanel: debugPanel };
}

function createDesktopSandbox() {
  const controller = createController();
  const hotkeyHub = createHotkeyHub();
  const document = createDocument([
    "overlay-opacity", "overlay-opacity-value", "handoff-enabled", "handoff-player-name",
    "handoff-retry", "open-session-history", "desktop-drag-handle", "desktop-close", "desktop-refresh",
    "edit-hotkeys", "onboarding", "onboarding-step-1", "open-community", "open-discord",
    "handoff-status", "diagnostics-disclosure", "diagnostics-hint", "desktop-gep-status",
    "desktop-service-status", "desktop-game-status", "desktop-match-id", "desktop-last-event",
    "desktop-recent-updates", "desktop-seen-features", "desktop-supported-features",
    "desktop-missing-updates", "desktop-ignored-updates", "desktop-gep-version", "desktop-gep-error",
    "desktop-handoff", "desktop-required-result", "hotkey-toggle-overlay", "hotkey-open-desktop"
  ]);
  const sandbox = {
    document: document,
    bgmsI18n: createI18n(),
    bgmsSettings: createSettings(),
    bgmsGepState: { isServiceDegraded: function () { return false; } },
    overwolf: {
      windows: { getMainWindow: function () { return { bgmsController: controller }; } },
      settings: { hotkeys: { onChanged: hotkeyHub } }
    }
  };

  createWindowListeners(sandbox);
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  loadScript(sandbox, "desktop.js");

  return { sandbox: sandbox, controller: controller, document: document, hotkeyHub: hotkeyHub };
}

function resetTextWrites(document) {
  Object.keys(document.elements).forEach(function (id) {
    document.elements[id].textWrites = 0;
  });
}

test("overlay skips hidden debug updates and avoids repeated text writes", () => {
  const ui = createOverlaySandbox();
  const state = createState("phase changed");

  resetTextWrites(ui.document);
  ui.controller.emit(state);
  assert.equal(ui.document.elements["debug-raw"].textWrites, 0);

  resetTextWrites(ui.document);
  ui.controller.emit(state);
  assert.equal(Object.values(ui.document.elements).reduce(function (total, element) {
    return total + element.textWrites;
  }, 0), 0);

  ui.sandbox.bgmsI18n.setOverlaySettings({ opacity: 1, mode: "debug", position: "top-left" });
  ui.sandbox.emitWindowEvent("bgms:overlay-settings-change");
  assert.equal(ui.document.elements["debug-raw"].textContent, "raw landed");
});

test("desktop defers collapsed diagnostics until disclosure opens with the latest state", () => {
  const ui = createDesktopSandbox();
  const disclosure = ui.document.elements["diagnostics-disclosure"];

  resetTextWrites(ui.document);
  ui.controller.emit(createState("old event"));
  ui.controller.emit(createState("latest event"));
  assert.equal(ui.document.elements["desktop-last-event"].textWrites, 0);

  disclosure.open = true;
  disclosure.emit("toggle");
  assert.equal(ui.document.elements["desktop-last-event"].textContent, "latest event");

  resetTextWrites(ui.document);
  ui.controller.emit(createState("latest event"));
  assert.equal(Object.values(ui.document.elements).reduce(function (total, element) {
    return total + element.textWrites;
  }, 0), 0);
});

test("desktop removes the hotkey change listener when its window unloads", () => {
  const ui = createDesktopSandbox();
  const initialReads = ui.controller.hotkeyReads();

  assert.equal(ui.hotkeyHub.count(), 1);
  ui.hotkeyHub.emit();
  assert.equal(ui.controller.hotkeyReads(), initialReads + 1);

  ui.sandbox.emitWindowEvent("beforeunload");
  assert.equal(ui.hotkeyHub.count(), 0);
  ui.hotkeyHub.emit();
  assert.equal(ui.controller.hotkeyReads(), initialReads + 1);
});

test("desktop shows an explicit unassigned hotkey without hiding it behind the manifest default", () => {
  const ui = createDesktopSandbox();

  ui.controller.setAssignedHotkeys({ toggle_overlay: "", open_desktop: "Ctrl+Alt+G" });
  ui.hotkeyHub.emit();
  assert.equal(ui.document.elements["hotkey-toggle-overlay"].textContent, "Unassigned");
  assert.equal(ui.document.elements["hotkey-open-desktop"].textContent, "Ctrl+Alt+G");

  ui.controller.setAssignedHotkeys(null);
  ui.hotkeyHub.emit();
  assert.equal(ui.document.elements["hotkey-toggle-overlay"].textContent, "Ctrl+Shift+B");
});
