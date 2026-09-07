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

  if (options && options.configure) {
    options.configure(sandbox);
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

test("getAssignedHotkeys: manifest 기본값이 아니라 실제 할당된 조합을 읽는다", () => {
  const sandbox = createSandbox();
  let received = null;

  sandbox.bgmsController.getAssignedHotkeys((assigned) => {
    received = assigned;
  });

  assert.ok(received, "핫키 조회 결과가 있어야 한다");
  assert.equal(received.toggle_overlay, "Ctrl+Shift+B");
  // 사용자가 바꾼 값(Alt+G)이 manifest 기본값(Ctrl+Shift+G)보다 우선한다.
  assert.equal(received.open_desktop, "Alt+G");
});

test("openHotkeySettings: Overwolf 핫키 설정 화면을 연다", () => {
  const sandbox = createSandbox();

  const opened = sandbox.bgmsController.openHotkeySettings();
  const urls = sandbox.mockGep.openedUrls();

  assert.equal(opened, true);
  assert.equal(urls.length, 1);
  assert.equal(urls[0], "overwolf://settings/hotkeys");
});

test("openExternalLink: 화이트리스트 키만 열고 임의 URL은 거부한다", () => {
  const sandbox = createSandbox();

  const community = sandbox.bgmsController.openExternalLink("community");
  const discord = sandbox.bgmsController.openExternalLink("discord");

  assert.equal(community, "https://bgms.kr/board");
  assert.equal(discord, "https://discord.gg/T97MR78awb");

  // 화이트리스트 밖의 값은 아무것도 열지 않는다.
  assert.equal(sandbox.bgmsController.openExternalLink("evil"), null);
  assert.equal(sandbox.bgmsController.openExternalLink("https://attacker.example"), null);
  assert.equal(sandbox.bgmsController.openExternalLink(""), null);
  assert.equal(sandbox.bgmsController.openExternalLink(undefined), null);

  const opened = sandbox.mockGep.openedUrls();

  assert.equal(opened.length, 2, "허용된 두 건만 열려야 한다");
  opened.forEach((url) => {
    assert.ok(
      url === "https://bgms.kr/board" || url === "https://discord.gg/T97MR78awb",
      "예상 밖의 URL이 열렸다: " + url
    );
  });
});

// 실제 시간을 기다리지 않고 재시도 시각과 유휴 타이머를 검증한다.
function installClock(sandbox) {
  let timestamp = 100000;
  let nextId = 0;
  const timers = new Map();
  sandbox.Date = class extends Date {
    constructor(...args) { super(...(args.length ? args : [timestamp])); }
    static now() { return timestamp; }
  };
  sandbox.setTimeout = (callback, delay) => {
    timers.set(++nextId, { callback, at: timestamp + delay });
    return nextId;
  };
  sandbox.clearTimeout = (id) => timers.delete(id);
  sandbox.setInterval = () => { throw new Error("유휴 폴링은 허용하지 않는다"); };
  return {
    pending: () => timers.size,
    async tick(ms) {
      const end = timestamp + ms;
      for (;;) {
        // fetch 및 응답 JSON의 마이크로태스크를 먼저 처리한다.
        for (let i = 0; i < 10; i++) await Promise.resolve();
        const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timestamp = due[1].at;
        timers.delete(due[0]);
        due[1].callback();
      }
      timestamp = end;
    }
  };
}

const runningPubg = { id: 109061, classId: 10906, isRunning: true, logicalWidth: 1920 };

test("포커스 갱신 100회는 숨긴 HUD를 다시 띄우거나 상태 서버를 재조회하지 않는다", () => {
  let restores = 0;
  let statusRequests = 0;
  const sandbox = createSandbox({ configure(s) {
    const fetch = s.fetch;
    s.fetch = (...args) => { statusRequests++; return fetch(...args); };
    s.overwolf.windows.restore = (_id, callback) => { restores++; callback(); };
  } });
  const initialRequests = statusRequests;
  const initialRestores = restores;
  sandbox.bgmsController.hideOverlay();
  sandbox.mockGep.resetWindowCalls();
  for (let i = 0; i < 100; i++) sandbox.mockGep.fireGameInfoUpdated(runningPubg);
  assert.equal(statusRequests, initialRequests);
  assert.equal(restores, initialRestores);
  assert.equal(sandbox.mockGep.windowSizeCalls().length, 0);
  sandbox.bgmsController.showOverlay();
  assert.equal(restores, initialRestores + 1);
  sandbox.mockGep.resetWindowCalls();
  sandbox.mockGep.fireGameInfoUpdated({ ...runningPubg, logicalWidth: 2560 });
  assert.equal(sandbox.mockGep.windowPositionCalls().length, 1);
});

test("이벤트 100개를 손실 없이 반영하고 UI 알림은 50ms마다 한 번으로 합친다", async () => {
  let clock;
  const sandbox = createSandbox({ configure(s) { clock = installClock(s); } });
  await clock.tick(2000);
  let notifications = 0;
  let latest;
  const unsubscribe = sandbox.bgmsController.subscribe((state) => { notifications++; latest = state; });
  for (let i = 0; i < 100; i++) sandbox.mockGep.fireEvent("kill", "");
  assert.equal(sandbox.bgmsController.getState().kills, 100);
  assert.equal(notifications, 1, "구독 시 첫 스냅샷만 즉시 전달한다");
  await clock.tick(50);
  assert.equal(notifications, 2);
  assert.equal(latest.kills, 100);
  sandbox.mockGep.fireEvent("kill", "");
  unsubscribe();
  assert.equal(clock.pending(), 0);
});

test("전송 꺼짐 또는 빈 큐에서는 주기적으로 깨우는 타이머가 없다", async () => {
  for (const settings of [{ handoffEnabled: false }, { handoffEnabled: true, playerName: "Player" }]) {
    let clock;
    createSandbox({ settings, configure(s) { clock = installClock(s); } });
    await clock.tick(2000);
    assert.equal(clock.pending(), 0);
  }
});

test("15초 무응답 전송은 한 번 실패 처리하고 5초 뒤 재시도하며 늦은 응답은 무시한다", async () => {
  let clock;
  let finishStalled;
  let calls = 0;
  const sandbox = createSandbox({
    settings: { handoffEnabled: true, playerName: "Player" },
    configure(s) {
      clock = installClock(s);
      const fetch = s.fetch;
      s.fetch = (url, options) => {
        if (!url.includes("/api/overwolf/session")) return fetch(url, options);
        calls++;
        if (calls === 1) return new Promise((resolve) => { finishStalled = resolve; });
        return Promise.resolve({ ok: true, status: 200 });
      };
    }
  });
  sandbox.mockGep.fireEvent("matchStart", "");
  sandbox.mockGep.fireEvent("matchEnd", "");
  await clock.tick(15000);
  assert.equal(sandbox.readStoredQueue()[0].attempts, 1);
  assert.equal(sandbox.readStoredQueue()[0].nextAttemptAt, 120000);
  finishStalled({ ok: true, status: 200 });
  await clock.tick(0);
  assert.equal(sandbox.readStoredQueue().length, 1);
  await clock.tick(4999);
  assert.equal(calls, 1);
  await clock.tick(1);
  assert.equal(calls, 2);
  assert.equal(sandbox.readStoredQueue().length, 0);
  assert.equal(clock.pending(), 0);
});

test("첫 세션이 영구 거부되어도 다음 세션을 즉시 전송한다", async () => {
  let clock;
  const requests = [];
  const sandbox = createSandbox({
    settings: { handoffEnabled: true, playerName: "Player" },
    queue: [{ payload: { session_id: "reject" } }, { payload: { session_id: "accept" } }],
    configure(s) {
      clock = installClock(s);
      const fetch = s.fetch;
      s.fetch = (url, options) => {
        if (!url.includes("/api/overwolf/session")) return fetch(url, options);
        const id = JSON.parse(options.body).session_id;
        requests.push(id);
        return Promise.resolve({ ok: id === "accept", status: id === "accept" ? 200 : 422 });
      };
    }
  });
  await clock.tick(0);
  assert.deepEqual(requests, ["reject", "accept"]);
  assert.equal(sandbox.readStoredQueue().length, 0);
});

test("전송 동의를 끄면 예약 재시도를 취소하고 다시 켜면 보존된 큐를 전송한다", async () => {
  let clock;
  const sandbox = createSandbox({
    settings: { handoffEnabled: true, playerName: "Player" },
    networkDown: true,
    configure(s) { clock = installClock(s); }
  });
  sandbox.mockGep.fireEvent("matchStart", "");
  sandbox.mockGep.fireEvent("matchEnd", "");
  await clock.tick(2000);
  sandbox.bgmsSettings.write({ handoffEnabled: false, playerName: "Player" });
  sandbox.bgmsController.applyServiceSettings({ handoffEnabled: false, playerName: "Player" });
  assert.equal(clock.pending(), 0);
  await clock.tick(10000);
  assert.equal(sandbox.readStoredQueue()[0].attempts, 1);
  sandbox.mockGep.setSessionNetworkDown(false);
  sandbox.bgmsSettings.write({ handoffEnabled: true, playerName: "Player" });
  sandbox.bgmsController.applyServiceSettings({ handoffEnabled: true, playerName: "Player" });
  await clock.tick(0);
  assert.equal(sandbox.readStoredQueue().length, 0);
});

test("게임 종료 뒤 도착한 getInfo 응답과 GEP 이벤트는 새 런타임을 오염시키지 않는다", () => {
  let pending;
  const sandbox = createSandbox({ configure(s) {
    s.overwolf.games.events.getInfo = (callback) => { pending = callback; };
  } });
  sandbox.mockGep.fireGameInfoUpdated({ ...runningPubg, isRunning: false });
  pending({ success: true, res: { game_info: { phase: "landed" } } });
  sandbox.mockGep.fireEvent("kill", "");
  assert.equal(sandbox.bgmsController.getState().phase, "Idle");
  assert.equal(sandbox.bgmsController.getState().kills, 0);
});

test("이전 게임의 구독 응답은 현재 게임의 진행 중 구독을 해제하지 않는다", () => {
  const callbacks = [];
  const sandbox = createSandbox({ configure(s) {
    s.overwolf.games.events.setRequiredFeatures = (_features, callback) => callbacks.push(callback);
  } });
  sandbox.mockGep.fireGameInfoUpdated({ ...runningPubg, isRunning: false });
  sandbox.mockGep.fireGameInfoUpdated(runningPubg);
  callbacks[0]({ success: false });
  sandbox.bgmsController.ensureGepSubscription();
  assert.equal(callbacks.length, 2);
});

test("핫키 전역 바인딩과 해제 상태를 읽고 PUBG 설정을 우선한다", () => {
  const sandbox = createSandbox();
  sandbox.overwolf.settings.hotkeys.get = (callback) => callback({
    success: true,
    games: { "10906": [{ name: "toggle_overlay", binding: "Ctrl+B", IsUnassigned: true }] },
    globals: [{ name: "open_desktop", binding: "Alt+D" }, { name: "toggle_overlay", binding: "Alt+B" }]
  });
  sandbox.bgmsController.getAssignedHotkeys((assigned) => {
    assert.equal(assigned.toggle_overlay, "");
    assert.equal(assigned.open_desktop, "Alt+D");
  });
});

test("Overwolf 언어가 한국어여도 앱이 사용자 언어 선택을 자동으로 만들지 않는다", () => {
  let writes = 0;
  createSandbox({ configure(s) {
    s.bgmsI18n = { hasStoredLanguage: () => false, setLanguage: () => { writes++; } };
    s.overwolf.settings.language.get = (callback) => callback({ success: true, language: "ko" });
  } });
  assert.equal(writes, 0);
});
