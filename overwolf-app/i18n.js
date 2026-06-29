(function () {
  "use strict";

  var STORAGE_KEY = "bgms_companion_language";
  var DEFAULT_LANGUAGE = "en";
  var dictionaries = {
    en: {
      desktopEyebrow: "BGMS Companion for PUBG",
      desktopTitle: "Live match context, clean post-match handoff.",
      desktopLede: "BGMS Companion shows a compact in-game status overlay and prepares a session summary for BGMS after the match ends.",
      phaseScopeTitle: "Phase 1 scope",
      phaseScopeMatch: "Match start and match end state",
      phaseScopeState: "Phase, local health, weapon state",
      phaseScopeEvents: "Kills, deaths, revives, killer notice",
      phaseScopeRoster: "Roster-based alive player count",
      guardrailsTitle: "Policy guardrails",
      guardrailDamage: "No real-time damage meter",
      guardrailLocation: "No live location or minimap",
      guardrailPubgApi: "No PUBG API calls from live GEP triggers",
      guardrailSecrets: "No service role or Supabase secrets in the app",
      languageLabel: "Language",
      languageEnglish: "English",
      languageKorean: "Korean",
      overlayEyebrow: "BGMS Companion",
      waitingForPubg: "Waiting for PUBG",
      liveMatch: "Live match",
      matchEnded: "Match ended",
      idle: "Idle",
      kills: "Kills",
      alive: "Alive",
      health: "Health",
      weaponUnknown: "Weapon state unknown",
      noLiveEvents: "No live events yet",
      gep: "GEP",
      game: "Game",
      last: "Last",
      raw: "Raw",
      recent: "Recent",
      run: "run",
      off: "off",
      overlayAriaLabel: "BGMS Companion live overlay"
    },
    ko: {
      desktopEyebrow: "BGMS Companion for PUBG",
      desktopTitle: "실시간 매치 상태와 깔끔한 사후 분석 연결.",
      desktopLede: "BGMS Companion은 인게임 상태 오버레이를 표시하고 매치 종료 후 BGMS 세션 요약 연결을 준비합니다.",
      phaseScopeTitle: "Phase 1 범위",
      phaseScopeMatch: "매치 시작 및 종료 상태",
      phaseScopeState: "페이즈, 내 체력, 무기 상태",
      phaseScopeEvents: "킬, 데스, 부활, 킬러 알림",
      phaseScopeRoster: "로스터 기반 생존자 수",
      guardrailsTitle: "정책 가드레일",
      guardrailDamage: "실시간 데미지 미터 없음",
      guardrailLocation: "실시간 위치나 미니맵 없음",
      guardrailPubgApi: "GEP 실시간 트리거에서 PUBG API 직접 호출 없음",
      guardrailSecrets: "앱에 서비스 롤 또는 Supabase 비밀키 없음",
      languageLabel: "언어",
      languageEnglish: "영어",
      languageKorean: "한국어",
      overlayEyebrow: "BGMS Companion",
      waitingForPubg: "PUBG 대기 중",
      liveMatch: "매치 진행 중",
      matchEnded: "매치 종료",
      idle: "대기",
      kills: "킬",
      alive: "생존",
      health: "체력",
      weaponUnknown: "무기 상태 알 수 없음",
      noLiveEvents: "아직 실시간 이벤트 없음",
      gep: "GEP",
      game: "게임",
      last: "최근",
      raw: "원본",
      recent: "기록",
      run: "실행",
      off: "꺼짐",
      overlayAriaLabel: "BGMS Companion 실시간 오버레이"
    }
  };

  function normalizeLanguage(language) {
    return dictionaries[language] ? language : DEFAULT_LANGUAGE;
  }

  function getLanguage() {
    try {
      return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
    } catch (_error) {
      return DEFAULT_LANGUAGE;
    }
  }

  function setLanguage(language) {
    var nextLanguage = normalizeLanguage(language);

    try {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    } catch (_error) {
      return nextLanguage;
    }

    window.dispatchEvent(new CustomEvent("bgms:language-change", {
      detail: {
        language: nextLanguage
      }
    }));

    return nextLanguage;
  }

  function translate(key, language) {
    var normalizedLanguage = normalizeLanguage(language || getLanguage());
    var dictionary = dictionaries[normalizedLanguage];
    var fallback = dictionaries[DEFAULT_LANGUAGE];

    return dictionary[key] || fallback[key] || key;
  }

  function applyTranslations(root) {
    var language = getLanguage();
    var scope = root || document;

    document.documentElement.lang = language;

    Array.prototype.forEach.call(scope.querySelectorAll("[data-i18n]"), function (element) {
      element.textContent = translate(element.getAttribute("data-i18n"), language);
    });

    Array.prototype.forEach.call(scope.querySelectorAll("[data-i18n-aria-label]"), function (element) {
      element.setAttribute("aria-label", translate(element.getAttribute("data-i18n-aria-label"), language));
    });
  }

  window.bgmsI18n = {
    getLanguage: getLanguage,
    setLanguage: setLanguage,
    translate: translate,
    applyTranslations: applyTranslations
  };
})();
