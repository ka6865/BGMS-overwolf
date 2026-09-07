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

test("rank.me는 me.health를 오염시키지 않고 순위로 해석된다", () => {
  let state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "me",
    info: { me: { health: "{\"health\":80,\"ko_health\":100}" } }
  });

  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "rank",
    info: { match_info: { me: "38", total: "98" } }
  });

  // 같은 key 이름(me)이지만 feature 기준으로 분기되므로 health 는 그대로여야 한다.
  assert.equal(state.health, 80);
  assert.equal(state.rankPlace, 38);
  assert.equal(state.rankTotal, 98);

  // 역방향도 확인한다. me.health 가 rank 값을 덮지 않아야 한다.
  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "me",
    info: { me: { health: "{\"health\":45,\"ko_health\":100}" } }
  });

  assert.equal(state.health, 45);
  assert.equal(state.rankPlace, 38);
});

test("map: 맵 이름만 반영하고 좌표 키는 무시한다", () => {
  let state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "map",
    info: { map_info: { map: "Erangel_Main" } }
  });

  assert.equal(state.mapName, "Erangel_Main");

  // location feature 는 여전히 차단 대상이다.
  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "location",
    info: { me: { location: "{\"x\":1,\"y\":2}" } }
  });

  assert.equal(state.mapName, "Erangel_Main");
  assert.ok(state.ignoredUpdates.some((entry) => entry.indexOf("blocked:location") === 0));
});

test("kill: headshots와 max_kill_distance를 수집하고 damage는 차단한다", () => {
  let state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "kill",
    info: { me: { kills: "3", headshots: "2", max_kill_distance: "184.5" } }
  });

  assert.equal(state.kills, 3);
  assert.equal(state.headshots, 2);
  assert.equal(state.maxKillDistance, 184.5);

  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "kill",
    info: { me: { total_damage_dealt: "412.8" } }
  });

  assert.equal(state.headshots, 2);
  assert.ok(state.ignoredUpdates.some((entry) => entry.indexOf("blocked:total_damage_dealt") === 0));
  assert.equal(JSON.stringify(state).indexOf("412.8"), -1);
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

test("buildSessionSummary: 사후 분석 연결 필드와 타임라인을 담는다", () => {
  let state = gep.reduceGameEvent(baseState(), "matchStart", "");

  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "match",
    info: { match_info: { match_id: "match.bro.official.pc-2018-01.steam.squad-fpp.as.2026.08.01.abc", mode: "squad-fpp" } }
  });
  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "map",
    info: { map_info: { map: "Erangel_Main" } }
  });
  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "kill",
    info: { me: { kills: "4", headshots: "2", max_kill_distance: "212.75" } }
  });
  state = gep.reduceGameEvent(state, "death", "");
  state = gep.reduceNewEventsEvent(state, {
    events: [{ name: "killer", data: "{\"killer_name\":\"Ace_Tullis\"}" }]
  });
  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "rank",
    info: { match_info: { me: "7", total: "96" } }
  });
  state = gep.reduceGameEvent(state, "matchEnd", "");

  const summary = gep.buildSessionSummary(state, { version: "0.5.0" }, {
    playerName: "TestPlayer",
    platform: "steam"
  });

  // 공식 API 조회 가능한 match_id 를 따로 담는다.
  assert.equal(summary.gep_summary.official_match_id.indexOf("match.bro.official"), 0);
  assert.equal(summary.gep_summary.map_name, "Erangel_Main");
  assert.equal(summary.gep_summary.headshots, 2);
  assert.equal(summary.gep_summary.max_kill_distance, 212.75);
  assert.equal(summary.gep_summary.rank_place, 7);
  assert.equal(summary.gep_summary.rank_total, 96);
  assert.equal(summary.gep_summary.last_killer_name, "Ace_Tullis");

  // 타임라인은 최상위 키로 나간다. gep_summary 안이면 서버 스칼라 화이트리스트에 걸린다.
  assert.ok(Array.isArray(summary.event_timeline));
  assert.deepEqual(summary.event_timeline.map((entry) => entry.kind), ["death", "killer"]);

  const serialized = JSON.stringify(summary);

  assert.equal(serialized.indexOf("damage"), -1);
  assert.equal(serialized.indexOf("location"), -1);
  // 서버 payload 제한(16KB) 대비 여유가 있어야 한다.
  assert.ok(Buffer.byteLength(serialized) < 4096);
});

test("buildSessionSummary: pseudo_match_id만 있으면 official_match_id는 비운다", () => {
  let state = gep.reduceGameEvent(baseState(), "matchStart", "");

  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "match_info",
    info: { match_info: { pseudo_match_id: "0c0ea3df-97ea-4d3a-b1f6-f8e34042251f" } }
  });
  state = gep.reduceGameEvent(state, "matchEnd", "");

  const summary = gep.buildSessionSummary(state, {});

  // pseudo_match_id 는 Overwolf 생성값이라 공식 API 조회 키로 쓸 수 없다.
  assert.equal(summary.gep_summary.official_match_id, null);
  assert.equal(summary.pseudo_match_id, "0c0ea3df-97ea-4d3a-b1f6-f8e34042251f");
  assert.equal(summary.gep_summary.effective_match_id, "0c0ea3df-97ea-4d3a-b1f6-f8e34042251f");
});

test("REQUIRED_FEATURES는 허용 목록과 동일하다", () => {
  assert.deepEqual(gep.REQUIRED_FEATURES, [
    "match",
    "match_info",
    "phase",
    "kill",
    "death",
    "revived",
    "killer",
    "roster",
    "me",
    "rank",
    "map"
  ]);

  // 금지 feature 가 구독 목록에 섞여 들어가지 않는지 확인한다.
  ["location", "team", "counters"].forEach((feature) => {
    assert.equal(gep.REQUIRED_FEATURES.indexOf(feature), -1);
  });
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

test("eventTimeline: 사후 리뷰용으로 이벤트 시점을 기록하고 좌표는 담지 않는다", () => {
  let state = gep.reduceGameEvent(baseState(), "matchStart", "");

  state = gep.reduceGameEvent(state, "kill", "");
  state = gep.reduceGameEvent(state, "knockedout", "");
  state = gep.reduceGameEvent(state, "revived", "");
  state = gep.reduceGameEvent(state, "death", "");
  state = gep.reduceNewEventsEvent(state, {
    events: [{ name: "killer", data: "{\"killer_name\":\"Ace_Tullis\"}" }]
  });

  assert.deepEqual(state.eventTimeline.map((entry) => entry.kind), [
    "kill",
    "knockedout",
    "revived",
    "death",
    "killer"
  ]);

  // 경과 초는 matchStart 기준이며 음수가 아니어야 한다.
  state.eventTimeline.forEach((entry) => {
    assert.equal(typeof entry.t, "number");
    assert.ok(entry.t >= 0);
  });

  // killer 만 상대 닉네임을 detail 로 남긴다.
  assert.equal(state.eventTimeline[4].detail, "Ace_Tullis");
  assert.equal(state.eventTimeline[0].detail, undefined);

  // 좌표 계열 키가 타임라인에 섞이지 않는다.
  const serialized = JSON.stringify(state.eventTimeline);

  assert.equal(serialized.indexOf("location"), -1);
  assert.equal(serialized.indexOf("damage"), -1);
});

test("eventTimeline: matchStart 이전 이벤트는 경과 초를 null로 남긴다", () => {
  const state = gep.reduceGameEvent(baseState(), "death", "");

  assert.equal(state.eventTimeline.length, 1);
  assert.equal(state.eventTimeline[0].t, null);
});

test("eventTimeline: 최대 항목 수를 넘으면 더 쌓지 않는다", () => {
  let state = gep.reduceGameEvent(baseState(), "matchStart", "");

  for (let i = 0; i < gep.MAX_TIMELINE_ENTRIES + 15; i += 1) {
    state = gep.reduceGameEvent(state, "kill", "");
  }

  assert.equal(state.eventTimeline.length, gep.MAX_TIMELINE_ENTRIES);
  // 카운터 자체는 계속 증가한다. 타임라인 상한이 킬 집계를 막지 않는다.
  assert.equal(state.kills, gep.MAX_TIMELINE_ENTRIES + 15);
});

test("matchStart: 타임라인과 순위는 초기화하되 맵 이름은 유지한다", () => {
  let state = gep.reduceInfoUpdatesEvent(baseState(), {
    feature: "map",
    info: { map_info: { map: "Miramar_Main" } }
  });

  state = gep.reduceGameEvent(state, "matchStart", "");
  state = gep.reduceGameEvent(state, "kill", "");
  state = gep.reduceInfoUpdatesEvent(state, {
    feature: "rank",
    info: { match_info: { me: "12", total: "97" } }
  });

  assert.equal(state.eventTimeline.length, 1);
  assert.equal(state.rankPlace, 12);

  // 다음 매치가 시작되면 순위와 타임라인은 비우고 맵 이름은 남긴다.
  state = gep.reduceGameEvent(state, "matchStart", "");

  assert.equal(state.eventTimeline.length, 0);
  assert.equal(state.rankPlace, null);
  assert.equal(state.rankTotal, null);
  assert.equal(state.headshots, 0);
  assert.equal(state.mapName, "Miramar_Main");
});
