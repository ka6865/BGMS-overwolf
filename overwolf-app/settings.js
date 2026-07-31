/*
 * BGMS Companion - 사용자 설정 저장소
 *
 * 오버레이 표시 설정과 별도로, 서버 연동 관련 사용자 동의와 계정 정보를 관리한다.
 *
 * 정책 기준:
 *  - 세션 요약 전송은 기본값 꺼짐이며 사용자가 명시적으로 켜야 한다.
 *  - 여기에는 Supabase 키나 서버 비밀값을 저장하지 않는다. 닉네임과 플랫폼만 다룬다.
 *  - GEP 닉네임은 신뢰 가능한 identity가 아니므로 사용자가 직접 입력한 값을 사용한다.
 */
(function (root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.bgmsSettings = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var STORAGE_KEY = "bgms_companion_service_settings";
  var VALID_PLATFORMS = ["steam", "kakao", "xbox", "psn", "stadia"];

  var DEFAULT_SETTINGS = {
    handoffEnabled: false,
    playerName: "",
    platform: "steam"
  };

  function sanitizePlayerName(value) {
    var text = typeof value === "string" ? value.trim() : "";

    // PUBG 닉네임 허용 문자만 남긴다. 길이는 공식 최대치를 여유 있게 잡는다.
    return text.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 32);
  }

  function normalize(settings) {
    var source = settings && typeof settings === "object" ? settings : {};
    var platform = typeof source.platform === "string" ? source.platform.toLowerCase() : "";

    return {
      handoffEnabled: source.handoffEnabled === true,
      playerName: sanitizePlayerName(source.playerName),
      platform: VALID_PLATFORMS.indexOf(platform) === -1 ? DEFAULT_SETTINGS.platform : platform
    };
  }

  function read(storage) {
    var store = storage || (typeof window !== "undefined" ? window.localStorage : null);

    if (!store) {
      return normalize(null);
    }

    try {
      return normalize(JSON.parse(store.getItem(STORAGE_KEY)));
    } catch (_error) {
      return normalize(null);
    }
  }

  function write(settings, storage) {
    var store = storage || (typeof window !== "undefined" ? window.localStorage : null);
    var nextSettings = normalize(settings);

    if (!store) {
      return nextSettings;
    }

    try {
      store.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
    } catch (_error) {
      return nextSettings;
    }

    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("bgms:service-settings-change", {
        detail: nextSettings
      }));
    }

    return nextSettings;
  }

  /* 전송에 필요한 최소 조건을 만족하는지 확인한다. */
  function canSendHandoff(settings) {
    var normalized = normalize(settings);

    return normalized.handoffEnabled && normalized.playerName.length > 0;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    VALID_PLATFORMS: VALID_PLATFORMS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    normalize: normalize,
    sanitizePlayerName: sanitizePlayerName,
    read: read,
    write: write,
    canSendHandoff: canSendHandoff
  };
});
