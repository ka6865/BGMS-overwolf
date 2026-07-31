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

function createSandbox() {
  const storage = {};
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Promise,
    fetch: undefined,
    localStorage: {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
      },
      setItem: function (key, value) {
        storage[key] = String(value);
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

  loadScript(sandbox, "gep-state.js");
  loadScript(sandbox, "dev-harness/mock-overwolf.js");
  loadScript(sandbox, "background.js");

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

test("중복 matchEnd에도 요약 전송은 한 번만 준비된다", () => {
  const sandbox = createSandbox();

  sandbox.mockGep.fireEvent("matchStart", "");
  sandbox.mockGep.fireEvent("matchEnd", "");
  sandbox.mockGep.fireEvent("matchEnd", "");

  const state = sandbox.bgmsController.getState();

  assert.equal(state.matchEndCount, 2);
  // SESSION_ENDPOINT가 비어 있으므로 전송은 하지 않고 준비 상태만 해제된다.
  assert.equal(state.summaryReady, false);
  assert.equal(state.summarySent, false);
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
