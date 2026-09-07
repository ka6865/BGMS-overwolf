/*
 * BGMS Companion - 세션 요약 전송 큐 (순수 모듈)
 *
 * 역할:
 *  - 매치 종료 요약을 로컬 큐에 넣고, 전송 성공/실패에 따라 상태를 계산한다.
 *  - 앱 종료나 네트워크 단절로 전송에 실패한 요약을 다음 실행에서 다시 시도한다.
 *
 * 이 파일은 Overwolf API와 fetch를 직접 호출하지 않는다. 저장소와 전송은
 * background.js가 주입한다. 덕분에 macOS/node에서 단위 테스트가 가능하다.
 *
 * 정책 기준:
 *  - 전송은 사용자가 명시적으로 동의(opt-in)했을 때만 수행한다.
 *  - session_id 기준 중복 항목은 큐에 한 번만 존재한다(서버도 idempotent).
 */
(function (root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.bgmsSessionQueue = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var MAX_QUEUE_LENGTH = 20;
  var MAX_ATTEMPTS = 5;
  // 지수 백오프. 인덱스는 시도 횟수(1-based)에서 1을 뺀 값이다.
  var BACKOFF_MS = [5000, 15000, 60000, 300000, 900000];

  function now() {
    return Date.now();
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    if (!entry.payload || typeof entry.payload !== "object") {
      return null;
    }

    if (!entry.payload.session_id) {
      return null;
    }

    return {
      payload: entry.payload,
      attempts: typeof entry.attempts === "number" && entry.attempts >= 0 ? entry.attempts : 0,
      queuedAt: entry.queuedAt || new Date().toISOString(),
      nextAttemptAt: typeof entry.nextAttemptAt === "number" ? entry.nextAttemptAt : 0,
      lastError: typeof entry.lastError === "string" ? entry.lastError : ""
    };
  }

  /* 저장된 큐를 복원한다. 손상된 항목은 조용히 버린다. */
  function normalizeQueue(rawQueue) {
    var list = Array.isArray(rawQueue) ? rawQueue : [];
    var seen = {};

    return list.map(normalizeEntry).filter(function (entry) {
      if (!entry) {
        return false;
      }

      if (seen[entry.payload.session_id]) {
        return false;
      }

      seen[entry.payload.session_id] = true;

      return true;
    }).slice(0, MAX_QUEUE_LENGTH);
  }

  /* 같은 session_id가 이미 있으면 추가하지 않는다. */
  function enqueue(queue, payload) {
    var normalized = normalizeQueue(queue);
    var exists = normalized.some(function (entry) {
      return entry.payload.session_id === (payload && payload.session_id);
    });

    if (!payload || !payload.session_id || exists) {
      return normalized;
    }

    return normalized.concat([{
      payload: payload,
      attempts: 0,
      queuedAt: new Date().toISOString(),
      nextAttemptAt: 0,
      lastError: ""
    }]).slice(-MAX_QUEUE_LENGTH);
  }

  /* 지금 전송해도 되는 첫 항목을 고른다. 백오프 대기 중이면 null. */
  function pickDueEntry(queue, currentTime) {
    var timestamp = typeof currentTime === "number" ? currentTime : now();
    var normalized = normalizeQueue(queue);
    var index;

    for (index = 0; index < normalized.length; index += 1) {
      if (normalized[index].nextAttemptAt <= timestamp) {
        return normalized[index];
      }
    }

    return null;
  }

  function removeEntry(queue, sessionId) {
    return normalizeQueue(queue).filter(function (entry) {
      return entry.payload.session_id !== sessionId;
    });
  }

  /*
   * 전송 결과를 큐에 반영한다.
   * result: {ok, status}
   *  - ok true         -> 제거
   *  - 0/429/5xx       -> 백오프 후 재시도, MAX_ATTEMPTS 도달 시 제거
   *  - 그 외           -> 재시도하지 않고 제거
   */
  function applyResult(queue, sessionId, result, currentTime) {
    var timestamp = typeof currentTime === "number" ? currentTime : now();
    var status = result && typeof result.status === "number" ? result.status : 0;
    var isRetryable = status === 0 || status === 429 || (status >= 500 && status < 600);

    if (result && result.ok) {
      return {
        queue: removeEntry(queue, sessionId),
        outcome: "sent"
      };
    }

    if (!isRetryable) {
      return {
        queue: removeEntry(queue, sessionId),
        outcome: "rejected"
      };
    }

    var dropped = false;
    var nextQueue = normalizeQueue(queue).map(function (entry) {
      var attempts;
      var delay;

      if (entry.payload.session_id !== sessionId) {
        return entry;
      }

      attempts = entry.attempts + 1;

      if (attempts >= MAX_ATTEMPTS) {
        dropped = true;
        return null;
      }

      delay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];

      return {
        payload: entry.payload,
        attempts: attempts,
        queuedAt: entry.queuedAt,
        nextAttemptAt: timestamp + delay,
        lastError: status ? "http_" + String(status) : "network_error"
      };
    }).filter(function (entry) {
      return entry !== null;
    });

    return {
      queue: nextQueue,
      outcome: dropped ? "dropped" : "retry"
    };
  }

  function describeQueue(queue) {
    var normalized = normalizeQueue(queue);

    if (normalized.length === 0) {
      return {
        pending: 0,
        nextAttemptAt: null,
        lastError: ""
      };
    }

    var earliest = normalized.reduce(function (selected, entry) {
      return entry.nextAttemptAt < selected.nextAttemptAt ? entry : selected;
    });
    return {
      pending: normalized.length,
      nextAttemptAt: earliest.nextAttemptAt || null,
      lastError: earliest.lastError
    };
  }

  return {
    MAX_QUEUE_LENGTH: MAX_QUEUE_LENGTH,
    MAX_ATTEMPTS: MAX_ATTEMPTS,
    BACKOFF_MS: BACKOFF_MS,
    normalizeQueue: normalizeQueue,
    enqueue: enqueue,
    pickDueEntry: pickDueEntry,
    removeEntry: removeEntry,
    applyResult: applyResult,
    describeQueue: describeQueue
  };
});
