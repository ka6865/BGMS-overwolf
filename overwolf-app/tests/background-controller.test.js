/*
 * background 컨트롤러 스모크 테스트
 * 실행: node --test overwolf-app/tests/background-controller.test.js
 *
 * 실제 Overwolf 클라이언트 없이 dev-harness의 mock-overwolf.js를 vm 컨텍스트에 올려
 * PUBG 감지 -> setRequiredFeatures -> info/event 수신 -> 상태 반영 배선을 검증한다.
 * DOM이 필요한 in-game.js/desktop.js는 대상이 아니다.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const appDir = path.join(__dirname, "..");

function loadScript(sandbox, relativePath) {
  const code = fs.readFileSync(path.join(appDir, relativePath), "utf8");

  vm.runInContext(code, sandbox, { filename: relativePath });
}

function createSandbox(options) {
  const storage = {};
  const settings = options && options.settings;
  const sessionStatus = options && options.sessionStatus;
  const networkDown = options && options.networkDown;
  const initialQueue = options && options.queue;

  if (settings) {
    storage.bgms_companion_service_settings = JSON.stringify(settings);
  }

  if (initialQueue) {
    storage.bgms_companion_session_queue = JSON.stringify(initialQueue);
  }

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    // mock-overwolf.js가 window.fetch를 감싸 세션/상태 엔드포인트를 가로챈다.
    // 여기서는 그 외 요청이 새어 나가지 않도록 거부하는 기본 구현만 둔다.
    fetch: function () {
      return Promise.reject(new Error("unexpected network call in test"));
    },
    localStorage: {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
      },
      setItem: function (key, value) {
        storage[key] = String(value);
      },
      removeItem: function (key) {
        delete storage[key];
      }
    },
    crypto: {
      randomUUID: function () {
        return "00000000-0000-4000-8000-000000000000";
      }
    },
    dispatchEvent: function () {
      return true;
    },
    CustomEvent: function CustomEvent() {
      return {};
    }
  };

  sandbox.window = sandbox;
  vm.createContext(sandbox);

  loadScript(sandbox, "settings.js");
  loadScript(sandbox, "gep-state.js");
  loadScript(sandbox, "session-queue.js");
  loadScript(sandbox, "dev-harness/mock-overwolf.js");

  if (typeof sessionStatus === "number") {
    sandbox.mockGep.setSessionResponseStatus(sessionStatus);
  }

  if (networkDown) {
    sandbox.mockGep.setSessionNetworkDown(true);
  }

  loadScript(sandbox, "background.js");

  sandbox.readStoredQueue = function () {
    return JSON.parse(storage.bgms_companion_session_queue || "[]");
  };

  sandbox.storage = storage;

  return sandbox;
}

test("PUBG 감지 시 GEP 구독이 성공하고 class id가 환산된다", () => {
  const sandbox = createSandbox();
  const state = sandbox.bgmsController.getState();

  assert.equal(state.detectedGameId, 109061);
  assert.equal(state.detectedClassId, 10906);
  assert.equal(state.detectedGameRunning, true);
  assert.equal(state.gepStatus, "connected");
  assert.deepEqual(state.supportedFeatures, sandbox.bgmsGepState.REQUIRED_FEATURES);
});

test("getInfo snapshot으로 GEP 버전이 진단에 채워진다", () => {
  const sandbox = createSandbox();
  const state = sandbox.bgmsController.getState();

  assert.equal(state.gepLocalVersion, "157.0.1");
});

test("info/event payload가 컨트롤러 상태에 반영된다", () => {
  const sandbox = createSandbox();

  sandbox.mockGep.fireInfoUpdate("phase", "game_info", "phase", "airfield");
  sandbox.mockGep.fireBulkInfoUpdate({ me: { health: JSON.stringify({ health: 63, ko_health: 100 }) } }, "me");
  sandbox.mockGep.fireBulkInfoUpdate({
    match_info: {
      roster_0: JSON.stringify({ player: "A", kills: "0", out: false }),
      roster_1: JSON.stringify({ player: "B", kills: "0", out: true })
    }
  }, "roster");
  sandbox.mockGep.fireEvent("kill", "");

  const state = sandbox.bgmsController.getState();

  assert.equal(state.phase, "airfield");
  assert.equal(state.health, 63);
  assert.equal(state.alivePlayers, 1);
  assert.equal(state.kills, 1);
});

test("핸드오프가 꺼져 있으면 matchEnd에서 큐에 넣지 않는다", () => {
  const sandbox = createSandbox();

  sandbox.mockGep.fireEvent("matchStart", "");
  sandbox.mockGep.fireEvent("matchEnd", "");
  sandbox.mockGep.fireEvent("matchEnd", "");

  const state = sandbox.bgmsController.getState();

  assert.equal(state.matchEndCount, 2);
  assert.equal(state.summaryReady, false);
  assert.equal(state.handoffPending, 0);
  assert.deepEqual(sandbox.readStoredQueue(), []);
});

test("동의를 켜도 닉네임이 없으면 전송하지 않는다", () => {
  const sandbox = createSandbox({
    settings: { handoffEnabled: true, playerName: "", platform: "steam" }
  });

  sandbox.mockGep.fireEvent("matchStart", "");
  sandbox.mockGep.fireEvent("matchEnd", "");

  assert.deepEqual(sandbox.readStoredQueue(), []);
  assert.equal(sandbox.mockGep.sessionRequests().length, 0);
});

test("동의와 닉네임이 있으면 세션 요약을 한 번만 전송한다", async () => {
  const sandbox = createSandbox({
    settings: { handoffEnabled: true, playerName: "MyNick", platform: "kakao" },
    sessionStatus: 200
  });

  sandbox.mockGep.fireEvent("matchStart", "");
  sandbox.mockGep.fireEvent("kill", "");
  sandbox.mockGep.fireEvent("matchEnd", "");
  sandbox.mockGep.fireEvent("matchEnd", "");

  await new Promise((resolve) => setTimeout(resolve, 10));

  const requests = sandbox.mockGep.sessionRequests().map((body) => JSON.parse(body));
  const state = sandbox.bgmsController.getState();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].player_id, "MyNick");
  assert.equal(requests[0].platform, "kakao");
  assert.equal(requests[0].gep_summary.kills, 1);
  assert.ok(requests[0].session_id);
  assert.equal(state.handoffPending, 0);
  assert.equal(state.handoffOutcome, "sent");
  assert.deepEqual(sandbox.readStoredQueue(), []);
});

test("전송 payload에는 정책 금지 필드가 없다", async () => {
  const sandbox = createSandbox({
    settings: { handoffEnabled: true, playerName: "MyNick", platform: "steam" },
    sessionStatus: 200
  });

  sandbox.mockGep.fireEvent("matchStart", "");
  sandbox.mockGep.fireBulkInfoUpdate({ me: { damage_dealt: "120" } }, "me");
  sandbox.mockGep.fireEvent("matchEnd", "");

  await new Promise((resolve) => setTimeout(resolve, 10));

  const requests = sandbox.mockGep.sessionRequests();

  assert.equal(requests.length, 1);
  ["damage_dealt", "total_damage_dealt", "location", "team_location"].forEach((key) => {
    assert.equal(requests[0].includes(key), false);
  });
});

test("서버 오류는 큐에 남고 재시도 대상이 된다", async () => {
  const sandbox = createSandbox({
    settings: { handoffEnabled: true, playerName: "MyNick", platform: "steam" },
    sessionStatus: 503
  });

  sandbox.mockGep.fireEvent("matchStart", "");
  sandbox.mockGep.fireEvent("matchEnd", "");

  await new Promise((resolve) => setTimeout(resolve, 10));

  const queue = sandbox.readStoredQueue();
  const state = sandbox.bgmsController.getState();

  assert.equal(queue.length, 1);
  assert.equal(queue[0].attempts, 1);
  assert.equal(state.handoffPending, 1);
  assert.equal(state.handoffLastError, "http_503");
});

test("서버가 4xx로 거부하면 재시도하지 않고 큐를 비운다", async () => {
  const sandbox = createSandbox({
    settings: { handoffEnabled: true, playerName: "MyNick", platform: "steam" },
    sessionStatus: 422
  });

  sandbox.mockGep.fireEvent("matchStart", "");
  sandbox.mockGep.fireEvent("matchEnd", "");

  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(sandbox.readStoredQueue(), []);
  assert.equal(sandbox.bgmsController.getState().handoffOutcome, "rejected");
});

test("네트워크 단절 시 요약은 큐에 보존된다", async () => {
  const sandbox = createSandbox({
    settings: { handoffEnabled: true, playerName: "MyNick", platform: "steam" },
    networkDown: true
  });

  sandbox.mockGep.fireEvent("matchStart", "");
  sandbox.mockGep.fireEvent("kill", "");
  sandbox.mockGep.fireEvent("matchEnd", "");

  await new Promise((resolve) => setTimeout(resolve, 10));

  const queue = sandbox.readStoredQueue();
  const state = sandbox.bgmsController.getState();

  assert.equal(queue.length, 1);
  assert.equal(queue[0].payload.gep_summary.kills, 1);
  assert.equal(state.handoffPending, 1);
  assert.equal(state.handoffLastError, "network_error");
  assert.equal(sandbox.mockGep.sessionRequests().length, 0);
});

// 앱을 다시 켜면 이전 실행에서 남은 큐를 이어서 전송해야 한다.
test("재시작 후 보존된 큐를 이어서 전송한다", async () => {
  const failed = createSandbox({
    settings: { handoffEnabled: true, playerName: "MyNick", platform: "steam" },
    networkDown: true
  });

  failed.mockGep.fireEvent("matchStart", "");
  failed.mockGep.fireEvent("matchEnd", "");
  await new Promise((resolve) => setTimeout(resolve, 10));

  const carriedQueue = failed.readStoredQueue();

  assert.equal(carriedQueue.length, 1);

  // 백오프 대기를 지난 상태로 만들어 재시작 직후 전송 대상이 되게 한다.
  carriedQueue[0].nextAttemptAt = 0;

  const restarted = createSandbox({
    settings: { handoffEnabled: true, playerName: "MyNick", platform: "steam" },
    queue: carriedQueue,
    sessionStatus: 200
  });

  await new Promise((resolve) => setTimeout(resolve, 10));

  const requests = restarted.mockGep.sessionRequests().map((body) => JSON.parse(body));

  assert.equal(requests.length, 1);
  assert.equal(requests[0].session_id, carriedQueue[0].payload.session_id);
  assert.deepEqual(restarted.readStoredQueue(), []);
  assert.equal(restarted.bgmsController.getState().handoffOutcome, "sent");
});

test("GEP onError는 오류 상태와 사유를 노출한다", () => {
  const sandbox = createSandbox();

  sandbox.mockGep.fireError("provider disconnected");

  const state = sandbox.bgmsController.getState();

  assert.equal(state.gepStatus, "error");
  assert.equal(state.gepErrorReason, "provider disconnected");
});

test("PUBG가 아닌 게임으로 바뀌면 런타임 상태를 초기화한다", () => {
  const sandbox = createSandbox();

  sandbox.mockGep.fireInfoUpdate("phase", "game_info", "phase", "landed");
  sandbox.mockGep.fireGameInfoUpdated({ id: 212161, classId: 21216, isRunning: true });

  const state = sandbox.bgmsController.getState();

  assert.equal(state.detectedClassId, 21216);
  assert.equal(state.gepStatus, "idle");
  assert.equal(state.phase, "Idle");
  assert.equal(state.lastEvent, "Waiting for PUBG");
});

test("리스너는 재구독해도 중복 등록되지 않는다", () => {
  const sandbox = createSandbox();

  sandbox.bgmsController.ensureGepSubscription();
  sandbox.bgmsController.ensureGepSubscription();

  const counts = sandbox.mockGep.listenerCounts();

  assert.equal(counts.info, 1);
  assert.equal(counts.events, 1);
  assert.equal(counts.errors, 1);
});

test("오버레이 창 높이는 mini/debug 모드에 맞춰 조정된다", () => {
  const sandbox = createSandbox();

  sandbox.mockGep.resetWindowCalls();
  sandbox.bgmsController.applyOverlaySettings({ mode: "mini", opacity: 1, position: "top-left" });
  sandbox.bgmsController.applyOverlaySettings({ mode: "debug", opacity: 1, position: "top-left" });

  const heights = sandbox.mockGep.windowSizeCalls().map((call) => call.height);

  // debug 모드는 진단 7줄이 들어가므로 mini 보다 커야 한다.
  assert.equal(heights[0], 78);
  assert.equal(heights[1], 236);
  assert.ok(heights[1] > heights[0]);

  // 폭은 manifest in_game width 와 항상 같아야 한다.
  sandbox.mockGep.windowSizeCalls().forEach((call) => {
    assert.equal(call.width, 348);
  });
});

test("서비스 경고가 뜨면 mini 오버레이 높이가 경고 줄만큼 늘어난다", () => {
  const sandbox = createSandbox();

  sandbox.mockGep.resetWindowCalls();

  // onError 는 gepStatus 를 error 로 만들어 경고 라인을 띄운다.
  sandbox.mockGep.fireError({ reason: "provider disconnected" });

  const degradedHeights = sandbox.mockGep.windowSizeCalls().map((call) => call.height);

  assert.ok(degradedHeights.length > 0, "경고 전환 시 창 크기를 다시 맞춰야 한다");
  assert.equal(degradedHeights[degradedHeights.length - 1], 100);
  assert.equal(sandbox.bgmsGepState.isServiceDegraded(sandbox.bgmsController.getState()), true);

  // 경고 상태가 유지되는 동안 같은 이벤트가 또 와도 창 크기를 반복 변경하지 않는다.
  sandbox.mockGep.resetWindowCalls();
  sandbox.mockGep.fireError({ reason: "provider disconnected" });

  assert.equal(sandbox.mockGep.windowSizeCalls().length, 0);
});

test("openSessionHistory: 닉네임과 플랫폼을 붙여 BGMS 웹 세션 기록을 연다", () => {
  const sandbox = createSandbox({
    settings: { handoffEnabled: true, playerName: "TestPlayer", platform: "kakao" }
  });

  const url = sandbox.bgmsController.openSessionHistory();
  const opened = sandbox.mockGep.openedUrls();

  assert.equal(opened.length, 1);
  assert.equal(opened[0], url);
  assert.equal(url.indexOf("https://bgms.kr/overwolf/sessions?"), 0);
  assert.ok(url.indexOf("player=TestPlayer") !== -1);
  assert.ok(url.indexOf("platform=kakao") !== -1);
});

test("openSessionHistory: 닉네임이 없으면 쿼리 없이 기본 경로를 연다", () => {
  const sandbox = createSandbox();

  const url = sandbox.bgmsController.openSessionHistory();

  assert.equal(url, "https://bgms.kr/overwolf/sessions?platform=steam");
  assert.equal(sandbox.mockGep.openedUrls().length, 1);
});

test("openSessionHistory: BGMS 세션 경로 외의 도메인은 열지 않는다", () => {
  const sandbox = createSandbox({
    settings: { handoffEnabled: true, playerName: "TestPlayer", platform: "steam" }
  });

  sandbox.bgmsController.openSessionHistory();

  sandbox.mockGep.openedUrls().forEach((opened) => {
    assert.equal(opened.indexOf("https://bgms.kr/"), 0);
  });
});
