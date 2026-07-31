(function () {
  "use strict";

  var previewState = {
    phase: "Preview",
    kills: 2,
    alivePlayers: null,
    health: 74,
    koHealth: 100,
    knocked: false,
    weaponState: "Ready",
    lastEvent: "Preview mode",
    matchStartedAt: new Date().toISOString(),
    matchEnded: false,
    gepStatus: "preview",
    gepErrorReason: "",
    serviceStatusState: 1,
    serviceStatusMessage: "",
    detectedGameId: 109061,
    detectedClassId: 10906,
    detectedGameRunning: true,
    lastFeature: "me",
    lastKey: "health",
    lastRawValue: "{\"health\":74,\"ko_health\":100}",
    lastGepEventName: "",
    recentUpdates: ["info:me:health"],
    ignoredUpdates: []
  };

  var elements = {};
  var unsubscribe = null;
  var lastState = previewState;

  function queryElements() {
    elements.matchState = document.getElementById("match-state");
    elements.phase = document.getElementById("phase");
    elements.kills = document.getElementById("kills");
    elements.alive = document.getElementById("alive");
    elements.aliveItem = document.getElementById("alive-item");
    elements.health = document.getElementById("health");
    elements.healthItem = document.getElementById("health-item");
    elements.knockedFlag = document.getElementById("knocked-flag");
    elements.weaponState = document.getElementById("weapon-state");
    elements.lastEvent = document.getElementById("last-event");
    elements.serviceWarning = document.getElementById("service-warning");
    elements.handoffIndicator = document.getElementById("handoff-indicator");
    elements.debugGep = document.getElementById("debug-gep");
    elements.debugGame = document.getElementById("debug-game");
    elements.debugLast = document.getElementById("debug-last");
    elements.debugRaw = document.getElementById("debug-raw");
    elements.debugRecent = document.getElementById("debug-recent");
    elements.debugService = document.getElementById("debug-service");
    elements.debugError = document.getElementById("debug-error");
  }

  function applyOverlaySettings() {
    var settings = window.bgmsI18n.getOverlaySettings();

    document.documentElement.style.setProperty("--overlay-opacity", String(settings.opacity));
    document.body.setAttribute("data-overlay-mode", settings.mode);

    if (elements.debugGep) {
      elements.debugGep.parentElement.classList.toggle("is-hidden", settings.mode !== "debug");
    }
  }

  // 공식 status code: 0 unsupported, 1 green, 2 yellow, 3 red
  function translateServiceStatus(statusState) {
    var t = window.bgmsI18n.translate;

    if (statusState === 0) {
      return t("statusUnsupported");
    }

    if (statusState === 1) {
      return t("statusGood");
    }

    if (statusState === 2) {
      return t("statusPartial");
    }

    if (statusState === 3) {
      return t("statusDown");
    }

    return t("statusUnknown");
  }

  function setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  }

  /*
   * GEP phase 원본 값은 loading_screen 처럼 길어서 좁은 HUD 에서 잘린다.
   * 표시용으로만 짧은 라벨로 바꾸고, 원본 값은 디버그 패널의 Last/Raw 에 그대로 남긴다.
   * 공식 목록에 없는 값(관측된 starting 등)은 원본을 그대로 보여준다.
   */
  var PHASE_LABEL_KEYS = {
    lobby: "phaseLobby",
    loading_screen: "phaseLoadingScreen",
    airfield: "phaseAirfield",
    aircraft: "phaseAircraft",
    freefly: "phaseFreefly",
    landed: "phaseLanded",
    starting: "phaseStarting"
  };

  function translatePhase(phase) {
    var t = window.bgmsI18n.translate;
    var key = phase ? PHASE_LABEL_KEYS[String(phase).toLowerCase()] : null;

    return key ? t(key) : phase;
  }

  function toggleHidden(element, hidden) {
    if (element) {
      element.classList.toggle("is-hidden", hidden);
    }
  }

  function render(state) {
    var t = window.bgmsI18n.translate;
    var matchLabel = state.matchEnded
      ? t("matchEnded")
      : state.matchStartedAt
        ? t("liveMatch")
        : state.detectedGameRunning
          ? t("waitingForMatch")
          : t("waitingForPubg");
    var phaseLabel = state.phase ? translatePhase(state.phase) : t("idle");
    var hasAlive = state.alivePlayers !== null && state.alivePlayers !== undefined;
    var hasHealth = state.health !== null && state.health !== undefined;
    // 경고 판정은 리듀서와 background 창 높이 계산이 같은 기준을 쓰도록 gep-state 에 둔다.
    var isDegraded = window.bgmsGepState
      ? window.bgmsGepState.isServiceDegraded(state)
      : state.serviceStatusState === 2 || state.serviceStatusState === 3
        || state.gepStatus === "error" || state.gepStatus === "unavailable";

    // 연결은 됐지만 아직 info 가 한 건도 안 온 상태를 구분한다.
    // 번역 결과와 비교하면 한국어에서 깨지므로 리듀서의 원본 phase 값으로 판단한다.
    if (state.gepStatus === "connected" && !state.lastInfoReceivedAt && state.phase === "Idle") {
      phaseLabel = t("sync");
    }

    lastState = state;

    setText(elements.matchState, matchLabel);
    setText(elements.phase, phaseLabel);
    setText(elements.kills, String(state.kills || 0));
    setText(elements.alive, hasAlive ? String(state.alivePlayers) : "--");
    setText(elements.health, hasHealth ? String(state.health) : "--");
    toggleHidden(elements.aliveItem, !hasAlive);
    toggleHidden(elements.healthItem, !hasHealth);
    toggleHidden(elements.knockedFlag, !state.knocked);
    setText(elements.weaponState, state.weaponState || t("weaponUnknown"));
    setText(elements.lastEvent, state.lastEvent || t("noLiveEvents"));

    toggleHidden(elements.serviceWarning, !isDegraded);
    setText(elements.serviceWarning, isDegraded
      ? translateServiceStatus(state.serviceStatusState) + (state.gepErrorReason ? " / " + state.gepErrorReason : "")
      : "");

    // 전송 대기 중인 세션 요약이 있을 때만 표시한다. 정상 흐름에서는 노출하지 않는다.
    var hasPendingHandoff = Number(state.handoffPending) > 0;

    toggleHidden(elements.handoffIndicator, !hasPendingHandoff);
    setText(elements.handoffIndicator, hasPendingHandoff
      ? t("handoffPending") + " " + String(state.handoffPending)
      : "");

    setText(elements.debugGep, t("gep") + " " + (state.gepStatus || "idle"));
    setText(elements.debugGame, t("game") + " " + (state.detectedClassId || "--") + " (" + (state.detectedGameId || "--") + ") / " + (state.detectedGameRunning ? t("run") : t("off")));
    setText(elements.debugLast, t("last") + " " + (state.lastFeature || "-") + ":" + (state.lastKey || state.lastGepEventName || "-"));
    setText(elements.debugRaw, t("raw") + " " + (state.lastRawValue || "--"));
    setText(elements.debugRecent, t("recent") + " " + ((state.recentUpdates || []).join(" | ") || "--"));
    setText(elements.debugService, t("serviceStatusLabel") + " " + translateServiceStatus(state.serviceStatusState));
    setText(elements.debugError, t("gepErrorLabel") + " " + (state.gepErrorReason || "--"));
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
  applyOverlaySettings();
  render(previewState);
  subscribeToController();

  window.addEventListener("storage", function (event) {
    if (event.key === "bgms_companion_language") {
      window.bgmsI18n.applyTranslations(document);
      render(lastState);
    }

    if (event.key === "bgms_companion_overlay_settings") {
      applyOverlaySettings();
    }
  });

  window.addEventListener("bgms:language-change", function () {
    window.bgmsI18n.applyTranslations(document);
    render(lastState);
  });

  window.addEventListener("bgms:overlay-settings-change", applyOverlaySettings);

  window.addEventListener("beforeunload", function () {
    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  });
})();
