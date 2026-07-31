(function () {
  "use strict";

  /*
   * 모든 payload는 PUBG 공식 GEP 문서의 예시 형태를 따른다.
   * GEP는 value를 문자열(JSON 문자열 포함)로 보내므로 여기서도 문자열로 넣는다.
   */
  window.mockScenarios = {
    // 1. 매치 시작 및 인게임 정렬 시나리오 (Airfield 진입)
    startMatch: function () {
      console.log("Scenario: Start Match sequence initiated.");
      // 공식 문서 목록에는 없지만 실게임에서 관측된 값
      window.mockGep.fireInfoUpdate("phase", "game_info", "phase", "starting");

      setTimeout(function () {
        window.mockGep.fireEvent("matchStart", "");
        window.mockGep.fireBulkInfoUpdate({ match_info: { match_id: "match.bro.official.pc-2018-03.steam.squad.as.2026.07.30.mock" } }, "match");
        window.mockGep.fireBulkInfoUpdate({ match_info: { pseudo_match_id: "0c0ea3df-97ea-4d3a-b1f6-f8e34042251f" } }, "match_info");
        window.mockGep.fireBulkInfoUpdate({ match_info: { mode: "squad" } }, "match");
      }, 500);

      setTimeout(function () {
        window.mockGep.fireInfoUpdate("phase", "game_info", "phase", "airfield");

        var rosterInfo = {};
        for (var i = 0; i < 4; i += 1) {
          rosterInfo["roster_" + i] = JSON.stringify({
            player: "MockPlayer_" + i,
            kills: "0",
            out: false
          });
        }
        window.mockGep.fireBulkInfoUpdate({ match_info: rosterInfo }, "roster");
      }, 1200);

      setTimeout(function () {
        // 공식 예시: {"health":"{\"health\":100,\"ko_health\":100}"}
        window.mockGep.fireBulkInfoUpdate({ me: { health: JSON.stringify({ health: 100, ko_health: 100 }) } }, "me");
        window.mockGep.fireBulkInfoUpdate({ inventory: { weaponState: JSON.stringify({ name: "M416", equipped: true, count: 120 }) } }, "me");
        window.mockGep.fireBulkInfoUpdate({ match_info: { kills: "0" } }, "kill");
      }, 2000);
    },

    // 2. 체력 하락 시나리오
    updateHealth: function (percent) {
      console.log("Scenario: Adjusting health to " + percent + "%.");
      window.mockGep.fireBulkInfoUpdate({ me: { health: JSON.stringify({ health: percent, ko_health: 100 }) } }, "me");
    },

    // 3. 킬 이벤트 주입
    addKills: function () {
      console.log("Scenario: Triggering kill event.");
      window.mockGep.fireEvent("kill", "");
    },

    // 4. 기절 -> 부활 흐름 (death feature의 knockedout 이벤트, 공식 status 목록 기준)
    knockAndRevive: function () {
      console.log("Scenario: knockedout then revived.");
      window.mockGep.fireBulkInfoUpdate({ me: { health: JSON.stringify({ health: 0, ko_health: 42 }) } }, "me");
      window.mockGep.fireEvent("knockedout", "");

      setTimeout(function () {
        window.mockGep.fireEvent("revived", "");
        window.mockGep.fireBulkInfoUpdate({ me: { health: JSON.stringify({ health: 30, ko_health: 100 }) } }, "me");
      }, 1500);
    },

    // 5. 로스터 탈락 (out: true) 반영
    eliminateRoster: function () {
      console.log("Scenario: roster_1 left the match.");
      window.mockGep.fireInfoUpdate("roster", "match_info", "roster_1", JSON.stringify({
        player: "MockPlayer_1",
        kills: "0",
        out: true
      }));
    },

    // 6. 사망 + killer 이벤트
    deathByKiller: function () {
      console.log("Scenario: death with killer name.");
      window.mockGep.fireEvent("death", "");
      window.mockGep.fireEvent("killer", JSON.stringify({ killer_name: "Ace_Tullis" }));
    },

    // 7. 매치 종료 중복 이벤트 주입 (사망 시 + 로비 복귀 시)
    matchEndDuplicate: function () {
      console.log("Scenario: Triggering duplicate matchEnd event.");
      window.mockGep.fireEvent("matchEnd", "");
      setTimeout(function () {
        window.mockGep.fireEvent("matchEnd", "");
      }, 300);
    },

    // 8. 정책 금지 payload 주입. 상태에 반영되지 않고 ignored 목록에만 남아야 한다.
    injectBlockedPayloads: function () {
      console.log("Scenario: blocked payloads must be ignored.");
      window.mockGep.fireBulkInfoUpdate({ match_info: { total_damage_dealt: "100" } }, "kill");
      window.mockGep.fireEvent("damage_dealt", "39.102");
      window.mockGep.fireBulkInfoUpdate({ game_info: { location: JSON.stringify({ x: 2300, y: 5740, z: 1520 }) } }, "location");
    },

    // 9. rank/map 같은 Phase 1 미사용 feature 주입. me/health를 오염시키지 않아야 한다.
    injectUnusedFeatures: function () {
      console.log("Scenario: rank.me must not overwrite me.health.");
      window.mockGep.fireBulkInfoUpdate({ match_info: { me: "38", total: "98" } }, "rank");
      window.mockGep.fireBulkInfoUpdate({ match_info: { map: "Erangel_Main" } }, "map");
    },

    // 10. GEP 오류 이벤트
    triggerGepError: function () {
      console.log("Scenario: GEP onError.");
      window.mockGep.fireError("game events provider disconnected");
    },

    // 11. GEP 서비스 부분 장애 상태
    degradeServiceStatus: function () {
      console.log("Scenario: service status yellow.");
      window.mockGep.setServiceStatus(2, "Some events are disabled");
    },

    // 12. GEP 데이터 미수신 실패 시나리오 (Starting 상태에서 멈춤)
    simulateFailure: function () {
      console.log("Scenario: Simulating GEP connection but missing 'me' and 'roster' updates.");
      window.mockGep.fireInfoUpdate("phase", "game_info", "phase", "starting");

      setTimeout(function () {
        window.mockGep.fireEvent("matchStart", "");
        window.mockGep.fireBulkInfoUpdate({ match_info: { match_id: "match-mock-fail-123" } }, "match");
      }, 500);
      // me와 roster 데이터는 의도적으로 전송하지 않아 UI에 '--' 상태가 유지됨
    }
  };
})();
