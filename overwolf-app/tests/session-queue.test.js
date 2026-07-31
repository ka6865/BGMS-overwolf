/*
 * 세션 요약 전송 큐 단위 테스트
 * 실행: node --test overwolf-app/tests/session-queue.test.js
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const sessionQueue = require("../session-queue.js");

function payload(sessionId) {
  return {
    session_id: sessionId,
    match_id: "match-" + sessionId,
    gep_summary: { kills: 1 }
  };
}

test("enqueue: 같은 session_id는 중복으로 쌓이지 않는다", () => {
  let queue = sessionQueue.enqueue([], payload("a"));
  queue = sessionQueue.enqueue(queue, payload("a"));
  queue = sessionQueue.enqueue(queue, payload("b"));

  assert.equal(queue.length, 2);
  assert.deepEqual(queue.map((entry) => entry.payload.session_id), ["a", "b"]);
});

test("enqueue: session_id가 없는 payload는 무시한다", () => {
  assert.deepEqual(sessionQueue.enqueue([], { match_id: "x" }), []);
  assert.deepEqual(sessionQueue.enqueue([], null), []);
});

test("normalizeQueue: 손상된 항목을 버리고 최대 길이를 유지한다", () => {
  const raw = [null, { payload: {} }, { payload: payload("ok") }, "text"];

  const queue = sessionQueue.normalizeQueue(raw);

  assert.equal(queue.length, 1);
  assert.equal(queue[0].payload.session_id, "ok");
  assert.equal(queue[0].attempts, 0);
});

test("pickDueEntry: 백오프 대기 중인 항목은 고르지 않는다", () => {
  const queue = [{
    payload: payload("a"),
    attempts: 1,
    queuedAt: new Date().toISOString(),
    nextAttemptAt: 10000,
    lastError: "http_500"
  }];

  assert.equal(sessionQueue.pickDueEntry(queue, 5000), null);
  assert.equal(sessionQueue.pickDueEntry(queue, 10000).payload.session_id, "a");
});

test("applyResult: 성공하면 큐에서 제거한다", () => {
  const queue = sessionQueue.enqueue([], payload("a"));
  const result = sessionQueue.applyResult(queue, "a", { ok: true, status: 200 });

  assert.equal(result.outcome, "sent");
  assert.equal(result.queue.length, 0);
});

test("applyResult: 4xx는 재시도하지 않고 제거한다", () => {
  [400, 422].forEach((status) => {
    const queue = sessionQueue.enqueue([], payload("a"));
    const result = sessionQueue.applyResult(queue, "a", { ok: false, status });

    assert.equal(result.outcome, "rejected");
    assert.equal(result.queue.length, 0);
  });
});

test("applyResult: 429와 5xx, 네트워크 오류는 백오프 후 재시도한다", () => {
  [429, 500, 0].forEach((status) => {
    const queue = sessionQueue.enqueue([], payload("a"));
    const result = sessionQueue.applyResult(queue, "a", { ok: false, status }, 1000);

    assert.equal(result.outcome, "retry");
    assert.equal(result.queue.length, 1);
    assert.equal(result.queue[0].attempts, 1);
    assert.equal(result.queue[0].nextAttemptAt, 1000 + sessionQueue.BACKOFF_MS[0]);
  });
});

test("applyResult: 최대 시도 횟수를 넘으면 항목을 버린다", () => {
  let queue = sessionQueue.enqueue([], payload("a"));
  let outcome = "";
  let iteration;

  for (iteration = 0; iteration < sessionQueue.MAX_ATTEMPTS; iteration += 1) {
    const applied = sessionQueue.applyResult(queue, "a", { ok: false, status: 500 }, 0);
    queue = applied.queue;
    outcome = applied.outcome;
  }

  assert.equal(outcome, "dropped");
  assert.equal(queue.length, 0);
});

test("describeQueue: 대기 건수와 마지막 오류를 요약한다", () => {
  assert.deepEqual(sessionQueue.describeQueue([]), {
    pending: 0,
    nextAttemptAt: null,
    lastError: ""
  });

  const queue = sessionQueue.applyResult(
    sessionQueue.enqueue([], payload("a")),
    "a",
    { ok: false, status: 503 },
    2000
  ).queue;

  const description = sessionQueue.describeQueue(queue);

  assert.equal(description.pending, 1);
  assert.equal(description.lastError, "http_503");
  assert.equal(description.nextAttemptAt, 2000 + sessionQueue.BACKOFF_MS[0]);
});
