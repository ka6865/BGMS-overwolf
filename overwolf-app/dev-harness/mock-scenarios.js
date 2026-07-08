(function () {
  "use strict";

  window.mockScenarios = {
    // 1. 매치 시작 및 인게임 정렬 시나리오 (Airfield 진입)
    startMatch: function () {
      console.log("Scenario: Start Match sequence initiated.");
      // 페이즈 대기실(starting)로 변경
      window.mockGep.fireInfoUpdate("phase", "game_info", "phase", "starting");

      // 매치 시작 신호
      setTimeout(function () {
        window.mockGep.fireEvent("matchStart", {});
        window.mockGep.fireInfoUpdate("match", "match_info", "match_id", "match-mock-12345");
        window.mockGep.fireInfoUpdate("match_info", "match_info", "pseudo_match_id", "pseudo-mock-54321");
        window.mockGep.fireInfoUpdate("match", "match_info", "mode", "squad-fpp");
      }, 500);

      // 로스터 대거 스폰 및 airfield 페이즈로 이동
      setTimeout(function () {
        window.mockGep.fireInfoUpdate("phase", "game_info", "phase", "airfield");
        
        var rosterInfo = {};
        for (var i = 0; i < 4; i++) {
          rosterInfo["roster_" + i] = JSON.stringify({
            player: "MockPlayer_" + i,
            kills: "0",
            out: false
          });
        }
        window.mockGep.fireBulkInfoUpdate({ match_info: rosterInfo });
      }, 1200);

      // 체력 상태 스폰
      setTimeout(function () {
        window.mockGep.fireInfoUpdate("me", "me", "health", { health: 100, ko_health: 100 });
        window.mockGep.fireInfoUpdate("me", "inventory", "weaponState", { name: "M416", equipped: true, count: 120 });
      }, 2000);
    },

    // 2. 체력 하락 시나리오
    updateHealth: function (percent) {
      console.log("Scenario: Adjusting health to " + percent + "%.");
      window.mockGep.fireInfoUpdate("me", "me", "health", { health: percent, ko_health: 100 });
    },

    // 3. 킬 이벤트 주입
    addKills: function () {
      console.log("Scenario: Triggering kill event.");
      window.mockGep.fireEvent("kill", {});
    },

    // 4. 매치 종료 중복 이벤트 주입
    matchEndDuplicate: function () {
      console.log("Scenario: Triggering duplicate matchEnd event.");
      window.mockGep.fireEvent("matchEnd", {});
      setTimeout(function () {
        window.mockGep.fireEvent("matchEnd", {});
      }, 300);
    },

    // 5. GEP 데이터 미수신 실패 시나리오 (Starting 상태에서 멈춤)
    simulateFailure: function () {
      console.log("Scenario: Simulating GEP connection but missing 'me' and 'roster' updates.");
      window.mockGep.fireInfoUpdate("phase", "game_info", "phase", "starting");
      
      setTimeout(function () {
        window.mockGep.fireEvent("matchStart", {});
        window.mockGep.fireInfoUpdate("match", "match_info", "match_id", "match-mock-fail-123");
        window.mockGep.fireInfoUpdate("match_info", "match_info", "pseudo_match_id", "pseudo-mock-fail-321");
      }, 500);
      // me와 roster 데이터는 의도적으로 전송하지 않아 UI에 '--' 상태가 유지됨
    }
  };
})();
