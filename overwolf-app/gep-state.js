/*
 * BGMS Companion - GEP 상태 리듀서 (순수 모듈)
 *
 * 이 파일은 Overwolf API를 직접 호출하지 않는다. GEP payload를 받아 세션 상태를
 * 계산하는 순수 함수만 담아 macOS/node 환경에서도 단위 테스트가 가능하게 한다.
 *
 * 공식 기준: PUBG Game Events 문서의 feature/category/key 표
 * https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/playerunknowns-battlegrounds/
 */
(function (root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.bgmsGepState = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // Phase 1에서 구독하는 feature. AGENTS.md 4장 범위와 동일해야 한다.
  var REQUIRED_FEATURES = [
    "match",
    "match_info",
    "phase",
    "kill",
    "death",
    "revived",
    "killer",
    "roster",
    "me"
  ];

  // 정책상 실시간 사용이 금지된 key/event. GEP가 보내더라도 상태에 반영하지 않는다.
  var BLOCKED_INFO_KEYS = [
    "damage_dealt",
    "total_damage_dealt",
    "location",
    "team_location"
  ];

  var BLOCKED_EVENT_NAMES = [
    "damage_dealt",
    "damageTaken",
    "fire"
  ];

  // 공식 문서에 기재된 phase 값. 목록 외 값(예: 관측된 starting)도 표시는 허용한다.
  var OFFICIAL_PHASES = [
    "lobby",
    "loading_screen",
    "airfield",
    "aircraft",
    "freefly",
    "landed"
  ];

  var PUBG_CLASS_IDS = [10906];

  function createSessionId(seed) {
    if (seed) {
      return String(seed);
    }

    return "bgms-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function createInitialState(overrides) {
    var state = {
      sessionId: createSessionId(overrides && overrides.sessionId),
      matchId: "",
      pseudoMatchId: "",
      effectiveMatchId: "",
      matchMode: "",
      phase: "Idle",
      phaseIsOfficial: null,
      kills: 0,
      deaths: 0,
      revives: 0,
      knockdowns: 0,
      roster: {},
      alivePlayers: null,
      health: null,
      koHealth: null,
      knocked: false,
      weaponState: "",
      lastEvent: "No live events yet",
      lastKillerName: "",
      matchStartedAt: null,
      matchEndedAt: null,
      matchEnded: false,
      matchEndCount: 0,
      summaryReady: false,
      summarySent: false,
      summaryAttempts: 0,
      handoffEnabled: false,
      handoffPending: 0,
      handoffOutcome: "",
      handoffLastError: "",
      handoffNextAttemptAt: null,
      gepStatus: "idle",
      gepErrorReason: "",
      gepLocalVersion: "",
      gepPublicVersion: "",
      serviceStatusState: null,
      serviceStatusMessage: "",
      detectedGameId: null,
      detectedClassId: null,
      detectedGameRunning: false,
      lastFeature: "",
      lastKey: "",
      lastRawValue: "",
      lastGepEventName: "",
      recentUpdates: [],
      ignoredUpdates: [],
      lastInfoReceivedAt: null,
      seenInfoFeatures: {},
      supportedFeatures: [],
      requiredFeatures: REQUIRED_FEATURES.slice(),
      lastRequiredFeaturesResult: ""
    };

    return assign(state, overrides || {});
  }

  /*
   * 새 매치 시작 시 카운터만 초기화하고 진단/식별 정보는 유지한다.
   * session_id는 매치 단위로 새로 발급해 서버 idempotency 키가 매치 간 충돌하지 않게 한다.
   */
  function resetForNewMatch(state, startedAt, sessionId) {
    var carried = [
      "matchId",
      "pseudoMatchId",
      "effectiveMatchId",
      "matchMode",
      "phase",
      "phaseIsOfficial",
      "gepStatus",
      "gepErrorReason",
      "gepLocalVersion",
      "gepPublicVersion",
      "serviceStatusState",
      "serviceStatusMessage",
      "detectedGameId",
      "detectedClassId",
      "detectedGameRunning",
      "handoffEnabled",
      "handoffPending",
      "handoffOutcome",
      "handoffLastError",
      "handoffNextAttemptAt",
      "lastFeature",
      "lastKey",
      "lastRawValue",
      "lastGepEventName",
      "recentUpdates",
      "ignoredUpdates",
      "lastInfoReceivedAt",
      "seenInfoFeatures",
      "supportedFeatures",
      "requiredFeatures",
      "lastRequiredFeaturesResult"
    ];
    var overrides = {};

    carried.forEach(function (key) {
      overrides[key] = state[key];
    });

    overrides.matchStartedAt = startedAt || new Date().toISOString();
    overrides.lastEvent = "Match started";

    if (sessionId) {
      overrides.sessionId = sessionId;
    }

    return createInitialState(overrides);
  }

  function assign(target, source) {
    Object.keys(source).forEach(function (key) {
      target[key] = source[key];
    });

    return target;
  }

  function patch(state, partial) {
    var next = assign({}, state);

    return assign(next, partial || {});
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

  function getStringValue(value) {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch (_error) {
        return String(value);
      }
    }

    return String(value);
  }

  function normalizeNumber(value) {
    var parsed;

    if (value && typeof value === "object") {
      if (typeof value.health !== "undefined") {
        return normalizeNumber(value.health);
      }

      if (typeof value.value !== "undefined") {
        return normalizeNumber(value.value);
      }

      return null;
    }

    parsed = Number(value);

    return typeof parsed === "number" && isFinite(parsed) ? parsed : null;
  }

  function normalizeBoolean(value) {
    var lowerValue;

    if (value === true || value === false) {
      return value;
    }

    if (typeof value === "string") {
      lowerValue = value.toLowerCase();

      if (lowerValue === "true") {
        return true;
      }

      if (lowerValue === "false") {
        return false;
      }
    }

    return null;
  }

  function firstDefined(values) {
    var index;

    for (index = 0; index < values.length; index += 1) {
      if (values[index] !== undefined && values[index] !== null) {
        return values[index];
      }
    }

    return undefined;
  }

  function summarizeValue(value) {
    var summary = getStringValue(value);

    return summary.length > 120 ? summary.slice(0, 117) + "..." : summary;
  }

  /*
   * Overwolf game id는 instance digit이 붙은 형태로 전달된다(예: PUBG 109061).
   * manifest에 넣는 값은 base game id(10906)이므로 floor(id / 10)로 환산한다.
   * RunningGameInfo.classId가 있으면 그대로 사용한다.
   */
  function resolveClassId(gameInfo) {
    var rawId;

    if (!gameInfo) {
      return null;
    }

    if (typeof gameInfo === "number") {
      return gameInfo > 99999 ? Math.floor(gameInfo / 10) : gameInfo;
    }

    if (gameInfo.classId) {
      return Number(gameInfo.classId);
    }

    rawId = Number(gameInfo.id);

    if (!isFinite(rawId) || rawId <= 0) {
      return null;
    }

    return rawId > 99999 ? Math.floor(rawId / 10) : rawId;
  }

  function isPubgGameInfo(gameInfo) {
    var classId = resolveClassId(gameInfo);

    if (!gameInfo || !gameInfo.isRunning) {
      return false;
    }

    return PUBG_CLASS_IDS.indexOf(classId) !== -1;
  }

  /*
   * onInfoUpdates2는 두 가지 형태로 온다.
   *  1) {feature, category, key, value}
   *  2) {feature, info: {category: {key: value}}}
   * 두 형태를 하나의 update 배열로 정규화한다.
   */
  function normalizeInfoUpdatesEvent(event) {
    var updates = [];
    var info;

    if (!event) {
      return updates;
    }

    if (event.key !== undefined && event.key !== null) {
      updates.push({
        feature: getStringValue(event.feature),
        category: getStringValue(event.category),
        key: getStringValue(event.key),
        value: event.value
      });

      return updates;
    }

    info = safeParse(event.info);

    if (!info || typeof info !== "object") {
      return updates;
    }

    Object.keys(info).forEach(function (category) {
      var entries = safeParse(info[category]);

      if (!entries || typeof entries !== "object") {
        return;
      }

      Object.keys(entries).forEach(function (key) {
        updates.push({
          feature: getStringValue(event.feature),
          category: category,
          key: key,
          value: entries[key]
        });
      });
    });

    return updates;
  }

  /*
   * feature 이름이 비어 있는 경우 category+key로 feature를 추론한다.
   * key만 보고 판단하면 rank의 match_info.me와 me feature가 충돌하므로
   * 항상 feature를 먼저 신뢰한다.
   */
  function inferFeature(category, key) {
    if (key === "phase") {
      return "phase";
    }

    if (key.indexOf("roster_") === 0 || key === "roster") {
      return "roster";
    }

    if (key === "pseudo_match_id") {
      return "match_info";
    }

    if (key === "match_id" || key === "mode") {
      return "match";
    }

    if (key === "kills" || key === "headshots" || key === "max_kill_distance") {
      return "kill";
    }

    if (key === "weaponState" || category === "inventory") {
      return "me";
    }

    if (category === "me") {
      return "me";
    }

    if (category === "gep_internal") {
      return "gep_internal";
    }

    return "";
  }

  function recordDiagnostics(state, update) {
    var label = ["info", update.feature || "-", update.key || "-"].join(":");
    var seen = assign({}, state.seenInfoFeatures);

    seen[update.feature || update.category || "unknown"] = true;

    return patch(state, {
      lastFeature: update.feature,
      lastKey: update.key,
      lastRawValue: summarizeValue(update.value),
      recentUpdates: [label].concat(state.recentUpdates).slice(0, 6),
      lastInfoReceivedAt: new Date().toISOString(),
      seenInfoFeatures: seen
    });
  }

  function recordIgnored(state, label) {
    var ignored = [label].concat(state.ignoredUpdates).filter(function (item, index, list) {
      return list.indexOf(item) === index;
    }).slice(0, 6);

    return patch(state, {
      ignoredUpdates: ignored
    });
  }

  function applyPhase(state, value) {
    var phase = getStringValue(safeParse(value)) || "Unknown";

    return patch(state, {
      phase: phase,
      phaseIsOfficial: OFFICIAL_PHASES.indexOf(phase) !== -1,
      lastEvent: "Phase changed to " + phase
    });
  }

  function applyMatch(state, key, value) {
    var parsed = safeParse(value);
    var matchId;

    if (key === "match_id") {
      matchId = getStringValue(parsed);

      return patch(state, {
        matchId: matchId,
        effectiveMatchId: matchId || state.pseudoMatchId,
        lastEvent: "Match ID received"
      });
    }

    if (key === "mode") {
      return patch(state, {
        matchMode: getStringValue(parsed),
        lastEvent: "Mode: " + getStringValue(parsed)
      });
    }

    return state;
  }

  function applyMatchInfo(state, key, value) {
    var pseudoMatchId;

    if (key !== "pseudo_match_id") {
      return state;
    }

    pseudoMatchId = getStringValue(safeParse(value));

    return patch(state, {
      pseudoMatchId: pseudoMatchId,
      effectiveMatchId: state.matchId || pseudoMatchId,
      lastEvent: "Pseudo match ID received"
    });
  }

  function applyKill(state, key, value) {
    var nextKills;

    if (key !== "kills") {
      return state;
    }

    nextKills = normalizeNumber(safeParse(value));

    if (nextKills === null) {
      return state;
    }

    return patch(state, {
      kills: nextKills,
      lastEvent: "Kills updated"
    });
  }

  function inferRosterOut(player) {
    var out = normalizeBoolean(player.out);
    var alive;
    var status;

    if (out !== null) {
      return out;
    }

    alive = firstDefined([
      normalizeBoolean(player.alive),
      normalizeBoolean(player.isAlive),
      normalizeBoolean(player.is_alive)
    ]);

    if (alive === true || alive === false) {
      return !alive;
    }

    status = getStringValue(firstDefined([
      player.status,
      player.state,
      player.lifeState,
      player.life_state
    ])).toLowerCase();

    if (status === "alive" || status === "playing" || status === "active") {
      return false;
    }

    if (status === "out" || status === "dead" || status === "killed" || status === "eliminated") {
      return true;
    }

    return null;
  }

  function calculateAlivePlayers(roster) {
    var knownAlive = 0;
    var knownStatusCount = 0;

    Object.keys(roster).forEach(function (rosterKey) {
      var player = safeParse(roster[rosterKey]);
      var out;

      if (!player || typeof player !== "object") {
        return;
      }

      out = inferRosterOut(player);

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

  function applyRoster(state, key, value) {
    var roster = assign({}, state.roster);
    var parsed = safeParse(value);
    var alivePlayers;

    if (parsed === null || parsed === undefined || parsed === "") {
      delete roster[key];
    } else if (key === "roster" && typeof parsed === "object") {
      Object.keys(parsed).forEach(function (rosterKey) {
        roster[rosterKey] = safeParse(parsed[rosterKey]);
      });
    } else if (typeof parsed === "object") {
      roster[key] = parsed;
    } else {
      return patch(state, {
        lastEvent: "Roster update received"
      });
    }

    alivePlayers = calculateAlivePlayers(roster);

    return patch(state, {
      roster: roster,
      alivePlayers: alivePlayers === null ? state.alivePlayers : alivePlayers,
      lastEvent: "Roster update received"
    });
  }

  function formatWeaponState(value) {
    var parts = [];
    var weaponName;
    var equipped;
    var count;

    if (!value || typeof value !== "object") {
      return getStringValue(value);
    }

    weaponName = getStringValue(value.name);
    equipped = normalizeBoolean(value.equipped);
    count = normalizeNumber(value.count);

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

  /*
   * me feature 공식 payload:
   *   health -> {"health":"{\"health\":100,\"ko_health\":100}"} (category: me)
   *   weaponState -> {name, equipped, count} (category: inventory)
   * health 0 + ko_health > 0 은 기절 상태로 표시한다(수치 노출은 자기 자신 상태만).
   */
  function applyMe(state, key, value) {
    var parsed = safeParse(value);
    var health;
    var koHealth;
    var nextState;

    if (key === "health") {
      if (parsed && typeof parsed === "object") {
        health = normalizeNumber(firstDefined([parsed.health, parsed.value, parsed.current_health, parsed.currentHealth]));
        koHealth = normalizeNumber(firstDefined([parsed.ko_health, parsed.koHealth]));
      } else {
        health = normalizeNumber(parsed);
        koHealth = null;
      }

      if (health === null) {
        return state;
      }

      return patch(state, {
        health: Math.round(health),
        koHealth: koHealth === null ? state.koHealth : Math.round(koHealth),
        knocked: health === 0 && koHealth !== null && koHealth > 0
      });
    }

    if (key === "weaponState") {
      return patch(state, {
        weaponState: formatWeaponState(parsed)
      });
    }

    if (key === "me" && parsed && typeof parsed === "object") {
      nextState = applyMe(state, "health", firstDefined([parsed.health, parsed.hp]));

      return applyMe(nextState, "weaponState", firstDefined([parsed.weaponState, parsed.weapon_state, parsed.weapon]));
    }

    // name/stance/view/movement 등 나머지 me key는 Phase 1 표시 범위 밖이므로 무시한다.
    return state;
  }

  function applyGepInternal(state, value) {
    var parsed = safeParse(value);

    if (!parsed || typeof parsed !== "object") {
      return state;
    }

    return patch(state, {
      gepLocalVersion: getStringValue(parsed.local_version),
      gepPublicVersion: getStringValue(parsed.public_version)
    });
  }

  function reduceInfoUpdate(state, rawUpdate) {
    var update = {
      feature: getStringValue(rawUpdate && rawUpdate.feature),
      category: getStringValue(rawUpdate && rawUpdate.category),
      key: getStringValue(rawUpdate && rawUpdate.key),
      value: rawUpdate ? rawUpdate.value : undefined
    };
    var nextState;

    if (!update.key) {
      return state;
    }

    if (BLOCKED_INFO_KEYS.indexOf(update.key) !== -1) {
      return recordIgnored(state, "blocked:" + update.key);
    }

    if (!update.feature) {
      update.feature = inferFeature(update.category, update.key);
    }

    nextState = recordDiagnostics(state, update);

    switch (update.feature) {
      case "phase":
        return applyPhase(nextState, update.value);
      case "match":
        return applyMatch(nextState, update.key, update.value);
      case "match_info":
        return applyMatchInfo(nextState, update.key, update.value);
      case "kill":
        return applyKill(nextState, update.key, update.value);
      case "roster":
        return applyRoster(nextState, update.key, update.value);
      case "me":
        return applyMe(nextState, update.key, update.value);
      case "gep_internal":
        return applyGepInternal(nextState, update.value);
      default:
        // rank, map, team, counters 등 Phase 1 미사용 feature는 상태에 반영하지 않는다.
        return recordIgnored(nextState, "unused:" + update.feature + ":" + update.key);
    }
  }

  function reduceInfoUpdatesEvent(state, event) {
    return normalizeInfoUpdatesEvent(event).reduce(function (accState, update) {
      return reduceInfoUpdate(accState, update);
    }, state);
  }

  /*
   * matchEnd는 사망 시점과 로비 복귀 시점에 각각 발생할 수 있다.
   * 첫 수신에서만 summaryReady를 세우고 이후에는 matchEndCount만 증가시킨다.
   */
  function reduceGameEvent(state, rawName, rawData) {
    var name = getStringValue(rawName);
    var data = safeParse(rawData);
    var nextState;
    var killerName;

    if (!name) {
      return state;
    }

    if (BLOCKED_EVENT_NAMES.indexOf(name) !== -1) {
      return recordIgnored(state, "blocked-event:" + name);
    }

    nextState = patch(state, {
      lastGepEventName: name,
      recentUpdates: ["event:" + name].concat(state.recentUpdates).slice(0, 6)
    });

    switch (name) {
      case "matchStart":
        return resetForNewMatch(nextState, new Date().toISOString());
      case "matchEnd":
        return patch(nextState, {
          matchEnded: true,
          matchEndedAt: nextState.matchEndedAt || new Date().toISOString(),
          matchEndCount: nextState.matchEndCount + 1,
          summaryReady: nextState.matchEndCount === 0 && !nextState.summarySent,
          lastEvent: "Match ended"
        });
      case "kill":
        return patch(nextState, {
          kills: nextState.kills + 1,
          lastEvent: "Kill confirmed"
        });
      case "death":
        return patch(nextState, {
          deaths: nextState.deaths + 1,
          lastEvent: "You died"
        });
      case "revived":
        return patch(nextState, {
          revives: nextState.revives + 1,
          knocked: false,
          lastEvent: "You were revived"
        });
      case "knockedout":
        return patch(nextState, {
          knockdowns: nextState.knockdowns + 1,
          knocked: true,
          lastEvent: "You were knocked out"
        });
      case "killer":
        killerName = data && data.killer_name ? getStringValue(data.killer_name) : "";

        return patch(nextState, {
          lastKillerName: killerName,
          lastEvent: killerName ? "Last killer: " + killerName : "Killer identified"
        });
      default:
        return recordIgnored(nextState, "unused-event:" + name);
    }
  }

  function reduceNewEventsEvent(state, event) {
    if (!event || !Array.isArray(event.events)) {
      return state;
    }

    return event.events.reduce(function (accState, entry) {
      if (!entry || !entry.name) {
        return accState;
      }

      return reduceGameEvent(accState, entry.name, entry.data);
    }, state);
  }

  function reduceGepError(state, event) {
    var reason = getStringValue(event && event.reason) || "unknown";

    return patch(state, {
      gepStatus: "error",
      gepErrorReason: reason,
      lastEvent: "Live events error"
    });
  }

  /*
   * 공식 game events status 엔드포인트 응답을 상태로 반영한다.
   * state: 0 unsupported, 1 green, 2 yellow, 3 red
   */
  function reduceServiceStatus(state, payload) {
    var parsed = safeParse(payload);
    var statusState;
    var message = "";

    if (!parsed || typeof parsed !== "object") {
      return state;
    }

    statusState = normalizeNumber(parsed.state);

    if (statusState === null) {
      return state;
    }

    if (parsed.maintenance_msg) {
      message = getStringValue(parsed.maintenance_msg);
    } else if (Array.isArray(parsed.features)) {
      message = parsed.features.filter(function (feature) {
        return feature && normalizeNumber(feature.state) !== 1 && REQUIRED_FEATURES.indexOf(feature.name) !== -1;
      }).map(function (feature) {
        return feature.name + "=" + feature.state;
      }).join(", ");
    }

    return patch(state, {
      serviceStatusState: statusState,
      serviceStatusMessage: message
    });
  }

  /*
   * 오버레이 경고 라인을 띄울지 판정한다.
   * 공식 status code 2(yellow)/3(red)이거나 GEP 자체가 오류/불가 상태일 때만 true다.
   * 오버레이 창 높이 계산과 HUD 표시가 같은 기준을 쓰도록 리듀서에 둔다.
   */
  function isServiceDegraded(state) {
    if (!state) {
      return false;
    }

    var statusState = normalizeNumber(state.serviceStatusState);

    return statusState === 2
      || statusState === 3
      || state.gepStatus === "error"
      || state.gepStatus === "unavailable";
  }

  /*
   * 서버(app/api/overwolf/session)가 허용하는 필드만 담는다.
   * identity(player_id/platform)는 GEP 닉네임이 아니라 사용자가 앱에서 입력한 값을 받는다.
   */
  function buildSessionSummary(state, clientEnvironment, identity) {
    return {
      session_id: state.sessionId,
      match_id: state.matchId || null,
      pseudo_match_id: state.pseudoMatchId || null,
      player_id: identity && identity.playerName ? identity.playerName : null,
      platform: identity && identity.platform ? identity.platform : null,
      gep_summary: {
        effective_match_id: state.effectiveMatchId || null,
        match_mode: state.matchMode || null,
        phase: state.phase,
        phase_is_official: state.phaseIsOfficial,
        kills: state.kills,
        deaths: state.deaths,
        revives: state.revives,
        knockdowns: state.knockdowns,
        alive_players: state.alivePlayers,
        last_killer_name: state.lastKillerName || null,
        match_started_at: state.matchStartedAt,
        match_ended_at: state.matchEndedAt,
        match_end_event_count: state.matchEndCount,
        gep_local_version: state.gepLocalVersion || null,
        gep_public_version: state.gepPublicVersion || null,
        source: "overwolf_gep"
      },
      client_environment: assign({
        app: "BGMS Companion",
        source: "overwolf"
      }, clientEnvironment || {})
    };
  }

  return {
    REQUIRED_FEATURES: REQUIRED_FEATURES,
    BLOCKED_INFO_KEYS: BLOCKED_INFO_KEYS,
    BLOCKED_EVENT_NAMES: BLOCKED_EVENT_NAMES,
    OFFICIAL_PHASES: OFFICIAL_PHASES,
    PUBG_CLASS_IDS: PUBG_CLASS_IDS,
    createInitialState: createInitialState,
    resetForNewMatch: resetForNewMatch,
    resolveClassId: resolveClassId,
    isPubgGameInfo: isPubgGameInfo,
    normalizeInfoUpdatesEvent: normalizeInfoUpdatesEvent,
    inferFeature: inferFeature,
    reduceInfoUpdate: reduceInfoUpdate,
    reduceInfoUpdatesEvent: reduceInfoUpdatesEvent,
    reduceGameEvent: reduceGameEvent,
    reduceNewEventsEvent: reduceNewEventsEvent,
    reduceGepError: reduceGepError,
    reduceServiceStatus: reduceServiceStatus,
    calculateAlivePlayers: calculateAlivePlayers,
    isServiceDegraded: isServiceDegraded,
    buildSessionSummary: buildSessionSummary,
    safeParse: safeParse,
    summarizeValue: summarizeValue
  };
});
