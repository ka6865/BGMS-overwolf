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
    gepStatus: "preview"
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
