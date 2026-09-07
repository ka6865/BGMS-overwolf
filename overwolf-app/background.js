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
  var sessionQueue = window.bgmsSessionQueue;
  var settingsStore = window.bgmsSettings;

  var IN_GAME_WINDOW = "in_game";
  var DESKTOP_WINDOW = "desktop";

  // BGMS 세션 요약 수신 엔드포인트(app/api/overwolf/session).
  // 전송은 사용자가 데스크탑 창에서 핸드오프를 켰을 때만 수행한다.
  // 개발 하네스에서 로컬 서버로 붙여 검증할 때만 window.bgmsDevEndpoint로 덮어쓴다.
  // Overwolf 런타임에는 이 값이 존재하지 않으므로 항상 운영 엔드포인트를 사용한다.
  var SESSION_ENDPOINT = window.bgmsDevEndpoint || "https://bgms.kr/api/overwolf/session";
  // 사용자가 데스크탑 창에서 세션 기록을 열 때 사용하는 웹 경로.
  var SESSION_WEB_BASE = window.bgmsDevWebBase || "https://bgms.kr/overwolf/sessions";
  /*
   * 앱에서 열 수 있는 외부 링크. 화이트리스트로 두어 임의 URL 이 열리지 않게 한다.
   * community 는 BGMS 게시판, discord 는 공식 서버다.
   */
  var EXTERNAL_LINKS = {
    community: "https://bgms.kr/board",
    discord: "https://discord.gg/T97MR78awb"
  };
  var SESSION_QUEUE_STORAGE_KEY = "bgms_companion_session_queue";
  var SESSION_REQUEST_TIMEOUT_MS = 15000;
  var STATE_NOTIFY_DELAY_MS = 50;

  var REQUIRED_FEATURES = gepState.REQUIRED_FEATURES;
  var MAX_FEATURE_ATTEMPTS = 8;
  var RETRY_DELAY_MS = 3000;
  var STATUS_ENDPOINT_TEMPLATE = "https://game-events-status.overwolf.com/{gameId}_prod.json";

  var OVERLAY_WIDTH = 348;
  var OVERLAY_MINI_HEIGHT = 78;
  // 경고 줄이 자기 행을 차지하면 mini 모드가 한 줄 더 필요하다.
  // .mini-status 는 flex-wrap 이고 한 줄이 10px * 1.25 + row-gap 10px 를 쓴다.
  var OVERLAY_MINI_WARNING_HEIGHT = 100;
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
  var queueTimer = null;
  var queueFlushInFlight = false;
  var notificationTimer = null;
  var featureRetryTimer = null;
  var infoUpdateRevision = 0;

  var state = gepState.createInitialState();

  var infoUpdatesListener = function (event) {
    if (!pubgRunning) return;
    infoUpdateRevision += 1;
    setState(gepState.reduceInfoUpdatesEvent(state, event));
  };

  var newEventsListener = function (event) {
    if (!pubgRunning) return;
    infoUpdateRevision += 1;
    var nextState = gepState.reduceNewEventsEvent(state, event);

    setState(nextState);

    if (nextState.summaryReady && !nextState.summarySent) {
      enqueueSessionSummary();
    }
  };

  var gepErrorListener = function (event) {
    if (!pubgRunning) return;
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
    notificationTimer = null;
    if (!subscribers.length) return;
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
    var wasDegraded = gepState.isServiceDegraded(state);

    state = nextState;
    // 수집과 요약은 즉시 처리하고 화면 전달만 합쳐 직렬화와 DOM 작업을 줄인다.
    if (subscribers.length && notificationTimer === null) {
      notificationTimer = window.setTimeout(notifySubscribers, STATE_NOTIFY_DELAY_MS);
    }

    // 경고 라인이 새로 뜨거나 사라지면 mini 오버레이 높이를 맞춘다.
    if (overlayVisible && gepState.isServiceDegraded(state) !== wasDegraded) {
      applyOverlaySettings();
    }
  }

  function patchState(partial) {
    var keys = Object.keys(partial);
    if (!keys.some(function (key) { return state[key] !== partial[key]; })) return;
    var nextState = Object.assign({}, state);

    keys.forEach(function (key) {
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
    if (overlayVisible === nextVisible) return;
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
      var isNewGame = !pubgRunning || !lastGameInfo || lastGameInfo.id !== gameInfo.id;
      var previousWidth = getGameWidth();
      if (isNewGame && pubgRunning) {
        resetGepRuntimeState(null, null, false);
        setOverlayVisible(false);
      }
      pubgRunning = true;
      lastGameInfo = gameInfo;
      patchState({
        detectedGameId: gameInfo.id || null,
        detectedClassId: classId,
        detectedGameRunning: true
      });
      if (isNewGame) {
        fetchServiceStatus(classId);
        ensureGepSubscription();
        setOverlayVisible(true);
      } else if (overlayVisible && previousWidth !== getGameWidth()) {
        applyOverlaySettings();
      }
      return;
    }

    if (!pubgRunning && state.detectedGameId === (gameInfo ? gameInfo.id || null : null)
      && state.detectedGameRunning === Boolean(gameInfo && gameInfo.isRunning)) return;

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
    if (featureRetryTimer !== null) {
      window.clearTimeout(featureRetryTimer);
      featureRetryTimer = null;
    }

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
    patchState({ handoffEnabled: settingsStore.read().handoffEnabled });
    publishQueueState(readQueue());
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

  /*
   * 오버레이 창 높이를 현재 표시 상태에 맞춘다.
   * 경고 라인은 .mini-status 안에서 자기 행을 차지하므로 mini 모드에서 한 줄이 더 필요하다.
   * 높이가 부족하면 overflow:hidden + resizable:false 조합 때문에 아래쪽이 보이지 않는다.
   */
  function resolveOverlayHeight(settings) {
    if (settings.mode === "debug") {
      return OVERLAY_DEBUG_HEIGHT;
    }

    return gepState.isServiceDegraded(state) ? OVERLAY_MINI_WARNING_HEIGHT : OVERLAY_MINI_HEIGHT;
  }

  function applyOverlaySettings(settings) {
    var nextSettings = settings || getOverlaySettings();

    if (!overwolf.windows.getWindow || !overwolf.windows.changePosition) {
      return;
    }

    overwolf.windows.getWindow(IN_GAME_WINDOW, function (result) {
      var position = getOverlayPosition(nextSettings.position);
      var nextHeight = resolveOverlayHeight(nextSettings);

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
      if (event && Object.prototype.hasOwnProperty.call(event, "gameInfo")) {
        handleGameInfo(event.gameInfo);
      }
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

      featureRetryTimer = window.setTimeout(function () {
        featureRetryTimer = null;
        setRequiredFeatures(attempt + 1, token);
      }, RETRY_DELAY_MS);
    });
  }

  /*
   * getInfo는 현재 세션의 info snapshot을 준다.
   * 공식 GetInfoResult는 res에 담기지만 클라이언트 버전에 따라 info로 오는 경우도 있어 둘 다 처리한다.
   */
  function refreshGepInfoSnapshot() {
    var token = gepAttemptToken;
    var revision = infoUpdateRevision;
    if (!pubgRunning || !hasGepApi() || typeof overwolf.games.events.getInfo !== "function") {
      return;
    }

    overwolf.games.events.getInfo(function (result) {
      var succeeded = Boolean(result && (result.success === true || result.status === "success"));
      var payloads;

      if (!succeeded || !pubgRunning || token !== gepAttemptToken || revision !== infoUpdateRevision) {
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
    var token = gepAttemptToken;
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
      if (!payload || token !== gepAttemptToken) {
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
   * 세션 요약 전송
   *
   * 전송 조건: 사용자가 핸드오프를 켜고 BGMS 닉네임을 입력한 경우에만 큐에 넣는다.
   * 큐는 localStorage에 보존되므로 네트워크 단절이나 앱 재시작 후에도 재시도된다.
   * 서버는 session_id 기준 idempotent 처리하므로 중복 전송은 duplicate로 흡수된다.
   */
  function readQueue() {
    try {
      return sessionQueue.normalizeQueue(JSON.parse(window.localStorage.getItem(SESSION_QUEUE_STORAGE_KEY)));
    } catch (_error) {
      return [];
    }
  }

  function writeQueue(queue) {
    var normalized = sessionQueue.normalizeQueue(queue);

    try {
      window.localStorage.setItem(SESSION_QUEUE_STORAGE_KEY, JSON.stringify(normalized));
    } catch (_error) {
      return normalized;
    }

    return normalized;
  }

  function publishQueueState(queue, outcome) {
    var description = sessionQueue.describeQueue(queue);

    patchState({
      handoffPending: description.pending,
      handoffLastError: description.lastError,
      handoffNextAttemptAt: description.nextAttemptAt,
      handoffOutcome: outcome || state.handoffOutcome
    });
  }

  function enqueueSessionSummary() {
    var settings = settingsStore.read();
    var payload;
    var queue;

    if (!settingsStore.canSendHandoff(settings)) {
      patchState({
        summaryReady: false,
        handoffEnabled: settings.handoffEnabled,
        lastEvent: settings.handoffEnabled
          ? "Session summary skipped (BGMS nickname required)"
          : "Session summary ready (handoff off)"
      });
      return;
    }

    payload = gepState.buildSessionSummary(state, {
      version: appVersion,
      overwolf_game_id: state.detectedGameId,
      overwolf_class_id: state.detectedClassId,
      language: window.bgmsI18n ? window.bgmsI18n.getLanguage() : "en"
    }, {
      playerName: settings.playerName,
      platform: settings.platform
    });

    queue = writeQueue(sessionQueue.enqueue(readQueue(), payload));

    patchState({
      summaryReady: false,
      summarySent: true,
      handoffEnabled: true,
      lastEvent: "Session summary queued"
    });
    publishQueueState(queue, "queued");
    flushSessionQueue();
  }

  function flushSessionQueue() {
    if (queueTimer !== null) {
      window.clearTimeout(queueTimer);
      queueTimer = null;
    }
    var settings = settingsStore.read();
    var queue = readQueue();
    var entry;

    if (queueFlushInFlight || !window.fetch || !SESSION_ENDPOINT) {
      return;
    }

    // 사용자가 전송을 껐으면 큐는 유지하되 전송하지 않는다.
    if (!settingsStore.canSendHandoff(settings)) {
      publishQueueState(queue);
      return;
    }

    entry = sessionQueue.pickDueEntry(queue);

    if (!entry) {
      publishQueueState(queue);
      scheduleQueueRetry(queue);
      return;
    }

    queueFlushInFlight = true;

    // 응답이 끝나지 않아도 큐를 잠그지 않는다. 늦은 성공/실패는 한 번만 처리한다.
    var settled = false;
    var abortController = window.AbortController ? new window.AbortController() : null;
    var timeout = window.setTimeout(function () {
      finish({ ok: false, status: 0 });
      if (abortController) abortController.abort();
    }, SESSION_REQUEST_TIMEOUT_MS);

    function finish(result) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      settleQueueEntry(entry.payload.session_id, result);
    }

    var request = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BGMS-Session-Id": entry.payload.session_id
      },
      body: JSON.stringify(entry.payload)
    };
    if (abortController) request.signal = abortController.signal;

    try {
      window.fetch(SESSION_ENDPOINT, request).then(function (response) {
        finish({ ok: response.ok, status: response.status });
      }).catch(function () {
        finish({ ok: false, status: 0 });
      });
    } catch (_error) {
      finish({ ok: false, status: 0 });
    }
  }

  function settleQueueEntry(sessionId, result) {
    var applied = sessionQueue.applyResult(readQueue(), sessionId, result);
    var queue = writeQueue(applied.queue);
    var messages = {
      sent: "Session summary sent",
      rejected: "Session summary rejected",
      dropped: "Session summary failed",
      retry: "Session summary retry scheduled"
    };

    queueFlushInFlight = false;

    patchState({
      lastEvent: messages[applied.outcome] || state.lastEvent
    });
    publishQueueState(queue, applied.outcome);

    scheduleQueueRetry(queue);
  }

  function scheduleQueueRetry(queue) {
    if (queueTimer !== null) {
      window.clearTimeout(queueTimer);
      queueTimer = null;
    }
    if (queueFlushInFlight || !queue.length || !settingsStore.canSendHandoff(settingsStore.read())) return;

    // 가장 먼저 재시도 가능한 시각에만 깨운다. 빈 큐와 동의 해제 상태에서는 쉬도록 한다.
    var nextAttemptAt = Math.min.apply(null, queue.map(function (entry) { return entry.nextAttemptAt; }));
    var delay = Math.min(2147483647, Math.max(0, nextAttemptAt - Date.now()));
    queueTimer = window.setTimeout(flushSessionQueue, delay);
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
      if (!subscribers.length && notificationTimer !== null) {
        window.clearTimeout(notificationTimer);
        notificationTimer = null;
      }
    };
  }

  window.bgmsController = {
    getState: cloneState,
    subscribe: subscribe,
    /*
     * 현재 할당된 핫키 조합을 읽는다.
     * manifest 의 default 값이 아니라 사용자가 바꾼 실제 값을 보여주기 위해
     * overwolf.settings.hotkeys.get 을 쓴다. Hotkeys 권한으로 이미 가능하다.
     */
    getAssignedHotkeys: function (callback) {
      if (!hasBaseOverwolfApi() || !overwolf.settings || !overwolf.settings.hotkeys
        || !overwolf.settings.hotkeys.get) {
        callback(null);
        return;
      }

      overwolf.settings.hotkeys.get(function (result) {
        var assigned = {};
        var list;

        if (!result || !result.success) {
          callback(null);
          return;
        }

        // 전역 바인딩을 먼저 읽고 PUBG의 명시적 설정(해제 포함)으로 덮어쓴다.
        list = (Array.isArray(result.globals) ? result.globals : []).concat(
          result.games && Array.isArray(result.games[String(gepState.PUBG_CLASS_IDS[0])])
            ? result.games[String(gepState.PUBG_CLASS_IDS[0])] : []
        );

        list.forEach(function (hotkey) {
          if (hotkey && hotkey.name) {
            assigned[hotkey.name] = hotkey.IsUnassigned ? "" : hotkey.binding || "";
          }
        });

        callback(assigned);
      });
    },
    /*
     * Overwolf 핫키 설정 화면을 연다.
     * 앱 안에서 조합을 직접 바꾸는 API 는 없고, 공식 권고는 설정 화면으로 보내는 것이다.
     */
    openHotkeySettings: function () {
      if (!hasBaseOverwolfApi() || !overwolf.utils || !overwolf.utils.openUrlInDefaultBrowser) {
        return false;
      }

      overwolf.utils.openUrlInDefaultBrowser("overwolf://settings/hotkeys");

      return true;
    },
    /*
     * 지원/피드백 링크를 기본 브라우저로 연다.
     * 공식 Best Practices 가 in-app 피드백 경로를 권한다.
     * 화이트리스트 키만 받아 임의 URL 이 열리지 않게 한다.
     */
    openExternalLink: function (key) {
      var url = EXTERNAL_LINKS[key];

      if (!url || !hasBaseOverwolfApi() || !overwolf.utils || !overwolf.utils.openUrlInDefaultBrowser) {
        return null;
      }

      overwolf.utils.openUrlInDefaultBrowser(url);

      return url;
    },
    /*
     * BGMS 웹의 세션 기록 화면을 기본 브라우저로 연다.
     * 사용자가 앱에 입력한 닉네임/플랫폼을 쿼리로 붙여 바로 자기 기록이 보이게 한다.
     * overwolf.utils.openUrlInDefaultBrowser 는 별도 permission 을 요구하지 않는다.
     */
    openSessionHistory: function () {
      var settings = settingsStore.read();
      var url = SESSION_WEB_BASE;
      var query = [];

      if (settings.playerName) {
        query.push("player=" + encodeURIComponent(settings.playerName));
      }

      if (settings.platform) {
        query.push("platform=" + encodeURIComponent(settings.platform));
      }

      if (query.length) {
        url += "?" + query.join("&");
      }

      if (!hasBaseOverwolfApi() || !overwolf.utils || !overwolf.utils.openUrlInDefaultBrowser) {
        return null;
      }

      overwolf.utils.openUrlInDefaultBrowser(url);

      return url;
    },
    showOverlay: function () {
      setOverlayVisible(true);
    },
    hideOverlay: function () {
      setOverlayVisible(false);
    },
    closeDesktop: closeDesktopWindow,
    ensureGepSubscription: ensureGepSubscription,
    applyOverlaySettings: applyOverlaySettings,
    applyServiceSettings: function (settings) {
      var nextSettings = settingsStore.normalize(settings);

      patchState({
        handoffEnabled: nextSettings.handoffEnabled
      });
      flushSessionQueue();
    },
    retryHandoff: flushSessionQueue,
    refreshDiagnostics: function () {
      ensureGepSubscription();
      refreshGepInfoSnapshot();
      fetchServiceStatus(state.detectedClassId);
      flushSessionQueue();
    }
  };

  if (!hasBaseOverwolfApi()) {
    return;
  }

  getCurrentWindow(function () {
    readAppVersion();
    registerHotkey();
    registerGameListeners();
    // 이전 실행에서 전송하지 못한 요약이 있으면 이어서 처리한다.
    patchState({
      handoffEnabled: settingsStore.read().handoffEnabled
    });
    publishQueueState(readQueue());
    flushSessionQueue();
  });
})();
