/*
 * 사용자 설정 저장소 단위 테스트
 * 실행: node --test overwolf-app/tests/settings.test.js
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const settingsStore = require("../settings.js");

function createStorage(initial) {
  const data = Object.assign({}, initial);

  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: function (key, value) {
      data[key] = String(value);
    }
  };
}

test("기본값은 전송 꺼짐 + steam이다", () => {
  const settings = settingsStore.read(createStorage({}));

  assert.equal(settings.handoffEnabled, false);
  assert.equal(settings.playerName, "");
  assert.equal(settings.platform, "steam");
});

test("handoffEnabled는 명시적 true만 허용한다", () => {
  ["true", 1, "yes", null, undefined].forEach((value) => {
    assert.equal(settingsStore.normalize({ handoffEnabled: value }).handoffEnabled, false);
  });

  assert.equal(settingsStore.normalize({ handoffEnabled: true }).handoffEnabled, true);
});

test("닉네임은 허용 문자만 남기고 32자로 자른다", () => {
  assert.equal(settingsStore.sanitizePlayerName("  My_Nick.1-2 "), "My_Nick.1-2");
  assert.equal(settingsStore.sanitizePlayerName("한글닉<script>"), "script");
  assert.equal(settingsStore.sanitizePlayerName("a".repeat(50)).length, 32);
  assert.equal(settingsStore.sanitizePlayerName(null), "");
});

test("플랫폼은 허용 목록 밖이면 steam으로 되돌린다", () => {
  assert.equal(settingsStore.normalize({ platform: "KAKAO" }).platform, "kakao");
  assert.equal(settingsStore.normalize({ platform: "switch" }).platform, "steam");
});

test("손상된 저장값은 기본값으로 복구한다", () => {
  const storage = createStorage({ bgms_companion_service_settings: "{broken" });

  assert.deepEqual(settingsStore.read(storage), settingsStore.DEFAULT_SETTINGS);
});

test("canSendHandoff는 동의와 닉네임을 모두 요구한다", () => {
  assert.equal(settingsStore.canSendHandoff({ handoffEnabled: true, playerName: "nick" }), true);
  assert.equal(settingsStore.canSendHandoff({ handoffEnabled: true, playerName: "" }), false);
  assert.equal(settingsStore.canSendHandoff({ handoffEnabled: false, playerName: "nick" }), false);
});

test("write는 정규화된 값을 저장하고 다시 읽을 수 있다", () => {
  const storage = createStorage({});

  settingsStore.write({ handoffEnabled: true, playerName: " Nick! ", platform: "kakao" }, storage);

  assert.deepEqual(settingsStore.read(storage), {
    handoffEnabled: true,
    playerName: "Nick",
    platform: "kakao"
  });
});
