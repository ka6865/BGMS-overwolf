/*
 * GEP 상태 리듀서 단위 테스트
 * 실행: node --test overwolf-app/tests
 *
 * 모든 픽스처는 PUBG 공식 GEP 문서의 payload 예시를 그대로 사용한다.
 * 실게임/Overwolf 클라이언트 없이 파서 회귀를 잡는 것이 목적이다.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const gep = require("../gep-state.js");

function baseState() {
  return gep.createInitialState({ sessionId: "test-session" });
}

test("resolveClassId: instance id를 manifest용 class id로 환산한다", () => {
  assert.equal(gep.resolveClassId({ id: 109061 }), 10906);
  assert.equal(gep.resolveClassId({ id: 109061, classId: 10906 }), 10906);
  assert.equal(gep.resolveClassId({ id: 10906 }), 10906);
  assert.equal(gep.resolveClassId(null), null);
});

test("isPubgGameInfo: 실행 중인 PUBG instance만 true", () => {
  assert.equal(gep.isPubgGameInfo({ id: 109061, isRunning: true }), true);
  assert.equal(gep.isPubgGameInfo({ id: 109061, isRunning: false }), false);
  assert.equal(gep.isPubgGameInfo({ id: 212161, isRunning: true }), false);
});

test("phase: 공식 payload와 관측값 starting을 모두 처리한다", () => {
  let state = gep.reduceInfoUpdate(baseState(), {
    feature: "phase",
    category: "game_info",
    key: "phase",
    value: "lobby"
  });

  assert.equal(state.phase, "lobby");
  assert.equal(state.phaseIsOfficial, true);

  state = gep.reduceInfoUpdate(state, {
    feature: "phase",
    category: "game_info",
    key: "phase",
    value: "starting"
  });

  assert.equal(state.phase, "starting");
  assert.equal(state.phaseIsOfficial, false);
});

test("match/match_info: match_id와 pseudo_match_id를 함께 보존한다", () => {
  let state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "match_info",
    info: { match_info: { pseudo_match_id: "0c0ea3df-97ea-4d3a-b1f6-f8e34042251f" } }
  });

  assert.equal(state.pseudoMatchId, "0c0ea3df-97ea-4d3a-b1f6-f8e34042251f");
  assert.equal(state.effectiveMatchId, "0c0ea3df-97ea-4d3a-b1f6-f8e34042251f");

  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "match",
    info: { match_info: { match_id: "match.bro.official.pc-2018-03.steam.solo.eu" } }
  });

  assert.equal(state.matchId, "match.bro.official.pc-2018-03.steam.solo.eu");
  assert.equal(state.effectiveMatchId, "match.bro.official.pc-2018-03.steam.solo.eu");
  assert.equal(state.pseudoMatchId, "0c0ea3df-97ea-4d3a-b1f6-f8e34042251f");
});

test("me.health: 문자열 JSON payload에서 health와 ko_health를 읽는다", () => {
  const state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "me",
    info: { me: { health: "{\"health\":100,\"ko_health\":100}" } }
  });

  assert.equal(state.health, 100);
  assert.equal(state.koHealth, 100);
  assert.equal(state.knocked, false);
});

test("me.health: health 0 + ko_health 잔존은 기절로 표시한다", () => {
  const state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "me",
    info: { me: { health: "{\"health\":0,\"ko_health\":42}" } }
  });

  assert.equal(state.health, 0);
  assert.equal(state.knocked, true);
});

test("me.weaponState: inventory category payload를 사람이 읽는 문자열로 만든다", () => {
  const state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "me",
    info: { inventory: { weaponState: "{\"name\":\"M416\",\"equipped\":true,\"count\":120}" } }
  });

  assert.equal(state.weaponState, "M416 equipped x120");
});

test("rank.me는 me.health를 오염시키지 않는다", () => {
  let state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "me",
    info: { me: { health: "{\"health\":80,\"ko_health\":100}" } }
  });

  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "rank",
    info: { match_info: { me: "38", total: "98" } }
  });

  assert.equal(state.health, 80);
  assert.ok(state.ignoredUpdates.some((entry) => entry.indexOf("unused:rank") === 0));
});

test("roster: 공식 roster_XX payload로 생존자 수를 계산한다", () => {
  let state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "roster",
    info: {
      match_info: {
        roster_0: "{\"player\":\"Dr4ex\",\"kills\":\"0\",\"out\":false}",
        roster_1: "{\"player\":\"Bob\",\"kills\":\"0\",\"out\":false}",
        roster_2: "{\"player\":\"Cid\",\"kills\":\"0\",\"out\":true}"
      }
    }
  });

  assert.equal(state.alivePlayers, 2);

  state = gep.reduceInfoUpdate(state, {
    feature: "roster",
    category: "match_info",
    key: "roster_1",
    value: "{\"player\":\"Bob\",\"kills\":\"0\",\"out\":true}"
  });

  assert.equal(state.alivePlayers, 1);
});

test("roster: 판독 불가 payload는 이전 생존자 수를 유지한다", () => {
  let state = gep.reduceInfoUpdate(baseState(), {
    feature: "roster",
    category: "match_info",
    key: "roster_0",
    value: "{\"player\":\"Dr4ex\",\"kills\":\"0\",\"out\":false}"
  });

  assert.equal(state.alivePlayers, 1);

  state = gep.reduceInfoUpdate(state, {
    feature: "roster",
    category: "match_info",
    key: "roster_9",
    value: "not-json"
  });

  assert.equal(state.alivePlayers, 1);
});

test("kill: info kills는 절대값, kill 이벤트는 증분으로 처리한다", () => {
  let state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "kill",
    info: { match_info: { kills: "3" } }
  });

  assert.equal(state.kills, 3);

  state = gep.reduceGameEvent(state, "kill", "");

  assert.equal(state.kills, 4);
});

test("matchEnd: 중복 수신 시 요약 대상은 첫 이벤트 한 번만이다", () => {
  let state = gep.reduceGameEvent(baseState(), "matchStart", "");

  state = gep.reduceGameEvent(state, "matchEnd", "");

  assert.equal(state.matchEnded, true);
  assert.equal(state.matchEndCount, 1);
  assert.equal(state.summaryReady, true);

  const firstEndedAt = state.matchEndedAt;

  state = gep.reduceGameEvent(state, "matchEnd", "");

  assert.equal(state.matchEndCount, 2);
  assert.equal(state.summaryReady, false);
  assert.equal(state.matchEndedAt, firstEndedAt);
});

test("matchStart: 카운터는 초기화하되 식별자와 진단은 유지하고 세션 id는 새로 발급한다", () => {
  let state = baseState();

  state = gep.reduceInfoUpdate(state, {
    feature: "match",
    category: "match_info",
    key: "match_id",
    value: "match-1"
  });
  state = gep.reduceInfoUpdate(state, {
    feature: "phase",
    category: "game_info",
    key: "phase",
    value: "airfield"
  });
  state = gep.reduceGameEvent(state, "kill", "");

  const previousSessionId = state.sessionId;

  state = gep.reduceGameEvent(state, "matchStart", "");

  assert.equal(state.kills, 0);
  assert.equal(state.matchId, "match-1");
  assert.equal(state.phase, "airfield");
  assert.notEqual(state.sessionId, previousSessionId);
  assert.ok(state.matchStartedAt);
});

test("killer: 공식 payload에서 killer_name을 읽는다", () => {
  const state = gep.reduceGameEvent(baseState(), "killer", "{ \"killer_name\": \"Ace_Tullis\"}");

  assert.equal(state.lastKillerName, "Ace_Tullis");
  assert.equal(state.lastEvent, "Last killer: Ace_Tullis");
});

test("knockedout/revived: 기절과 부활 카운터를 분리해 관리한다", () => {
  let state = gep.reduceGameEvent(baseState(), "knockedout", "");

  assert.equal(state.knockdowns, 1);
  assert.equal(state.knocked, true);

  state = gep.reduceGameEvent(state, "revived", "");

  assert.equal(state.revives, 1);
  assert.equal(state.knocked, false);
});

test("정책 금지 payload는 상태에 반영되지 않는다", () => {
  let state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "kill",
    info: { match_info: { total_damage_dealt: "100" } }
  });

  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "location",
    info: { game_info: { location: "{\"x\":2300,\"y\":5740,\"z\":1520}" } }
  });

  state = gep.reduceGameEvent(state, "damage_dealt", "39.102");
  state = gep.reduceGameEvent(state, "damageTaken", "");

  assert.equal(state.lastFeature, "");
  assert.equal(state.lastGepEventName, "");
  assert.deepEqual(Object.keys(state.seenInfoFeatures), []);
  assert.ok(state.ignoredUpdates.indexOf("blocked:total_damage_dealt") !== -1);
  assert.ok(state.ignoredUpdates.indexOf("blocked:location") !== -1);
  assert.ok(state.ignoredUpdates.indexOf("blocked-event:damage_dealt") !== -1);
  assert.ok(state.ignoredUpdates.indexOf("blocked-event:damageTaken") !== -1);
});

test("gep_internal: 진단용 GEP 버전을 저장한다", () => {
  const state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "gep_internal",
    info: {
      gep_internal: {
        version_info: "{\"local_version\":\"157.0.1\",\"public_version\":\"157.0.1\",\"is_updated\":true}"
      }
    }
  });

  assert.equal(state.gepLocalVersion, "157.0.1");
  assert.equal(state.gepPublicVersion, "157.0.1");
});

test("feature 이름이 비어 있으면 category/key로 추론한다", () => {
  const state = gep.reduceInfoUpdatesEvent(baseState(), {
    info: {
      game_info: { phase: "aircraft" },
      me: { health: "{\"health\":55,\"ko_health\":100}" },
      inventory: { weaponState: "{\"name\":\"Beryl\",\"equipped\":false,\"count\":30}" }
    }
  });

  assert.equal(state.phase, "aircraft");
  assert.equal(state.health, 55);
  assert.equal(state.weaponState, "Beryl holstered x30");
});

test("onError: 상태를 error로 바꾸고 사유를 남긴다", () => {
  const state = gep.reduceGepError(baseState(), { reason: "provider disconnected" });

  assert.equal(state.gepStatus, "error");
  assert.equal(state.gepErrorReason, "provider disconnected");
});

test("service status: 공식 응답의 state와 문제 feature를 반영한다", () => {
  let state = gep.reduceServiceStatus(baseState(), {
    game_id: 10906,
    state: 2,
    features: [
      { name: "me", state: 3, keys: [] },
      { name: "phase", state: 1, keys: [] },
      { name: "victimName", state: 0, keys: [] }
    ]
  });

  assert.equal(state.serviceStatusState, 2);
  assert.equal(state.serviceStatusMessage, "me=3");

  state = gep.reduceServiceStatus(state, {
    game_id: 10906,
    state: 3,
    maintenance_msg: "Events are disabled",
    disabled: true
  });

  assert.equal(state.serviceStatusState, 3);
  assert.equal(state.serviceStatusMessage, "Events are disabled");
});

test("buildSessionSummary: 서버 스키마에 필요한 필드만 담고 금지 데이터는 없다", () => {
  let state = gep.reduceGameEvent(baseState(), "matchStart", "");

  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "match",
    info: { match_info: { match_id: "match-42", mode: "squad" } }
  });
  state = gep.reduceGameEvent(state, "kill", "");
  state = gep.reduceGameEvent(state, "matchEnd", "");

  const summary = gep.buildSessionSummary(state, { version: "0.2.0" });
  const serialized = JSON.stringify(summary);

  assert.equal(summary.match_id, "match-42");
  assert.equal(summary.gep_summary.kills, 1);
  assert.equal(summary.gep_summary.match_mode, "squad");
  assert.equal(summary.gep_summary.match_end_event_count, 1);
  assert.equal(summary.client_environment.version, "0.2.0");
  assert.equal(summary.client_environment.source, "overwolf");
  assert.equal(serialized.indexOf("damage"), -1);
  assert.equal(serialized.indexOf("location"), -1);
});

test("REQUIRED_FEATURES는 Phase 1 허용 목록과 동일하다", () => {
  assert.deepEqual(gep.REQUIRED_FEATURES, [
    "match",
    "match_info",
    "phase",
    "kill",
    "death",
    "revived",
    "killer",
    "roster",
    "me"
  ]);
});

test("isServiceDegraded: 경고 라인 표시 기준을 한 곳에서 판정한다", () => {
  const state = baseState();

  assert.equal(gep.isServiceDegraded(state), false);
  assert.equal(gep.isServiceDegraded(null), false);

  // 공식 status code 0(unsupported)과 1(green)은 경고가 아니다.
  assert.equal(gep.isServiceDegraded(Object.assign({}, state, { serviceStatusState: 0 })), false);
  assert.equal(gep.isServiceDegraded(Object.assign({}, state, { serviceStatusState: 1 })), false);

  assert.equal(gep.isServiceDegraded(Object.assign({}, state, { serviceStatusState: 2 })), true);
  assert.equal(gep.isServiceDegraded(Object.assign({}, state, { serviceStatusState: 3 })), true);
  assert.equal(gep.isServiceDegraded(Object.assign({}, state, { gepStatus: "error" })), true);
  assert.equal(gep.isServiceDegraded(Object.assign({}, state, { gepStatus: "unavailable" })), true);

  // reduceServiceStatus / reduceGepError 를 거친 실제 상태에서도 같은 판정이 나와야 한다.
  assert.equal(gep.isServiceDegraded(gep.reduceServiceStatus(state, { game_id: 10906, state: 2 })), true);
  assert.equal(gep.isServiceDegraded(gep.reduceGepError(state, { reason: "provider disconnected" })), true);
});
