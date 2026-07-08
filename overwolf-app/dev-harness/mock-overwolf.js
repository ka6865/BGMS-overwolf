(function () {
  "use strict";

  var infoListeners = [];
  var eventListeners = [];
  var hotkeyListeners = [];

  // 가짜 오버울프 API 정의
  window.overwolf = {
    windows: {
      getCurrentWindow: function (callback) {
        callback({ status: "success", window: { id: "mock-current-window" } });
      },
      obtainDeclaredWindow: function (name, callback) {
        callback({ status: "success", window: { id: name + "-id" } });
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
        if (callback) callback();
      },
      changePosition: function (id, x, y, callback) {
        if (callback) callback();
      },
      getMainWindow: function () {
        // background.js 가 실행 중인 mock.html 전역 컨텍스트를 반환
        return window;
      }
    },
    games: {
      getRunningGameInfo: function (callback) {
        callback({ id: 109061, isRunning: true });
      },
      onGameInfoUpdated: {
        addListener: function (listener) {
          // 게임 상태 변화 수신용
        }
      },
      events: {
        onInfoUpdates2: {
          addListener: function (listener) {
            infoListeners.push(listener);
          }
        },
        onNewEvents: {
          addListener: function (listener) {
            eventListeners.push(listener);
          }
        },
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
            info: {},
            res: {}
          });
        }
      }
    },
    settings: {
      hotkeys: {
        onPressed: {
          addListener: function (listener) {
            hotkeyListeners.push(listener);
          }
        }
      }
    }
  };

  // 하네스 통제용 가짜 GEP 이벤트 발송 헬퍼
  window.mockGep = {
    fireInfoUpdate: function (feature, category, key, value) {
      var event = {
        feature: feature,
        category: category,
        key: key,
        value: JSON.stringify(value)
      };
      infoListeners.forEach(function (listener) {
        try {
          listener(event);
        } catch (e) {
          console.error("InfoUpdate Listener Error: ", e);
        }
      });
    },
    fireBulkInfoUpdate: function (infoPayload) {
      var event = {
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
            data: JSON.stringify(data)
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
    triggerHotkey: function (name) {
      hotkeyListeners.forEach(function (listener) {
        try {
          listener({ name: name });
        } catch (e) {
          console.error("Hotkey Listener Error: ", e);
        }
      });
    }
  };
})();
