(function () {
  "use strict";

  var STORAGE_KEY = "bgms_companion_language";
  var DEFAULT_LANGUAGE = "en";
  var dictionaries = {
    en: {
      desktopEyebrow: "BGMS Companion for PUBG",
      desktopTitle: "Live match context, clean post-match handoff.",
      desktopLede: "BGMS Companion shows a compact in-game status overlay and prepares a session summary for BGMS after the match ends.",
      desktopDragHint: "Drag to move window",
      closeDesktop: "Close",
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
      settingsTitle: "Overlay settings",
      overlayModeLabel: "Overlay mode",
      overlayModeMini: "Mini",
      overlayModeDebug: "Debug",
      opacityLabel: "Opacity",
      positionLabel: "Position",
      positionTopLeft: "Top left",
      positionTopCenter: "Top center",
      positionTopRight: "Top right",
      diagnosticsTitle: "Live diagnostics",
      gepStatusLabel: "GEP status",
      gameStatusLabel: "Game",
      lastEventLabel: "Last event",
      recentUpdatesLabel: "Recent updates",
      seenFeaturesLabel: "Seen features",
      supportedFeaturesLabel: "Supported features",
      missingUpdatesLabel: "Missing updates",
      requiredResultLabel: "Required result",
      serviceStatusLabel: "Event service status",
      gepVersionLabel: "GEP version",
      gepErrorLabel: "GEP error",
      ignoredUpdatesLabel: "Ignored updates",
      matchIdLabel: "Match ID",
      handoffLabel: "Session handoff",
      handoffDisabled: "Disabled until the BGMS endpoint is live",
      handoffReady: "Summary ready",
      handoffSent: "Summary sent",
      refreshDiagnostics: "Refresh diagnostics",
      statusGood: "Green (all events available)",
      statusPartial: "Yellow (some events unavailable)",
      statusDown: "Red (events unavailable)",
      statusUnsupported: "Unsupported",
      statusUnknown: "Unknown",
      knockedLabel: "KO",
      languageLabel: "Language",
      languageEnglish: "English",
      languageKorean: "Korean",
      overlayEyebrow: "BGMS Companion",
      waitingForPubg: "Waiting for PUBG",
      waitingForMatch: "Waiting for match",
      liveMatch: "Live match",
      matchEnded: "Match ended",
      idle: "Idle",
      sync: "Sync",
      pending: "Pending",
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
      desktopDragHint: "창 이동",
      closeDesktop: "닫기",
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
      settingsTitle: "오버레이 설정",
      overlayModeLabel: "오버레이 모드",
      overlayModeMini: "미니",
      overlayModeDebug: "디버그",
      opacityLabel: "투명도",
      positionLabel: "위치",
      positionTopLeft: "좌상단",
      positionTopCenter: "상단 중앙",
      positionTopRight: "우상단",
      diagnosticsTitle: "실시간 진단",
      gepStatusLabel: "GEP 상태",
      gameStatusLabel: "게임",
      lastEventLabel: "최근 이벤트",
      recentUpdatesLabel: "최근 기록",
      seenFeaturesLabel: "수신 기능",
      supportedFeaturesLabel: "지원 기능",
      missingUpdatesLabel: "미수신 업데이트",
      requiredResultLabel: "구독 결과",
      serviceStatusLabel: "이벤트 서비스 상태",
      gepVersionLabel: "GEP 버전",
      gepErrorLabel: "GEP 오류",
      ignoredUpdatesLabel: "무시된 업데이트",
      matchIdLabel: "매치 ID",
      handoffLabel: "세션 전달",
      handoffDisabled: "BGMS 엔드포인트 활성화 전까지 비활성",
      handoffReady: "요약 준비됨",
      handoffSent: "요약 전송됨",
      refreshDiagnostics: "진단 새로고침",
      statusGood: "정상 (모든 이벤트 사용 가능)",
      statusPartial: "주의 (일부 이벤트 사용 불가)",
      statusDown: "장애 (이벤트 사용 불가)",
      statusUnsupported: "미지원",
      statusUnknown: "확인 중",
      knockedLabel: "기절",
      languageLabel: "언어",
      languageEnglish: "영어",
      languageKorean: "한국어",
      overlayEyebrow: "BGMS Companion",
      waitingForPubg: "PUBG 대기 중",
      waitingForMatch: "매치 대기 중",
      liveMatch: "매치 진행 중",
      matchEnded: "매치 종료",
      idle: "대기",
      sync: "동기화",
      pending: "대기",
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

  // 사용자가 앱에서 언어를 직접 고른 적이 있는지 확인한다.
  // Overwolf 클라이언트 언어 자동 적용이 사용자 선택을 덮어쓰지 않게 하는 용도다.
  function hasStoredLanguage() {
    try {
      return Boolean(window.localStorage.getItem(STORAGE_KEY));
    } catch (_error) {
      return false;
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

  var SETTINGS_KEY = "bgms_companion_overlay_settings";
  var DEFAULT_SETTINGS = {
    mode: "mini",
    opacity: 1,
    position: "top-left"
  };

  function normalizeSettings(settings) {
    var nextSettings = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    var validModes = ["mini", "debug"];
    var validPositions = ["top-left", "top-center", "top-right"];
    var opacity = Number(nextSettings.opacity);

    if (validModes.indexOf(nextSettings.mode) === -1) {
      nextSettings.mode = DEFAULT_SETTINGS.mode;
    }

    if (validPositions.indexOf(nextSettings.position) === -1) {
      nextSettings.position = DEFAULT_SETTINGS.position;
    }

    nextSettings.opacity = Number.isFinite(opacity) ? Math.min(1, Math.max(0.35, opacity)) : DEFAULT_SETTINGS.opacity;

    return nextSettings;
  }

  function getOverlaySettings() {
    try {
      return normalizeSettings(JSON.parse(window.localStorage.getItem(SETTINGS_KEY)));
    } catch (_error) {
      return normalizeSettings();
    }
  }

  function setOverlaySettings(settings) {
    var nextSettings = normalizeSettings(settings);

    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    } catch (_error) {
      return nextSettings;
    }

    window.dispatchEvent(new CustomEvent("bgms:overlay-settings-change", {
      detail: nextSettings
    }));

    return nextSettings;
  }

  window.bgmsI18n = {
    getLanguage: getLanguage,
    hasStoredLanguage: hasStoredLanguage,
    setLanguage: setLanguage,
    translate: translate,
    applyTranslations: applyTranslations,
    getOverlaySettings: getOverlaySettings,
    setOverlaySettings: setOverlaySettings
  };
})();
