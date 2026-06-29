(function () {
  "use strict";

  var PUBG_GAME_ID = 10906;
  var IN_GAME_WINDOW = "in_game";
  var DESKTOP_WINDOW = "desktop";
  var SESSION_ENDPOINT = "";
  var REQUIRED_FEATURES = [
    "match",
    "phase",
    "kill",
    "death",
    "revived",
    "killer",
    "roster",
    "me"
  ];
  var MAX_FEATURE_ATTEMPTS = 8;
  var RETRY_DELAY_MS = 1500;

  var overlayVisible = false;
  var pubgRunning = false;
  var gepAttemptToken = 0;
  var gepListenersRegistered = false;
  var requiredFeaturesActive = false;
  var requiredFeaturesInFlight = false;
  var subscribers = [];

  var state = createInitialState();

  function createInitialState() {
    return {
      sessionId: createSessionId(),
      matchId: "",
      pseudoMatchId: "",
      effectiveMatchId: "",
      matchMode: "",
      phase: "Idle",
      kills: 0,
      deaths: 0,
      revives: 0,
      roster: {},
      alivePlayers: null,
      health: null,
      weaponState: "",
      lastEvent: "No live events yet",
      matchStartedAt: null,
      matchEnded: false,
      summarySent: false,
      gepStatus: "idle",
      detectedGameId: null,
      detectedGameRunning: false,
      lastFeature: "",
      lastKey: "",
      lastRawValue: "",
      lastGepEventName: "",
      recentUpdates: []
    };
  }

  function createSessionId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }

    return "bgms-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function hasOverwolfApi() {
    return typeof overwolf !== "undefined" && overwolf.windows && overwolf.games && overwolf.games.events;
  }

  function isPubgGameInfo(gameInfo) {
    return Boolean(gameInfo && gameInfo.isRunning && gameInfo.id === PUBG_GAME_ID);
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

  function setState(partial) {
    Object.keys(partial).forEach(function (key) {
      state[key] = partial[key];
    });

    notifySubscribers();
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

      overwolf.windows.restore(result.window.id, function () {});
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
      return;
    }

    closeWindow(IN_GAME_WINDOW);
  }

  function handleGameInfo(gameInfo) {
    if (isPubgGameInfo(gameInfo)) {
      pubgRunning = true;
      setState({
        detectedGameId: gameInfo.id,
        detectedGameRunning: true
      });
      ensureGepSubscription();
      setOverlayVisible(true);
      return;
    }

    if (gameInfo) {
      setState({
        detectedGameId: gameInfo.id || null,
        detectedGameRunning: Boolean(gameInfo.isRunning)
      });
    }
    resetGepRuntimeState();
    setOverlayVisible(false);
  }

  function resetGepRuntimeState() {
    pubgRunning = false;
    gepAttemptToken += 1;
    requiredFeaturesActive = false;
    requiredFeaturesInFlight = false;

    state = Object.assign(createInitialState(), {
      detectedGameId: state.detectedGameId,
      detectedGameRunning: state.detectedGameRunning,
      gepStatus: "idle",
      lastEvent: "Waiting for PUBG"
    });
    notifySubscribers();
  }

  function openDesktopWindow() {
    showWindow(DESKTOP_WINDOW);
  }

  function registerHotkey() {
    if (!overwolf.settings || !overwolf.settings.hotkeys) {
      return;
    }

    overwolf.settings.hotkeys.onPressed.addListener(function (event) {
      if (event && event.name === "toggle_overlay") {
        setOverlayVisible(!overlayVisible);
      }
    });
  }

  function registerGameListeners() {
    overwolf.games.getRunningGameInfo(function (gameInfo) {
      handleGameInfo(gameInfo);

      if (!isPubgGameInfo(gameInfo)) {
        openDesktopWindow();
      }
    });

    overwolf.games.onGameInfoUpdated.addListener(function (event) {
      handleGameInfo(event && event.gameInfo);
    });
  }

  function ensureGepSubscription() {
    if (!hasOverwolfApi()) {
      return;
    }

    if (!gepListenersRegistered) {
      overwolf.games.events.onInfoUpdates2.addListener(handleInfoUpdates);
      overwolf.games.events.onNewEvents.addListener(handleNewEvents);
      gepListenersRegistered = true;
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
    setState({
      gepStatus: "connecting",
      lastEvent: "Connecting to PUBG live events"
    });

    overwolf.games.events.setRequiredFeatures(REQUIRED_FEATURES, function (result) {
      if (!pubgRunning || token !== gepAttemptToken) {
        requiredFeaturesActive = false;
        requiredFeaturesInFlight = false;
        return;
      }

      if (result && result.status === "success") {
        requiredFeaturesActive = true;
        requiredFeaturesInFlight = false;
        setState({
          gepStatus: "connected",
          lastEvent: "Connected to PUBG live events"
        });
        return;
      }

      if (attempt >= MAX_FEATURE_ATTEMPTS) {
        requiredFeaturesActive = false;
        requiredFeaturesInFlight = false;
        setState({
          gepStatus: "unavailable",
          lastEvent: "Live events unavailable"
        });
        return;
      }

      window.setTimeout(function () {
        setRequiredFeatures(attempt + 1, token);
      }, RETRY_DELAY_MS);
    });
  }

  function safeParse(value) {
    if (typeof value !== "string" || value.length === 0) {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch (_error) {
      return value;
    }
  }

  function normalizeNumber(value) {
    if (value && typeof value === "object") {
      if (typeof value.health !== "undefined") {
        return normalizeNumber(value.health);
      }

      if (typeof value.value !== "undefined") {
        return normalizeNumber(value.value);
      }
    }

    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeBoolean(value) {
    if (value === true || value === false) {
      return value;
    }

    if (typeof value === "string") {
      var lowerValue = value.toLowerCase();

      if (lowerValue === "true") {
        return true;
      }

      if (lowerValue === "false") {
        return false;
      }
    }

    return null;
  }

  function getStringValue(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value);
  }

  function summarizeValue(value) {
    var summary = "";

    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      summary = value;
    } else {
      try {
        summary = JSON.stringify(value);
      } catch (_error) {
        summary = String(value);
      }
    }

    return summary.length > 80 ? summary.slice(0, 77) + "..." : summary;
  }

  function recordGepUpdate(kind, feature, key, rawValue) {
    var label = [kind, feature || "-", key || "-"].join(":");
    var recentUpdates = [label].concat(state.recentUpdates || []).slice(0, 4);

    setState({
      lastFeature: getStringValue(feature),
      lastKey: getStringValue(key),
      lastRawValue: summarizeValue(rawValue),
      recentUpdates: recentUpdates
    });
  }

  function updateInfoFeature(feature, category, key, rawValue) {
    var value = safeParse(rawValue);
    var normalizedKey = getStringValue(key);

    if (normalizedKey === "phase") {
      setState({
        phase: getStringValue(value) || "Unknown",
        lastEvent: "Phase changed to " + (getStringValue(value) || "Unknown")
      });
      return;
    }

    if (feature === "match" || normalizedKey === "match_id" || normalizedKey === "pseudo_match_id" || normalizedKey === "mode") {
      updateMatchInfo(category, key, value);
      return;
    }

    if (feature === "kill" || normalizedKey === "kills" || normalizedKey === "kill") {
      updateKillInfo(key, value);
      return;
    }

    if (feature === "roster" || normalizedKey.indexOf("roster_") === 0) {
      updateRosterInfo(key, value);
      return;
    }

    if (feature === "me" || normalizedKey === "health" || normalizedKey === "hp" || normalizedKey === "weaponState" || normalizedKey === "weapon_state" || normalizedKey === "weapon") {
      updateMeInfo(key, value);
    }
  }

  function updateMatchInfo(_category, key, value) {
    if (key === "match_id") {
      var matchId = getStringValue(value);

      setState({
        matchId: matchId,
        effectiveMatchId: matchId || state.pseudoMatchId,
        lastEvent: "Match ID received"
      });
      return;
    }

    if (key === "pseudo_match_id") {
      var pseudoMatchId = getStringValue(value);

      setState({
        pseudoMatchId: pseudoMatchId,
        effectiveMatchId: state.matchId || pseudoMatchId,
        lastEvent: "Pseudo match ID received"
      });
      return;
    }

    if (key === "mode") {
      setState({
        matchMode: getStringValue(value),
        lastEvent: "Mode: " + getStringValue(value)
      });
    }
  }

  function updateKillInfo(key, value) {
    if (key !== "kills" && key !== "kill") {
      return;
    }

    var nextKills = normalizeNumber(value);
    if (nextKills !== null) {
      setState({
        kills: nextKills,
        lastEvent: "Kills updated"
      });
    }
  }

  function updateRosterInfo(key, value) {
    var roster = Object.assign({}, state.roster);

    if (value === null) {
      delete roster[key];
      setState({
        roster: roster,
        alivePlayers: calculateAlivePlayers(roster),
        lastEvent: "Roster update received"
      });
      return;
    }

    if (!value || typeof value !== "object") {
      setState({
        lastEvent: "Roster update received"
      });
      return;
    }

    roster[key] = value;
    setState({
      roster: roster,
      alivePlayers: calculateAlivePlayers(roster),
      lastEvent: "Roster update received"
    });
  }

  function calculateAlivePlayers(roster) {
    var knownAlive = 0;
    var knownStatusCount = 0;

    Object.keys(roster).forEach(function (rosterKey) {
      var player = roster[rosterKey];

      if (!player || typeof player !== "object") {
        return;
      }

      var out = normalizeBoolean(player.out);

      if (out === null) {
        return;
      }

      knownStatusCount += 1;

      if (out === false) {
        knownAlive += 1;
      }
    });

    return knownStatusCount === 0 ? null : knownAlive;
  }

  function updateMeInfo(key, value) {
    if (key === "health" || key === "hp") {
      var nextHealth = normalizeNumber(value);

      if (nextHealth !== null) {
        setState({
          health: Math.round(nextHealth)
        });
      }

      return;
    }

    if (key === "weaponState" || key === "weapon_state" || key === "weapon") {
      setState({
        weaponState: formatWeaponState(value)
      });
    }
  }

  function formatWeaponState(value) {
    if (!value || typeof value !== "object") {
      return getStringValue(value);
    }

    var weaponName = getStringValue(value.name);
    var equipped = normalizeBoolean(value.equipped);
    var count = normalizeNumber(value.count);
    var parts = [];

    if (weaponName) {
      parts.push(weaponName);
    }

    if (equipped === true) {
      parts.push("equipped");
    } else if (equipped === false) {
      parts.push("holstered");
    }

    if (count !== null) {
      parts.push("x" + String(count));
    }

    return parts.join(" ").trim();
  }

  function handleEvent(eventName, rawData) {
    recordGepUpdate("event", "", eventName, rawData);
    setState({
      lastGepEventName: getStringValue(eventName)
    });

    if (eventName === "matchStart") {
      var previousMatchContext = {
        matchId: state.matchId,
        pseudoMatchId: state.pseudoMatchId,
        effectiveMatchId: state.effectiveMatchId,
        matchMode: state.matchMode,
        lastFeature: state.lastFeature,
        lastKey: state.lastKey,
        lastRawValue: state.lastRawValue,
        lastGepEventName: state.lastGepEventName,
        recentUpdates: state.recentUpdates
      };

      state = createInitialState();
      setState({
        matchId: previousMatchContext.matchId,
        pseudoMatchId: previousMatchContext.pseudoMatchId,
        effectiveMatchId: previousMatchContext.effectiveMatchId,
        matchMode: previousMatchContext.matchMode,
        lastFeature: previousMatchContext.lastFeature,
        lastKey: previousMatchContext.lastKey,
        lastRawValue: previousMatchContext.lastRawValue,
        lastGepEventName: previousMatchContext.lastGepEventName,
        recentUpdates: previousMatchContext.recentUpdates,
        matchStartedAt: new Date().toISOString(),
        gepStatus: requiredFeaturesActive ? "connected" : state.gepStatus,
        lastEvent: "Match started"
      });
      return;
    }

    if (eventName === "matchEnd") {
      setState({
        matchEnded: true,
        lastEvent: "Match ended"
      });
      sendSessionSummaryOnce();
      return;
    }

    if (eventName === "kill") {
      setState({
        kills: state.kills + 1,
        lastEvent: "Kill confirmed"
      });
      return;
    }

    if (eventName === "death") {
      setState({
        deaths: state.deaths + 1,
        lastEvent: "You died"
      });
      return;
    }

    if (eventName === "revived") {
      setState({
        revives: state.revives + 1,
        lastEvent: "You were revived"
      });
      return;
    }

    if (eventName === "killer") {
      var killerData = safeParse(rawData);
      var killerName = killerData && killerData.killer_name ? killerData.killer_name : "killer identified";

      setState({
        lastEvent: "Last killer: " + killerName
      });
    }
  }

  function handleInfoUpdates(event) {
    if (!event) {
      return;
    }

    if (event.feature && event.key) {
      recordGepUpdate("info", event.feature, event.key, event.value);
      updateInfoFeature(event.feature, event.category || "", event.key, event.value);
      return;
    }

    if (!event.info) {
      return;
    }

    Object.keys(event.info).forEach(function (category) {
      var entries = event.info[category];

      if (!entries || typeof entries !== "object") {
        return;
      }

      Object.keys(entries).forEach(function (key) {
        var feature = event.feature || category;

        recordGepUpdate("info", feature, key, entries[key]);
        updateInfoFeature(feature, category, key, entries[key]);
      });
    });
  }

  function handleNewEvents(event) {
    if (!event || !Array.isArray(event.events)) {
      return;
    }

    event.events.forEach(function (entry) {
      if (entry && entry.name) {
        handleEvent(entry.name, entry.data);
      }
    });
  }

  function sendSessionSummaryOnce() {
    if (!SESSION_ENDPOINT || state.summarySent) {
      return;
    }

    state.summarySent = true;
    notifySubscribers();

    window.fetch(SESSION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session_id: state.sessionId,
        match_id: state.matchId || null,
        pseudo_match_id: state.pseudoMatchId || null,
        gep_summary: {
          effective_match_id: state.effectiveMatchId || null,
          match_mode: state.matchMode || null,
          phase: state.phase,
          kills: state.kills,
          deaths: state.deaths,
          revives: state.revives,
          alive_players: state.alivePlayers,
          match_started_at: state.matchStartedAt,
          match_ended_at: new Date().toISOString()
        },
        client_environment: {
          app: "BGMS Companion",
          version: "0.1.0",
          source: "overwolf"
        }
      })
    }).catch(function () {
      state.summarySent = false;
      notifySubscribers();
    });
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
    ensureGepSubscription: ensureGepSubscription
  };

  if (!hasOverwolfApi()) {
    return;
  }

  getCurrentWindow(function () {
    registerHotkey();
    registerGameListeners();
  });
})();
