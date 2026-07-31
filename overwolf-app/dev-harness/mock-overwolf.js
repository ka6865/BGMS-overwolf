(function () {
  "use strict";

  var infoListeners = [];
  var eventListeners = [];
  var errorListeners = [];
  var hotkeyListeners = [];
  var gameInfoListeners = [];
  var windowSizeCalls = [];
  var windowPositionCalls = [];
  var openedUrls = [];

  // PUBG instance id. 공식 규칙상 manifest용 class id는 floor(109061 / 10) = 10906 이다.
  var PUBG_INSTANCE_ID = 109061;

  // 공식 game events status 응답 형태를 흉내낸 픽스처
  var serviceStatusFixture = {
    game_id: 10906,
    state: 1,
    features: [
      { name: "me", state: 1, keys: [{ name: "health", state: 1, category: "me" }] },
      { name: "roster", state: 1, keys: [{ name: "roster", state: 1, category: "match_info" }] }
    ]
  };

  function removeFrom(list, listener) {
    var index = list.indexOf(listener);

    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  function createListenerHub(list) {
    return {
      addListener: function (listener) {
        if (list.indexOf(listener) === -1) {
          list.push(listener);
        }
      },
      removeListener: function (listener) {
        removeFrom(list, listener);
      }
    };
  }

  // 가짜 오버울프 API 정의
  window.overwolf = {
    windows: {
      getCurrentWindow: function (callback) {
        callback({ status: "success", success: true, window: { id: "mock-current-window" } });
      },
      obtainDeclaredWindow: function (name, callback) {
        callback({ status: "success", success: true, window: { id: name + "-id" } });
      },
      getWindow: function (name, callback) {
        callback({ status: "success", success: true, window: { id: name + "-id" } });
      },
      restore: function (id, callback) {
        if (callback) callback();
      },
      bringToFront: function (id, callback) {
        if (callback) callback();
      },
      close: function (id, callback) {
        if (callback) callback();
      },
      changeSize: function (options, callback) {
        // 오버레이 창 높이 조절을 테스트에서 확인할 수 있게 호출 이력을 남긴다.
        windowSizeCalls.push({
          windowId: options && options.window_id,
          width: options && options.width,
          height: options && options.height
        });
        if (callback) callback();
      },
      changePosition: function (id, x, y, callback) {
        windowPositionCalls.push({ windowId: id, left: x, top: y });
        if (callback) callback();
      },
      dragMove: function (id, callback) {
        if (callback) callback();
      },
      getMainWindow: function () {
        // background.js 가 실행 중인 mock.html 전역 컨텍스트를 반환
        return window;
      }
    },
    extensions: {
      current: {
        getManifest: function (callback) {
          callback({ meta: { version: "0.5.0" } });
        }
      }
    },
    // 기본 브라우저로 URL 을 여는 대신 호출 이력만 남긴다.
    utils: {
      openUrlInDefaultBrowser: function (url) {
        openedUrls.push(String(url));
      }
    },
    games: {
      getRunningGameInfo: function (callback) {
        callback({ id: PUBG_INSTANCE_ID, classId: 10906, isRunning: true, logicalWidth: 1920 });
      },
      onGameInfoUpdated: createListenerHub(gameInfoListeners),
      events: {
        onInfoUpdates2: createListenerHub(infoListeners),
        onNewEvents: createListenerHub(eventListeners),
        onError: createListenerHub(errorListeners),
        setRequiredFeatures: function (features, callback) {
          callback({
            status: "success",
            success: true,
            supportedFeatures: features
          });
        },
        getInfo: function (callback) {
          callback({
            status: "success",
            success: true,
            res: {
              gep_internal: {
                version_info: JSON.stringify({ local_version: "157.0.1", public_version: "157.0.1", is_updated: true })
              }
            }
          });
        }
      }
    },
    settings: {
      hotkeys: {
        onPressed: createListenerHub(hotkeyListeners)
      },
      language: {
        get: function (callback) {
          callback({ success: true, language: "en" });
        }
      }
    }
  };

  // status 엔드포인트와 BGMS 세션 엔드포인트를 픽스처로 가로채고 나머지는 원래 fetch로 넘긴다.
  // 하네스에서 실제 운영 서버로 요청이 나가지 않게 하는 것이 목적이다.
  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  var sessionResponseStatus = 200;
  var sessionNetworkDown = false;
  var sessionRequests = [];

  window.fetch = function (url, options) {
    if (typeof url === "string" && url.indexOf("game-events-status.overwolf.com") !== -1) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () {
          return Promise.resolve(window.mockGep.serviceStatus);
        }
      });
    }

    if (typeof url === "string" && url.indexOf("/api/overwolf/session") !== -1) {
      if (sessionNetworkDown) {
        console.log("Harness: session handoff rejected (network down)");

        return Promise.reject(new Error("network down"));
      }

      sessionRequests.push(options && options.body ? String(options.body) : "");
      console.log("Harness: session handoff intercepted, responding " + String(sessionResponseStatus));

      return Promise.resolve({
        ok: sessionResponseStatus >= 200 && sessionResponseStatus < 300,
        status: sessionResponseStatus,
        json: function () {
          return Promise.resolve({ success: sessionResponseStatus === 200 });
        }
      });
    }

    if (originalFetch) {
      return originalFetch(url, options);
    }

    return Promise.reject(new Error("fetch unavailable in harness"));
  };

  // 하네스 통제용 가짜 GEP 이벤트 발송 헬퍼
  window.mockGep = {
    serviceStatus: serviceStatusFixture,
    // 공식 형태 1: {feature, category, key, value}
    fireInfoUpdate: function (feature, category, key, value) {
      var event = {
        feature: feature,
        category: category,
        key: key,
        value: typeof value === "string" ? value : JSON.stringify(value)
      };
      infoListeners.forEach(function (listener) {
        try {
          listener(event);
        } catch (e) {
          console.error("InfoUpdate Listener Error: ", e);
        }
      });
    },
    // 공식 형태 2: {feature, info: {category: {key: value}}}
    fireBulkInfoUpdate: function (infoPayload, feature) {
      var event = {
        feature: feature || "",
        info: infoPayload
      };
      infoListeners.forEach(function (listener) {
        try {
          listener(event);
        } catch (e) {
          console.error("BulkInfoUpdate Listener Error: ", e);
        }
      });
    },
    fireEvent: function (name, data) {
      var event = {
        events: [
          {
            name: name,
            data: typeof data === "string" ? data : JSON.stringify(data)
          }
        ]
      };
      eventListeners.forEach(function (listener) {
        try {
          listener(event);
        } catch (e) {
          console.error("NewEvents Listener Error: ", e);
        }
      });
    },
    fireError: function (reason) {
      errorListeners.forEach(function (listener) {
        try {
          listener({ reason: reason });
        } catch (e) {
          console.error("Error Listener Error: ", e);
        }
      });
    },
    fireGameInfoUpdated: function (gameInfo) {
      gameInfoListeners.forEach(function (listener) {
        try {
          listener({ gameInfo: gameInfo });
        } catch (e) {
          console.error("GameInfo Listener Error: ", e);
        }
      });
    },
    setServiceStatus: function (statusState, message) {
      window.mockGep.serviceStatus = {
        game_id: 10906,
        state: statusState,
        maintenance_msg: message || ""
      };
      window.mockGep.fireGameInfoUpdated({ id: PUBG_INSTANCE_ID, classId: 10906, isRunning: true, logicalWidth: 1920 });
    },
    triggerHotkey: function (name) {
      hotkeyListeners.forEach(function (listener) {
        try {
          listener({ name: name });
        } catch (e) {
          console.error("Hotkey Listener Error: ", e);
        }
      });
    },
    listenerCounts: function () {
      return {
        info: infoListeners.length,
        events: eventListeners.length,
        errors: errorListeners.length,
        gameInfo: gameInfoListeners.length
      };
    },
    setSessionResponseStatus: function (status) {
      sessionResponseStatus = Number(status) || 200;
    },
    setSessionNetworkDown: function (isDown) {
      sessionNetworkDown = Boolean(isDown);
    },
    sessionRequests: function () {
      return sessionRequests.slice();
    },
    // 오버레이 창 크기/위치 조절 이력. 경고 라인 표시 시 높이가 늘어나는지 확인한다.
    windowSizeCalls: function () {
      return windowSizeCalls.slice();
    },
    windowPositionCalls: function () {
      return windowPositionCalls.slice();
    },
    resetWindowCalls: function () {
      windowSizeCalls.length = 0;
      windowPositionCalls.length = 0;
    },
    // openUrlInDefaultBrowser 호출 이력. 웹 세션 기록 링크 검증에 사용한다.
    openedUrls: function () {
      return openedUrls.slice();
    }
  };
})();
