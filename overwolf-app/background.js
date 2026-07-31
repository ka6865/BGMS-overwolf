/*
 * BGMS Companion - background controller
 *
 * 역할:
 *  - PUBG 실행 감지 (game id -> class id 환산)
 *  - GEP 구독(setRequiredFeatures) 및 재시도
 *  - GEP payload를 gep-state.js 리듀서에 위임
 *  - 오버레이/데스크탑 창 제어와 상태 브로드캐스트
 *
 * 공식 문서 기준:
 *  - setRequiredFeatures는 background controller에서만 호출하고 success까지 재시도한다.
 *  - onInfoUpdates2/onNewEvents는 중복 리스너 방지를 위해 remove 후 add한다.
 *  - GEP 장애는 사용자에게 알린다(game events status 엔드포인트).
 */
(function () {
  "use strict";

  var gepState = window.bgmsGepState;

  var IN_GAME_WINDOW = "in_game";
  var DESKTOP_WINDOW = "desktop";

  // 서버 수신 엔드포인트가 승인/구현될 때까지 비워 둔다. 비어 있으면 전송을 시도하지 않는다.
  var SESSION_ENDPOINT = "";

  var REQUIRED_FEATURES = gepState.REQUIRED_FEATURES;
  var MAX_FEATURE_ATTEMPTS = 8;
  var RETRY_DELAY_MS = 3000;
  var MAX_SUMMARY_ATTEMPTS = 3;
  var SUMMARY_RETRY_DELAY_MS = 5000;
  var STATUS_ENDPOINT_TEMPLATE = "https://game-events-status.overwolf.com/{gameId}_prod.json";

  var OVERLAY_WIDTH = 348;
  var OVERLAY_MINI_HEIGHT = 78;
  var OVERLAY_DEBUG_HEIGHT = 236;

  var overlayVisible = false;
  var pubgRunning = false;
  var gepAttemptToken = 0;
  var gepListenersRegistered = false;
  var requiredFeaturesActive = false;
  var requiredFeaturesInFlight = false;
  var subscribers = [];
  var lastGameInfo = null;
  var desktopVisible = false;
  var desktopDismissed = false;
  var appVersion = "0.0.0";
  var snapshotTimer = null;

  var state = gepState.createInitialState();

  var infoUpdatesListener = function (event) {
    setState(gepState.reduceInfoUpdatesEvent(state, event));
  };

  var newEventsListener = function (event) {
    var nextState = gepState.reduceNewEventsEvent(state, event);

    setState(nextState);

    if (nextState.summaryReady && !nextState.summarySent) {
      sendSessionSummary(1);
    }
  };

  var gepErrorListener = function (event) {
    setState(gepState.reduceGepError(state, event));
  };

  function hasBaseOverwolfApi() {
    return typeof overwolf !== "undefined" && overwolf.windows && overwolf.games;
  }

  function hasGepApi() {
    return hasBaseOverwolfApi() && overwolf.games.events;
  }

  function cloneState() {
    return JSON.parse(JSON.stringify(state));
  }

  function notifySubscribers() {
    var snapshot = cloneState();

    subscribers = subscribers.filter(function (callback) {
      try {
        callback(snapshot);
        return true;
      } catch (_error) {
        return false;
      }
    });
  }

  function setState(nextState) {
    state = nextState;
    notifySubscribers();
  }

  function patchState(partial) {
    var nextState = JSON.parse(JSON.stringify(state));

    Object.keys(partial).forEach(function (key) {
      nextState[key] = partial[key];
    });

    setState(nextState);
  }

  function getCurrentWindow(callback) {
    overwolf.windows.getCurrentWindow(function (result) {
      callback(result && result.window);
    });
  }

  function showWindow(windowName) {
    overwolf.windows.obtainDeclaredWindow(windowName, function (result) {
      if (!result || result.status !== "success") {
        return;
      }

      overwolf.windows.restore(result.window.id, function () {
        if (overwolf.windows.bringToFront) {
          overwolf.windows.bringToFront(result.window.id, function () {});
        }
      });
    });
  }

  function closeWindow(windowName) {
    overwolf.windows.obtainDeclaredWindow(windowName, function (result) {
      if (!result || result.status !== "success") {
        return;
      }

      overwolf.windows.close(result.window.id, function () {});
    });
  }

  function setOverlayVisible(nextVisible) {
    overlayVisible = nextVisible;

    if (overlayVisible) {
      showWindow(IN_GAME_WINDOW);
      applyOverlaySettings();
      return;
    }

    closeWindow(IN_GAME_WINDOW);
  }

  function handleGameInfo(gameInfo) {
    var classId = gepState.resolveClassId(gameInfo);

    if (gepState.isPubgGameInfo(gameInfo)) {
      pubgRunning = true;
      lastGameInfo = gameInfo;
      patchState({
        detectedGameId: gameInfo.id || null,
        detectedClassId: classId,
        detectedGameRunning: true
      });
      fetchServiceStatus(classId);
      ensureGepSubscription();
      setOverlayVisible(true);
      return;
    }

    if (gameInfo) {
      lastGameInfo = gameInfo;
    }

    resetGepRuntimeState(gameInfo ? gameInfo.id || null : null, classId, Boolean(gameInfo && gameInfo.isRunning));
    setOverlayVisible(false);
  }

  function resetGepRuntimeState(detectedGameId, detectedClassId, detectedGameRunning) {
    pubgRunning = false;
    gepAttemptToken += 1;
    requiredFeaturesActive = false;
    requiredFeaturesInFlight = false;

    if (snapshotTimer) {
      window.clearTimeout(snapshotTimer);
      snapshotTimer = null;
    }

    setState(gepState.createInitialState({
      detectedGameId: detectedGameId,
      detectedClassId: detectedClassId,
      detectedGameRunning: detectedGameRunning,
      serviceStatusState: state.serviceStatusState,
      serviceStatusMessage: state.serviceStatusMessage,
      gepStatus: "idle",
      lastEvent: "Waiting for PUBG"
    }));
  }

  function openDesktopWindow() {
    desktopVisible = true;
    desktopDismissed = false;
    showWindow(DESKTOP_WINDOW);
  }

  function closeDesktopWindow() {
    desktopVisible = false;
    desktopDismissed = true;
    closeWindow(DESKTOP_WINDOW);
  }

  function toggleDesktopWindow() {
    if (desktopVisible) {
      closeDesktopWindow();
      return;
    }

    openDesktopWindow();
  }

  function getOverlaySettings() {
    if (!window.bgmsI18n || typeof window.bgmsI18n.getOverlaySettings !== "function") {
      return {
        mode: "mini",
        opacity: 1,
        position: "top-left"
      };
    }

    return window.bgmsI18n.getOverlaySettings();
  }

  function getGameWidth() {
    if (!lastGameInfo) {
      return 1920;
    }

    return lastGameInfo.logicalWidth || lastGameInfo.width || lastGameInfo.screenWidth || 1920;
  }

  function getOverlayPosition(position) {
    var width = getGameWidth();

    if (position === "top-center") {
      return {
        left: Math.max(24, Math.round((width - OVERLAY_WIDTH) / 2)),
        top: 28
      };
    }

    if (position === "top-right") {
      return {
        left: Math.max(24, width - OVERLAY_WIDTH - 24),
        top: 28
      };
    }

    return {
      left: 24,
      top: 28
    };
  }

  function applyOverlaySettings(settings) {
    var nextSettings = settings || getOverlaySettings();

    if (!overwolf.windows.getWindow || !overwolf.windows.changePosition) {
      return;
    }

    overwolf.windows.getWindow(IN_GAME_WINDOW, function (result) {
      var position = getOverlayPosition(nextSettings.position);
      var nextHeight = nextSettings.mode === "debug" ? OVERLAY_DEBUG_HEIGHT : OVERLAY_MINI_HEIGHT;

      if (!result || result.status !== "success") {
        return;
      }

      if (!overwolf.windows.changeSize) {
        overwolf.windows.changePosition(result.window.id, position.left, position.top, function () {});
        return;
      }

      overwolf.windows.changeSize({
        window_id: result.window.id,
        width: OVERLAY_WIDTH,
        height: nextHeight,
        auto_dpi_resize: true
      }, function () {
        overwolf.windows.changePosition(result.window.id, position.left, position.top, function () {});
      });
    });
  }

  function registerHotkey() {
    if (!overwolf.settings || !overwolf.settings.hotkeys) {
      return;
    }

    overwolf.settings.hotkeys.onPressed.addListener(function (event) {
      if (event && event.name === "toggle_overlay") {
        setOverlayVisible(!overlayVisible);
      }

      if (event && event.name === "open_desktop") {
        toggleDesktopWindow();
      }
    });
  }

  function registerGameListeners() {
    overwolf.games.getRunningGameInfo(function (gameInfo) {
      handleGameInfo(gameInfo);

      if (!gepState.isPubgGameInfo(gameInfo) && !desktopDismissed) {
        openDesktopWindow();
      }
    });

    overwolf.games.onGameInfoUpdated.addListener(function (event) {
      handleGameInfo(event && event.gameInfo);
    });
  }

  // 공식 권장: 리스너는 remove 후 add 해서 중복 등록을 막는다.
  function bindGepListeners() {
    var events = overwolf.games.events;

    if (events.onInfoUpdates2.removeListener) {
      events.onInfoUpdates2.removeListener(infoUpdatesListener);
    }

    if (events.onNewEvents.removeListener) {
      events.onNewEvents.removeListener(newEventsListener);
    }

    if (events.onError && events.onError.removeListener) {
      events.onError.removeListener(gepErrorListener);
    }

    events.onInfoUpdates2.addListener(infoUpdatesListener);
    events.onNewEvents.addListener(newEventsListener);

    if (events.onError) {
      events.onError.addListener(gepErrorListener);
    }

    gepListenersRegistered = true;
  }

  function ensureGepSubscription() {
    if (!hasGepApi()) {
      return;
    }

    if (!gepListenersRegistered) {
      bindGepListeners();
    }

    if (requiredFeaturesActive || requiredFeaturesInFlight) {
      return;
    }

    setRequiredFeatures(1, gepAttemptToken);
  }

  function setRequiredFeatures(attempt, token) {
    if (!pubgRunning || token !== gepAttemptToken) {
      requiredFeaturesInFlight = false;
      return;
    }

    requiredFeaturesInFlight = true;
    patchState({
      gepStatus: "connecting",
      lastEvent: "Connecting to PUBG live events"
    });

    overwolf.games.events.setRequiredFeatures(REQUIRED_FEATURES, function (result) {
      var supported = result && Array.isArray(result.supportedFeatures) ? result.supportedFeatures : [];
      var succeeded = Boolean(result && (result.success === true || result.status === "success")) && supported.length > 0;

      if (!pubgRunning || token !== gepAttemptToken) {
        requiredFeaturesActive = false;
        requiredFeaturesInFlight = false;
        return;
      }

      if (succeeded) {
        requiredFeaturesActive = true;
        requiredFeaturesInFlight = false;
        patchState({
          gepStatus: "connected",
          gepErrorReason: "",
          lastEvent: "Connected, syncing live data",
          supportedFeatures: supported,
          lastRequiredFeaturesResult: gepState.summarizeValue(result)
        });
        refreshGepInfoSnapshot();
        snapshotTimer = window.setTimeout(refreshGepInfoSnapshot, 1500);
        return;
      }

      if (attempt >= MAX_FEATURE_ATTEMPTS) {
        requiredFeaturesActive = false;
        requiredFeaturesInFlight = false;
        patchState({
          gepStatus: "unavailable",
          lastEvent: "Live events unavailable",
          lastRequiredFeaturesResult: gepState.summarizeValue(result)
        });
        return;
      }

      window.setTimeout(function () {
        setRequiredFeatures(attempt + 1, token);
      }, RETRY_DELAY_MS);
    });
  }

  /*
   * getInfo는 현재 세션의 info snapshot을 준다.
   * 공식 GetInfoResult는 res에 담기지만 클라이언트 버전에 따라 info로 오는 경우도 있어 둘 다 처리한다.
   */
  function refreshGepInfoSnapshot() {
    if (!hasGepApi() || typeof overwolf.games.events.getInfo !== "function") {
      return;
    }

    overwolf.games.events.getInfo(function (result) {
      var succeeded = Boolean(result && (result.success === true || result.status === "success"));
      var payloads;

      if (!succeeded) {
        return;
      }

      payloads = [gepState.safeParse(result.res), gepState.safeParse(result.info)];

      payloads.forEach(function (payload) {
        if (!payload || typeof payload !== "object") {
          return;
        }

        setState(gepState.reduceInfoUpdatesEvent(state, {
          info: payload
        }));
      });
    });
  }

  /*
   * 공식 game events status 엔드포인트로 PUBG GEP 서비스 상태를 확인한다.
   * 실패하면 조용히 무시한다(진단 보조 기능이므로 앱 동작을 막지 않는다).
   */
  function fetchServiceStatus(classId) {
    var gameId = classId || gepState.PUBG_CLASS_IDS[0];
    var url = STATUS_ENDPOINT_TEMPLATE.replace("{gameId}", String(gameId));

    if (!window.fetch) {
      return;
    }

    window.fetch(url, {
      method: "GET"
    }).then(function (response) {
      if (!response.ok) {
        return null;
      }

      return response.json();
    }).then(function (payload) {
      if (!payload) {
        return;
      }

      setState(gepState.reduceServiceStatus(state, payload));
    }).catch(function () {
      return;
    });
  }

  function readAppVersion() {
    if (!hasBaseOverwolfApi() || !overwolf.extensions || !overwolf.extensions.current) {
      return;
    }

    overwolf.extensions.current.getManifest(function (manifest) {
      if (manifest && manifest.meta && manifest.meta.version) {
        appVersion = String(manifest.meta.version);
      }
    });
  }

  /*
   * Overwolf 클라이언트 언어를 참고해 기본 언어를 정한다.
   * 공식 API: overwolf.settings.language.get(callback) -> {language: "en", success: true}
   * 사용자가 앱에서 언어를 직접 고른 적이 있으면 그 선택을 덮어쓰지 않는다.
   * 기본값은 영어이고 한국어는 optional localization이다.
   */
  function applyClientLanguage() {
    if (!hasBaseOverwolfApi() || !overwolf.settings || !overwolf.settings.language) {
      return;
    }

    if (!window.bgmsI18n || typeof window.bgmsI18n.hasStoredLanguage !== "function") {
      return;
    }

    if (window.bgmsI18n.hasStoredLanguage()) {
      return;
    }

    overwolf.settings.language.get(function (result) {
      var language = result && result.language ? String(result.language).toLowerCase() : "";

      if (language.indexOf("ko") === 0) {
        window.bgmsI18n.setLanguage("ko");
      }
    });
  }

  function sendSessionSummary(attempt) {
    var payload;

    if (!SESSION_ENDPOINT) {
      patchState({
        summaryReady: false,
        lastEvent: "Session summary ready (handoff disabled)"
      });
      return;
    }

    if (state.summarySent || !window.fetch) {
      return;
    }

    payload = gepState.buildSessionSummary(state, {
      version: appVersion,
      overwolf_game_id: state.detectedGameId,
      overwolf_class_id: state.detectedClassId
    });

    patchState({
      summarySent: true,
      summaryReady: false,
      summaryAttempts: attempt
    });

    window.fetch(SESSION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BGMS-Session-Id": payload.session_id
      },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (response.ok) {
        patchState({
          lastEvent: "Session summary sent"
        });
        return;
      }

      // 4xx는 재시도해도 동일하게 실패하므로 즉시 중단한다.
      if (response.status >= 400 && response.status < 500) {
        patchState({
          lastEvent: "Session summary rejected"
        });
        return;
      }

      scheduleSummaryRetry(attempt);
    }).catch(function () {
      scheduleSummaryRetry(attempt);
    });
  }

  function scheduleSummaryRetry(attempt) {
    if (attempt >= MAX_SUMMARY_ATTEMPTS) {
      patchState({
        lastEvent: "Session summary failed"
      });
      return;
    }

    patchState({
      summarySent: false,
      summaryReady: true
    });

    window.setTimeout(function () {
      sendSessionSummary(attempt + 1);
    }, SUMMARY_RETRY_DELAY_MS * attempt);
  }

  function subscribe(callback) {
    if (subscribers.indexOf(callback) === -1) {
      subscribers.push(callback);
    }

    callback(cloneState());

    return function () {
      subscribers = subscribers.filter(function (subscriber) {
        return subscriber !== callback;
      });
    };
  }

  window.bgmsController = {
    getState: cloneState,
    subscribe: subscribe,
    showOverlay: function () {
      setOverlayVisible(true);
    },
    hideOverlay: function () {
      setOverlayVisible(false);
    },
    closeDesktop: closeDesktopWindow,
    ensureGepSubscription: ensureGepSubscription,
    applyOverlaySettings: applyOverlaySettings,
    refreshDiagnostics: function () {
      refreshGepInfoSnapshot();
      fetchServiceStatus(state.detectedClassId);
    }
  };

  if (!hasBaseOverwolfApi()) {
    return;
  }

  getCurrentWindow(function () {
    readAppVersion();
    applyClientLanguage();
    registerHotkey();
    registerGameListeners();
  });
})();
