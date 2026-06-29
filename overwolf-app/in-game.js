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
  var lastState = previewState;

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
    var t = window.bgmsI18n.translate;
    var matchLabel = state.matchEnded
      ? t("matchEnded")
      : state.matchStartedAt
        ? t("liveMatch")
        : t("waitingForPubg");

    lastState = state;

    elements.matchState.textContent = matchLabel;
    elements.phase.textContent = state.phase || t("idle");
    elements.kills.textContent = String(state.kills || 0);
    elements.alive.textContent = state.alivePlayers === null || state.alivePlayers === undefined ? "--" : String(state.alivePlayers);
    elements.health.textContent = state.health === null || state.health === undefined ? "--" : String(state.health);
    elements.weaponState.textContent = state.weaponState || t("weaponUnknown");
    elements.lastEvent.textContent = state.lastEvent || t("noLiveEvents");
    elements.debugGep.textContent = t("gep") + " " + (state.gepStatus || "idle");
    elements.debugGame.textContent = t("game") + " " + (state.detectedGameId || "--") + " / " + (state.detectedGameRunning ? t("run") : t("off"));
    elements.debugLast.textContent = t("last") + " " + (state.lastFeature || "-") + ":" + (state.lastKey || state.lastGepEventName || "-");
    elements.debugRaw.textContent = t("raw") + " " + (state.lastRawValue || "--");
    elements.debugRecent.textContent = t("recent") + " " + ((state.recentUpdates || []).join(" | ") || "--");
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
  window.bgmsI18n.applyTranslations(document);
  render(previewState);
  subscribeToController();

  window.addEventListener("storage", function (event) {
    if (event.key === "bgms_companion_language") {
      window.bgmsI18n.applyTranslations(document);
      render(lastState);
    }
  });

  window.addEventListener("bgms:language-change", function () {
    window.bgmsI18n.applyTranslations(document);
    render(lastState);
  });

  window.addEventListener("beforeunload", function () {
    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  });
})();
