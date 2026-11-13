(function () {
  "use strict";

  var STORAGE_KEY = "bgms_companion_language";
  var DEFAULT_LANGUAGE = "en";
  var dictionaries = {
    en: {
      desktopDragHint: "Drag to move window",
      closeDesktop: "Close",
      statusGameLabel: "PUBG",
      statusGameOff: "Not running",
      statusGameReady: "Ready",
      statusGameLive: "In match",
      statusGameLimited: "Events limited",
      statusOverlayLabel: "Overlay",
      statusOverlayShown: "Shown",
      statusOverlayHidden: "Hidden",
      statusOverlayHint: "Show or hide the in-game overlay",
      statusHandoffHint: "Open session handoff settings",
      statusNeedsNickname: "Needs nickname",
      statusHandoffPending: "Sending",
      matchCardReplay: "Replay this match",
      matchCardReplayDeath: "Replay your death",
      matchCardHintNickname: "Enter your PUBG nickname in Settings to open the map replay.",
      matchCardHintReplay: "Opens the BGMS map replay of this match in your browser.",
      matchCardHintLive: "The replay opens after the match ends.",
      momentStart: "Start",
      matchCardTitle: "Latest match",
      matchCardEmpty: "No match yet",
      matchCardLive: "In progress",
      matchCardEnded: "Finished",
      matchEndedShort: "Ended",
      matchCardMap: "Map",
      matchCardPlacement: "Placement",
      matchCardHeadshots: "Headshots",
      matchCardLongest: "Longest kill",
      matchCardNoMoments: "No knocks, deaths, or bookmarks recorded",
      momentDeath: "Died",
      momentKnocked: "Knocked",
      momentRevived: "Revived",
      momentBookmark: "Bookmark",
      matchCardReview: "Review this match on BGMS",
      matchCardHintHandoff: "Turn on session handoff to review matches on the BGMS map replay.",
      matchCardHintMatchId: "This match has no official match ID, so a replay link is not available.",
      matchCardHintReady: "Opens your BGMS session history, where each moment links to the map replay.",
      settingsDisclosureTitle: "Settings",
      settingsTitle: "Overlay settings",
      hotkeyLabel: "Hotkeys",
      hotkeyToggleOverlay: "Show or hide overlay",
      hotkeyOpenDesktop: "Open this window",
      hotkeyMarkMoment: "Bookmark this moment",
      hotkeyUnassigned: "Unassigned",
      editHotkeys: "Change in Overwolf settings",
      onboardingTitle: "Two steps to get started",
      onboardingStepConsent: "Turn on session handoff below and enter your PUBG nickname.",
      onboardingStepNickname: "Enter your PUBG nickname below so summaries can find you.",
      onboardingStepPlay: "Play a match. When it ends, the summary travels to BGMS on its own.",
      onboardingNote: "Nothing is sent until you turn it on. The overlay works either way, and you can open it in a match with the hotkey listed under overlay settings.",
      footerHelp: "Questions or feedback?",
      footerCommunity: "BGMS community",
      footerDiscord: "Discord",
      overlayModeLabel: "Overlay mode",
      overlayModeMini: "Mini",
      overlayModeDebug: "Debug",
      opacityLabel: "Opacity",
      positionLabel: "Position",
      positionTopLeft: "Top left",
      positionTopCenter: "Top center",
      positionTopRight: "Top right",
      diagnosticsTitle: "Live diagnostics",
      diagnosticsIdle: "No issues detected",
      diagnosticsAttention: "Attention needed",
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
      handoffTitle: "BGMS session handoff",
      handoffNote: "When enabled, BGMS Companion sends one compact match summary to your BGMS account after each match ends.",
      handoffToggleLabel: "Send session summary to BGMS",
      playerNameLabel: "BGMS nickname",
      platformLabel: "Platform",
      handoffRetry: "Retry pending handoff",
      openSessionHistory: "Open my session history",
      handoffOff: "Off",
      handoffNeedsNickname: "Enter your BGMS nickname to enable sending",
      handoffIdle: "Ready",
      handoffPending: "Pending summaries:",
      handoffSent: "Summary sent",
      handoffRejected: "Summary rejected by server",
      handoffFailed: "Summary failed after retries",
      refreshDiagnostics: "Refresh diagnostics",
      statusGood: "Green (all events available)",
      statusPartial: "Yellow (some events unavailable)",
      statusDown: "Red (events unavailable)",
      statusUnsupported: "Unsupported",
      statusUnknown: "Unknown",
      knockedLabel: "KO",
      languageLabel: "Language",
      languageEnglish: "English",
      languageKorean: "한국어",
      overlayEyebrow: "BGMS Companion",
      overlayBrandShort: "BGMS",
      waitingForPubg: "Waiting for PUBG",
      waitingForMatch: "Waiting for match",
      liveMatch: "Live match",
      matchEnded: "Match ended",
      idle: "Idle",
      sync: "Sync",
      phaseLobby: "Lobby",
      phaseLoadingScreen: "Loading",
      phaseAirfield: "Airfield",
      phaseAircraft: "Plane",
      phaseFreefly: "Freefly",
      phaseLanded: "Landed",
      phaseStarting: "Starting",
      pending: "Pending",
      kills: "Kills",
      alive: "Alive",
      health: "Health",
      headshots: "HS",
      longestKill: "Longest",
      placement: "Place",
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
      desktopDragHint: "창 이동",
      closeDesktop: "닫기",
      statusGameLabel: "PUBG",
      statusGameOff: "실행 안 됨",
      statusGameReady: "준비됨",
      statusGameLive: "매치 중",
      statusGameLimited: "이벤트 제한",
      statusOverlayLabel: "오버레이",
      statusOverlayShown: "표시 중",
      statusOverlayHidden: "숨김",
      statusOverlayHint: "인게임 오버레이 표시 또는 숨기기",
      statusHandoffHint: "세션 전송 설정 열기",
      statusNeedsNickname: "닉네임 필요",
      statusHandoffPending: "전송 중",
      matchCardReplay: "이 매치 리플레이",
      matchCardReplayDeath: "사망 장면 리플레이",
      matchCardHintNickname: "설정에서 PUBG 닉네임을 입력하면 맵 리플레이를 열 수 있습니다.",
      matchCardHintReplay: "브라우저에서 이 매치의 BGMS 맵 리플레이가 열립니다.",
      matchCardHintLive: "리플레이는 매치가 끝난 뒤 열 수 있습니다.",
      momentStart: "시작",
      matchCardTitle: "최근 매치",
      matchCardEmpty: "아직 매치 없음",
      matchCardLive: "진행 중",
      matchCardEnded: "종료",
      matchEndedShort: "종료",
      matchCardMap: "맵",
      matchCardPlacement: "순위",
      matchCardHeadshots: "헤드샷",
      matchCardLongest: "최장 킬",
      matchCardNoMoments: "기록된 기절, 사망, 북마크 없음",
      momentDeath: "사망",
      momentKnocked: "기절",
      momentRevived: "부활",
      momentBookmark: "북마크",
      matchCardReview: "BGMS에서 이 매치 복기하기",
      matchCardHintHandoff: "세션 전송을 켜면 BGMS 맵 리플레이로 매치를 복기할 수 있습니다.",
      matchCardHintMatchId: "공식 매치 ID가 없는 매치라 리플레이 링크를 만들 수 없습니다.",
      matchCardHintReady: "BGMS 세션 기록이 열리고, 각 순간에서 맵 리플레이로 이동할 수 있습니다.",
      settingsDisclosureTitle: "설정",
      settingsTitle: "오버레이 설정",
      hotkeyLabel: "단축키",
      hotkeyToggleOverlay: "오버레이 표시/숨기기",
      hotkeyOpenDesktop: "이 창 열기",
      hotkeyMarkMoment: "이 순간 북마크",
      hotkeyUnassigned: "할당 안 됨",
      editHotkeys: "Overwolf 설정에서 변경",
      onboardingTitle: "시작하려면 두 단계",
      onboardingStepConsent: "아래에서 세션 전송을 켜고 PUBG 닉네임을 입력하세요.",
      onboardingStepNickname: "아래에 PUBG 닉네임을 입력하면 요약을 찾을 수 있습니다.",
      onboardingStepPlay: "매치를 플레이하세요. 끝나면 요약이 자동으로 BGMS로 전달됩니다.",
      onboardingNote: "켜지 않으면 아무것도 전송되지 않습니다. 오버레이는 전송과 무관하게 동작하며, 오버레이 설정에 표시된 단축키로 게임 중에 열 수 있습니다.",
      footerHelp: "질문이나 의견이 있으신가요?",
      footerCommunity: "BGMS 커뮤니티",
      footerDiscord: "디스코드",
      overlayModeLabel: "오버레이 모드",
      overlayModeMini: "미니",
      overlayModeDebug: "디버그",
      opacityLabel: "투명도",
      positionLabel: "위치",
      positionTopLeft: "좌상단",
      positionTopCenter: "상단 중앙",
      positionTopRight: "우상단",
      diagnosticsTitle: "실시간 진단",
      diagnosticsIdle: "문제 없음",
      diagnosticsAttention: "확인 필요",
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
      handoffTitle: "BGMS 세션 전달",
      handoffNote: "켜면 매치가 끝날 때마다 압축된 세션 요약 1건을 BGMS 계정으로 전송합니다.",
      handoffToggleLabel: "BGMS로 세션 요약 전송",
      playerNameLabel: "BGMS 닉네임",
      platformLabel: "플랫폼",
      handoffRetry: "대기 중인 전달 재시도",
      openSessionHistory: "내 세션 기록 열기",
      handoffOff: "꺼짐",
      handoffNeedsNickname: "전송을 켜려면 BGMS 닉네임을 입력하세요",
      handoffIdle: "준비됨",
      handoffPending: "대기 중인 요약:",
      handoffSent: "요약 전송됨",
      handoffRejected: "서버가 요약을 거부함",
      handoffFailed: "재시도 후에도 전송 실패",
      refreshDiagnostics: "진단 새로고침",
      statusGood: "정상 (모든 이벤트 사용 가능)",
      statusPartial: "주의 (일부 이벤트 사용 불가)",
      statusDown: "장애 (이벤트 사용 불가)",
      statusUnsupported: "미지원",
      statusUnknown: "확인 중",
      knockedLabel: "기절",
      languageLabel: "언어",
      languageEnglish: "English",
      languageKorean: "한국어",
      overlayEyebrow: "BGMS Companion",
      overlayBrandShort: "BGMS",
      waitingForPubg: "PUBG 대기 중",
      waitingForMatch: "매치 대기 중",
      liveMatch: "매치 진행 중",
      matchEnded: "매치 종료",
      idle: "대기",
      sync: "동기화",
      phaseLobby: "로비",
      phaseLoadingScreen: "로딩",
      phaseAirfield: "대기섬",
      phaseAircraft: "비행기",
      phaseFreefly: "낙하",
      phaseLanded: "착지",
      phaseStarting: "시작",
      pending: "대기",
      kills: "킬",
      alive: "생존",
      health: "체력",
      headshots: "헤드샷",
      longestKill: "최장",
      placement: "순위",
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

    // 아이콘 버튼의 hover 툴팁도 언어에 맞춘다.
    Array.prototype.forEach.call(scope.querySelectorAll("[data-i18n-title]"), function (element) {
      element.setAttribute("title", translate(element.getAttribute("data-i18n-title"), language));
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
