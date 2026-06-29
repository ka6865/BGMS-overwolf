(function () {
  "use strict";

  var previewState = {
    phase: "Preview",
    kills: 2,
    alivePlayers: null,
    health: 74,
    weaponState: "Ready",
    lastEvent: "Preview mode",
    matchStartedAt: new Date().toISOString(),
    matchEnded: false,
    gepStatus: "preview",
    detectedGameId: 10906,
    detectedGameRunning: true,
    lastFeature: "me",
    lastKey: "health",
    lastRawValue: "{\"health\":74}",
    lastGepEventName: "",
    recentUpdates: ["info:me:health"]
  };

  var elements = {};
  var unsubscribe = null;

  function queryElements() {
    elements.matchState = document.getElementById("match-state");
    elements.phase = document.getElementById("phase");
    elements.kills = document.getElementById("kills");
    elements.alive = document.getElementById("alive");
    elements.health = document.getElementById("health");
    elements.weaponState = document.getElementById("weapon-state");
    elements.lastEvent = document.getElementById("last-event");
    elements.debugGep = document.getElementById("debug-gep");
    elements.debugGame = document.getElementById("debug-game");
    elements.debugLast = document.getElementById("debug-last");
    elements.debugRaw = document.getElementById("debug-raw");
    elements.debugRecent = document.getElementById("debug-recent");
  }

  function render(state) {
    var matchLabel = state.matchEnded
      ? "Match ended"
      : state.matchStartedAt
        ? "Live match"
        : "Waiting for PUBG";

    elements.matchState.textContent = matchLabel;
    elements.phase.textContent = state.phase || "Idle";
    elements.kills.textContent = String(state.kills || 0);
    elements.alive.textContent = state.alivePlayers === null || state.alivePlayers === undefined ? "--" : String(state.alivePlayers);
    elements.health.textContent = state.health === null || state.health === undefined ? "--" : String(state.health);
    elements.weaponState.textContent = state.weaponState || "Weapon state unknown";
    elements.lastEvent.textContent = state.lastEvent || "No live events yet";
    elements.debugGep.textContent = "GEP " + (state.gepStatus || "idle");
    elements.debugGame.textContent = "Game " + (state.detectedGameId || "--") + " / " + (state.detectedGameRunning ? "run" : "off");
    elements.debugLast.textContent = "Last " + (state.lastFeature || "-") + ":" + (state.lastKey || state.lastGepEventName || "-");
    elements.debugRaw.textContent = "Raw " + (state.lastRawValue || "--");
    elements.debugRecent.textContent = "Recent " + ((state.recentUpdates || []).join(" | ") || "--");
  }

  function subscribeToController() {
    if (typeof overwolf === "undefined" || !overwolf.windows || !overwolf.windows.getMainWindow) {
      render(previewState);
      return;
    }

    var mainWindow = overwolf.windows.getMainWindow();
    var controller = mainWindow && mainWindow.bgmsController;

    if (!controller || typeof controller.subscribe !== "function") {
      render(previewState);
      return;
    }

    unsubscribe = controller.subscribe(render);
  }

  queryElements();
  render(previewState);
  subscribeToController();

  window.addEventListener("beforeunload", function () {
    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  });
})();
