(function () {
  "use strict";

  function queryLanguageButtons() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-language]"));
  }

  function querySettingButtons(setting) {
    return Array.prototype.slice.call(document.querySelectorAll("[data-setting='" + setting + "']"));
  }

  function queryServiceSettingButtons(setting) {
    return Array.prototype.slice.call(document.querySelectorAll("[data-service-setting='" + setting + "']"));
  }

  function getController() {
    if (typeof overwolf === "undefined" || !overwolf.windows || !overwolf.windows.getMainWindow) {
      return null;
    }

    var mainWindow = overwolf.windows.getMainWindow();
    return mainWindow && mainWindow.bgmsController ? mainWindow.bgmsController : null;
  }

  function syncLanguageButtons() {
    var language = window.bgmsI18n.getLanguage();

    queryLanguageButtons().forEach(function (button) {
      var isSelected = button.getAttribute("data-language") === language;

      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  }

  function syncSettingsControls() {
    var settings = window.bgmsI18n.getOverlaySettings();
    var opacityInput = document.getElementById("overlay-opacity");
    var opacityValue = document.getElementById("overlay-opacity-value");

    ["mode", "position"].forEach(function (setting) {
      querySettingButtons(setting).forEach(function (button) {
        var isSelected = button.getAttribute("data-value") === settings[setting];

        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      });
    });

    if (opacityInput) {
      opacityInput.value = String(settings.opacity);
    }

    // range 는 값 자체가 보이지 않으므로 퍼센트를 함께 노출하고 스크린리더에도 전달한다.
    if (opacityValue) {
      opacityValue.textContent = Math.round(settings.opacity * 100) + "%";
    }

    if (opacityInput) {
      opacityInput.setAttribute("aria-valuetext", Math.round(settings.opacity * 100) + "%");
    }
  }

  function saveSettings(partial) {
    var settings = window.bgmsI18n.setOverlaySettings(Object.assign(window.bgmsI18n.getOverlaySettings(), partial));
    var controller = getController();

    syncSettingsControls();

    if (controller && typeof controller.applyOverlaySettings === "function") {
      try {
        controller.applyOverlaySettings(settings);
      } catch (_error) {
        return;
      }
    }
  }

  function bindLanguageButtons() {
    queryLanguageButtons().forEach(function (button) {
      button.addEventListener("click", function () {
        window.bgmsI18n.setLanguage(button.getAttribute("data-language"));
        window.bgmsI18n.applyTranslations(document);
        syncLanguageButtons();
      });
    });
  }

  function bindSettingsControls() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-setting]"), function (button) {
      button.addEventListener("click", function () {
        var setting = button.getAttribute("data-setting");
        var value = button.getAttribute("data-value");
        var partial = {};

        partial[setting] = value;
        saveSettings(partial);
      });
    });

    var opacityInput = document.getElementById("overlay-opacity");

    if (opacityInput) {
      opacityInput.addEventListener("input", function () {
        saveSettings({
          opacity: Number(opacityInput.value)
        });
      });
    }
  }

  /*
   * 서버 연동 설정(핸드오프 동의, 닉네임, 플랫폼)을 관리한다.
   * 전송은 기본값 꺼짐이며 사용자가 여기서 명시적으로 켜야 한다.
   */
  function syncServiceSettingsControls() {
    var settings = window.bgmsSettings.read();
    var enabledInput = document.getElementById("handoff-enabled");
    var nameInput = document.getElementById("handoff-player-name");

    if (enabledInput) {
      enabledInput.checked = settings.handoffEnabled;
    }

    if (nameInput && nameInput.value !== settings.playerName) {
      nameInput.value = settings.playerName;
    }

    queryServiceSettingButtons("platform").forEach(function (button) {
      var isSelected = button.getAttribute("data-value") === settings.platform;

      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });

    // 설정이 갖춰지면 첫 실행 안내를 감춘다.
    syncOnboarding();
  }

  function saveServiceSettings(partial) {
    var settings = window.bgmsSettings.write(Object.assign(window.bgmsSettings.read(), partial));
    var controller = getController();

    syncServiceSettingsControls();

    if (controller && typeof controller.applyServiceSettings === "function") {
      try {
        controller.applyServiceSettings(settings);
      } catch (_error) {
        return;
      }
    }
  }

  function bindServiceSettingsControls() {
    var enabledInput = document.getElementById("handoff-enabled");
    var nameInput = document.getElementById("handoff-player-name");
    var retryButton = document.getElementById("handoff-retry");
    var historyButton = document.getElementById("open-session-history");

    if (enabledInput) {
      enabledInput.addEventListener("change", function () {
        saveServiceSettings({
          handoffEnabled: enabledInput.checked
        });
      });
    }

    if (nameInput) {
      nameInput.addEventListener("change", function () {
        saveServiceSettings({
          playerName: nameInput.value
        });
      });
    }

    queryServiceSettingButtons("platform").forEach(function (button) {
      button.addEventListener("click", function () {
        saveServiceSettings({
          platform: button.getAttribute("data-value")
        });
      });
    });

    if (retryButton) {
      retryButton.addEventListener("click", function () {
        var controller = getController();

        if (controller && typeof controller.retryHandoff === "function") {
          controller.retryHandoff();
        }
      });
    }

    // BGMS 웹 세션 기록을 기본 브라우저로 연다. 앱 안에서 웹을 렌더링하지 않는다.
    var replayButton = document.getElementById("match-card-review");

    if (replayButton) {
      replayButton.addEventListener("click", function () {
        var controller = getController();

        if (controller && typeof controller.openMatchReplay === "function") {
          controller.openMatchReplay();
        }
      });
    }

    [historyButton].forEach(function (button) {
      if (!button) {
        return;
      }

      button.addEventListener("click", function () {
        var controller = getController();

        if (controller && typeof controller.openSessionHistory === "function") {
          controller.openSessionHistory();
        }
      });
    });
  }

  function bindStatusStrip() {
    var overlayCell = document.getElementById("status-overlay-cell");
    var handoffCell = document.getElementById("status-handoff-cell");

    if (overlayCell) {
      overlayCell.addEventListener("click", function () {
        var controller = getController();

        if (!controller) {
          return;
        }

        if (lastDiagnosticsState && lastDiagnosticsState.overlayVisible) {
          controller.hideOverlay();
        } else {
          controller.showOverlay();
        }
      });
    }

    if (handoffCell) {
      handoffCell.addEventListener("click", function () {
        var disclosure = document.getElementById("settings-disclosure");
        var toggle = document.getElementById("handoff-enabled");

        if (disclosure) {
          disclosure.open = true;
        }

        if (toggle && typeof toggle.focus === "function") {
          toggle.focus();
        }
      });
    }
  }

  function bindDesktopDrag() {
    var dragHandle = document.getElementById("desktop-drag-handle");

    if (!dragHandle || typeof overwolf === "undefined" || !overwolf.windows || !overwolf.windows.dragMove) {
      return;
    }

    dragHandle.addEventListener("mousedown", function (event) {
      if (event.target && event.target.closest("button")) {
        return;
      }

      overwolf.windows.getCurrentWindow(function (result) {
        if (!result || !result.window) {
          return;
        }

        overwolf.windows.dragMove(result.window.id, function () {});
      });
    });
  }

  function bindDesktopClose() {
    var closeButton = document.getElementById("desktop-close");

    if (!closeButton || typeof overwolf === "undefined" || !overwolf.windows) {
      return;
    }

    closeButton.addEventListener("click", function () {
      var controller = getController();

      if (controller && typeof controller.closeDesktop === "function") {
        controller.closeDesktop();
        return;
      }

      overwolf.windows.getCurrentWindow(function (result) {
        if (!result || !result.window) {
          return;
        }

        overwolf.windows.close(result.window.id, function () {});
      });
    });
  }

  // 공식 status code: 0 unsupported, 1 green, 2 yellow, 3 red
  function translateServiceStatus(statusState, message) {
    var t = window.bgmsI18n.translate;
    var label;

    if (statusState === 0) {
      label = t("statusUnsupported");
    } else if (statusState === 1) {
      label = t("statusGood");
    } else if (statusState === 2) {
      label = t("statusPartial");
    } else if (statusState === 3) {
      label = t("statusDown");
    } else {
      label = t("statusUnknown");
    }

    return message ? label + " (" + message + ")" : label;
  }

  function describeHandoff(state) {
    var t = window.bgmsI18n.translate;
    var settings = window.bgmsSettings.read();

    if (!settings.handoffEnabled) {
      return t("handoffOff");
    }

    if (!settings.playerName) {
      return t("handoffNeedsNickname");
    }

    if (state.handoffPending > 0) {
      return t("handoffPending") + " " + String(state.handoffPending)
        + (state.handoffLastError ? " (" + state.handoffLastError + ")" : "");
    }

    if (state.handoffOutcome === "sent") {
      return t("handoffSent");
    }

    if (state.handoffOutcome === "rejected") {
      return t("handoffRejected");
    }

    if (state.handoffOutcome === "dropped") {
      return t("handoffFailed");
    }

    return t("handoffIdle");
  }

  function setText(id, text) {
    var element = document.getElementById(id);

    if (element && element.textContent !== text) {
      element.textContent = text;
    }
  }

  // GEP 맵 코드는 PUBG 공식 API 의 맵 코드와 같다. 모르는 코드는 _Main 만 떼고 보여준다.
  var MAP_NAMES = {
    Baltic_Main: "Erangel",
    Erangel_Main: "Erangel",
    Desert_Main: "Miramar",
    Savage_Main: "Sanhok",
    DihorOtok_Main: "Vikendi",
    Tiger_Main: "Taego",
    Kiki_Main: "Deston",
    Neon_Main: "Rondo",
    Summerland_Main: "Karakin",
    Chimera_Main: "Paramo",
    Heaven_Main: "Haven",
    Range_Main: "Camp Jackal"
  };
  var MOMENT_KINDS = { death: "momentDeath", knockedout: "momentKnocked", revived: "momentRevived", bookmark: "momentBookmark" };
  var MAX_CARD_MOMENTS = 6;

  function formatClock(seconds) {
    var whole = Math.max(0, Math.floor(seconds));
    var rest = whole % 60;

    return Math.floor(whole / 60) + ":" + (rest < 10 ? "0" : "") + rest;
  }

  // GEP mode 값(squad, squad-fpp 등)을 제목용으로 다듬는다.
  function formatMode(mode) {
    return String(mode || "").split("-").map(function (part) {
      return part === "fpp" || part === "tpp" ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1);
    }).join(" ");
  }

  function canReplay(state) {
    var gep = window.bgmsGepState;

    return Boolean(gep && typeof gep.buildReplayUrl === "function"
      && gep.buildReplayUrl("", state, window.bgmsSettings.read()));
  }

  /*
   * 최근 매치. 로컬 상태만으로 렌더하므로 전송 동의와 무관하게 보인다.
   * 리플레이 버튼은 끝난 매치에 공식 match_id 와 닉네임이 있을 때만 켠다.
   */
  function renderMatchCard(state) {
    var t = window.bgmsI18n.translate;
    var settings = window.bgmsSettings.read();
    var reviewButton = document.getElementById("match-card-review");
    var started = Boolean(state && (state.matchStartedAt || state.matchEnded));
    var hasDeath = false;
    var moments;
    var hint = "";

    if (!state || !started) {
      setText("match-card-map", t("matchCardTitle"));
      setText("match-card-mode", "");
      setText("match-card-status", t("matchCardEmpty"));
      ["match-card-placement", "match-card-headshots", "match-card-longest", "match-card-moments"].forEach(function (id) {
        setText(id, "--");
      });
    } else {
      setText("match-card-status", state.matchEnded ? t("matchCardEnded") : t("matchCardLive"));
      setText("match-card-map", state.mapName
        ? MAP_NAMES[state.mapName] || String(state.mapName).replace(/_Main$/, "")
        : t("matchCardTitle"));
      setText("match-card-mode", state.matchMode ? formatMode(state.matchMode) : "");
      setText("match-card-placement", state.rankPlace !== null && state.rankPlace !== undefined
        ? "#" + state.rankPlace + (state.rankTotal ? " / " + state.rankTotal : "")
        : "--");
      setText("match-card-headshots", String(state.headshots || 0));
      setText("match-card-longest", state.maxKillDistance !== null && state.maxKillDistance !== undefined
        ? Math.round(state.maxKillDistance) + "m"
        : "--");
      moments = (state.eventTimeline || []).filter(function (entry) {
        return MOMENT_KINDS[entry.kind] && typeof entry.t === "number";
      }).slice(-MAX_CARD_MOMENTS).map(function (entry) {
        hasDeath = hasDeath || entry.kind === "death";
        return t(MOMENT_KINDS[entry.kind]) + " " + formatClock(entry.t);
      });
      setText("match-card-moments", moments.length ? moments.join(" · ") : t("matchCardNoMoments"));
    }

    if (!settings.playerName) {
      hint = "matchCardHintNickname";
    } else if (started && !state.matchEnded) {
      hint = "matchCardHintLive";
    } else if (started && !state.matchId) {
      hint = "matchCardHintMatchId";
    } else if (started) {
      hint = "matchCardHintReplay";
    }

    setText("match-card-hint", hint ? t(hint) : "");
    setText("match-card-review", t(hasDeath ? "matchCardReplayDeath" : "matchCardReplay"));

    if (reviewButton) {
      reviewButton.disabled = !canReplay(state);
    }

    var retryButton = document.getElementById("handoff-retry");

    if (retryButton) {
      // 대기 중인 요약이 없으면 다시 보낼 것이 없다.
      retryButton.disabled = !(state && state.handoffPending > 0);
    }
  }

  // 상태 띠의 한 칸. tone 은 off(꺼짐) / on(정상) / live(진행 중) / warn(주의) 중 하나다.
  function setStatus(name, tone, text) {
    var cell = document.getElementById("status-" + name + "-cell");

    if (cell && cell.getAttribute("data-tone") !== tone) {
      cell.setAttribute("data-tone", tone);
    }

    setText("status-" + name, text);
  }

  function renderStatus(state) {
    var t = window.bgmsI18n.translate;
    var settings = window.bgmsSettings.read();
    var limited = Boolean(state && (state.gepStatus === "error"
      || (window.bgmsGepState && window.bgmsGepState.isServiceDegraded(state))));

    if (!state || !state.detectedGameRunning) {
      setStatus("game", "off", t("statusGameOff"));
    } else if (limited) {
      setStatus("game", "warn", t("statusGameLimited"));
    } else if (state.matchStartedAt && !state.matchEnded) {
      setStatus("game", "live", t("statusGameLive"));
    } else {
      setStatus("game", "on", t("statusGameReady"));
    }

    setStatus("overlay", state && state.overlayVisible ? "on" : "off",
      t(state && state.overlayVisible ? "statusOverlayShown" : "statusOverlayHidden"));

    if (!settings.handoffEnabled) {
      setStatus("handoff", "off", t("handoffOff"));
    } else if (!settings.playerName) {
      setStatus("handoff", "warn", t("statusNeedsNickname"));
    } else if (state && state.handoffPending > 0) {
      setStatus("handoff", "live", t("statusHandoffPending"));
    } else if (state && (state.handoffOutcome === "rejected" || state.handoffOutcome === "dropped")) {
      setStatus("handoff", "warn", describeHandoff(state));
    } else {
      setStatus("handoff", "on", state && state.handoffOutcome === "sent" ? t("handoffSent") : t("handoffIdle"));
    }
  }

  var lastTrackKey = "";

  /*
   * 매치 길이를 가로 레일로 두고 순간(기절·사망·부활·북마크)을 경과 시각 위치에 찍는다.
   * 길이는 종료 시각 또는 현재 시각 기준이며, 마지막 순간보다 짧으면 그 순간까지로 늘린다.
   */
  function renderTrack(state) {
    var track = document.getElementById("match-track");
    var moments;
    var duration;
    var key;

    if (!track || typeof document.createElement !== "function") {
      return;
    }

    moments = state && state.matchStartedAt ? (state.eventTimeline || []).filter(function (entry) {
      return MOMENT_KINDS[entry.kind] && typeof entry.t === "number";
    }) : [];
    duration = 0;

    if (state && state.matchStartedAt) {
      duration = ((state.matchEndedAt ? Date.parse(state.matchEndedAt) : Date.now()) - Date.parse(state.matchStartedAt)) / 1000;
    }

    duration = Math.max(duration || 0, moments.length ? moments[moments.length - 1].t : 0, 1);
    key = moments.map(function (entry) { return entry.kind + entry.t; }).join("|") + "@" + (state && state.matchEndedAt ? duration : "live");

    if (key === lastTrackKey) {
      return;
    }

    lastTrackKey = key;
    track.textContent = "";
    track.classList.toggle("is-empty", moments.length === 0);

    function addMark(className, leftPercent, label, title) {
      var mark = document.createElement("span");
      var text = document.createElement("span");

      mark.className = className;
      mark.style.left = leftPercent.toFixed(2) + "%";

      if (title) {
        mark.title = title;
      }

      text.className = "moment-label";
      text.textContent = label;
      mark.appendChild(text);
      track.appendChild(mark);

      return mark;
    }

    // 끝 눈금 라벨이 첫/마지막 순간 라벨과 부딪히면 눈금만 남긴다.
    var firstLeft = moments.length ? (moments[0].t / duration) * 100 : 100;
    var lastLeft = moments.length ? (moments[moments.length - 1].t / duration) * 100 : 0;

    if (state && state.matchStartedAt) {
      addMark("track-tick is-start", 0, firstLeft < 8 ? "" : "0:00");
    }

    if (state && state.matchEndedAt) {
      addMark("track-tick is-end", 100, lastLeft > 92 ? "" : formatClock(duration));
    }

    // 가까운 순간끼리 라벨이 겹치지 않게 바로 앞 라벨과 8% 안쪽이면 아래 줄로 내린다.
    var previousLeft = -100;
    var previousLow = false;

    moments.forEach(function (entry) {
      var left = Math.min(100, (entry.t / duration) * 100);
      var low = left - previousLeft < 8 && !previousLow;
      var mark = addMark("moment moment-" + entry.kind, left, formatClock(entry.t),
        window.bgmsI18n.translate(MOMENT_KINDS[entry.kind]) + " " + formatClock(entry.t));

      mark.classList.toggle("is-low", low);
      // 표식끼리 거의 같은 자리면 뒤의 표식을 레일 위로 올려 둘 다 보이게 한다.
      mark.classList.toggle("is-raised", left - previousLeft < 2.5);
      previousLeft = left;
      previousLow = low;
    });
  }

  function renderDiagnostics(state) {
    var seenFeatureKeys;
    var supportedFeatureList;

    function isFeatureSeen(feature) {
      if (seenFeatureKeys.indexOf(feature) !== -1) {
        return true;
      }

      if (feature === "phase") {
        return seenFeatureKeys.indexOf("game_info") !== -1;
      }

      if (feature === "roster") {
        return seenFeatureKeys.indexOf("match_info") !== -1;
      }

      return false;
    }

    // 접힌 진단은 업데이트를 저장만 하고, 사용자가 열 때 최신 상태로 한 번 렌더한다.
    setText("handoff-status", describeHandoff(state || {}));
    updateDiagnosticsDisclosure(state);

    if (!isDiagnosticsOpen()) {
      return;
    }

    if (!state) {
      // 컨트롤러가 아직 없어도(미리보기/기동 직전) 전송 설정 상태는 보여줄 수 있다.
      return;
    }

    seenFeatureKeys = Object.keys(state.seenInfoFeatures || {}).sort();
    supportedFeatureList = state.supportedFeatures || [];

    setText("desktop-gep-status", state.gepStatus || "--");
    setText("desktop-service-status", translateServiceStatus(state.serviceStatusState, state.serviceStatusMessage));
    setText("desktop-game-status", (state.detectedClassId || "--") + " (" + (state.detectedGameId || "--") + ") / " + (state.detectedGameRunning ? "run" : "off"));
    setText("desktop-match-id", state.effectiveMatchId || "--");
    setText("desktop-last-event", state.lastEvent || "--");
    setText("desktop-recent-updates", (state.recentUpdates || []).join(" | ") || "--");
    setText("desktop-seen-features", seenFeatureKeys.join(" | ") || "--");
    setText("desktop-supported-features", supportedFeatureList.join(" | ") || "--");
    setText("desktop-missing-updates", supportedFeatureList.filter(function (feature) {
      return ["match", "match_info", "phase", "roster", "me"].indexOf(feature) !== -1 && !isFeatureSeen(feature);
    }).join(" | ") || "--");
    setText("desktop-ignored-updates", (state.ignoredUpdates || []).join(" | ") || "--");
    setText("desktop-gep-version", state.gepLocalVersion
      ? state.gepLocalVersion + (state.gepPublicVersion && state.gepPublicVersion !== state.gepLocalVersion ? " / " + state.gepPublicVersion : "")
      : "--");
    setText("desktop-gep-error", state.gepErrorReason || "--");
    setText("desktop-handoff", describeHandoff(state));
    setText("desktop-required-result", state.lastRequiredFeaturesResult || "--");
  }

  /*
   * 진단 패널은 기본 접힘이다. 서비스 경고나 GEP 오류가 감지되면 한 번 펼치고,
   * 사용자가 직접 접은 뒤에는 다시 강제로 펼치지 않는다.
   */
  var diagnosticsAutoOpened = false;

  function isDiagnosticsOpen() {
    var disclosure = document.getElementById("diagnostics-disclosure");

    // 이전 마크업에는 disclosure가 없을 수 있으므로 그 경우에는 기존처럼 렌더한다.
    return !disclosure || disclosure.open;
  }

  function updateDiagnosticsDisclosure(state) {
    var disclosure = document.getElementById("diagnostics-disclosure");
    var hint = document.getElementById("diagnostics-hint");
    var t = window.bgmsI18n.translate;
    var degraded = Boolean(state) && Boolean(window.bgmsGepState)
      && window.bgmsGepState.isServiceDegraded(state);

    if (hint) {
      setText("diagnostics-hint", degraded
        ? (state.gepErrorReason || t("diagnosticsAttention"))
        : t("diagnosticsIdle"));
      hint.classList.toggle("is-warning", degraded);
    }

    if (!disclosure) {
      return;
    }

    if (degraded && !diagnosticsAutoOpened) {
      disclosure.open = true;
      diagnosticsAutoOpened = true;
      return;
    }

    if (!degraded) {
      diagnosticsAutoOpened = false;
    }
  }

  /*
   * 현재 할당된 핫키 조합을 표시한다.
   * manifest 의 default 를 그대로 쓰지 않는 이유는 사용자가 Overwolf 설정에서
   * 조합을 바꿀 수 있고, 그 경우 앱이 잘못된 안내를 하게 되기 때문이다.
   */
  function syncHotkeyDisplay() {
    var controller = getController();
    var fallback = { toggle_overlay: "Ctrl+Shift+B", open_desktop: "Ctrl+Shift+G", mark_moment: "Ctrl+Shift+M" };

    function render(assigned) {
      var t = window.bgmsI18n.translate;

      // API 실패 때만 manifest 기본값을 안내하고, 명시적 미할당은 그대로 표시한다.
      if (!assigned) {
        setText("hotkey-toggle-overlay", fallback.toggle_overlay);
        setText("hotkey-open-desktop", fallback.open_desktop);
        setText("hotkey-mark-moment", fallback.mark_moment);
        return;
      }

      setText("hotkey-toggle-overlay", assigned.toggle_overlay || t("hotkeyUnassigned"));
      setText("hotkey-open-desktop", assigned.open_desktop || t("hotkeyUnassigned"));
      setText("hotkey-mark-moment", assigned.mark_moment || t("hotkeyUnassigned"));
    }

    if (!controller || typeof controller.getAssignedHotkeys !== "function") {
      render(null);
      return;
    }

    controller.getAssignedHotkeys(render);
  }

  var hotkeyChangedListener = null;

  function bindHotkeyChanges() {
    var hotkeys = typeof overwolf !== "undefined" && overwolf.settings && overwolf.settings.hotkeys;

    if (!hotkeys || !hotkeys.onChanged || typeof hotkeys.onChanged.addListener !== "function") {
      return;
    }

    hotkeyChangedListener = function () {
      syncHotkeyDisplay();
    };
    hotkeys.onChanged.addListener(hotkeyChangedListener);
  }

  function cleanupHotkeyChanges() {
    var hotkeys = typeof overwolf !== "undefined" && overwolf.settings && overwolf.settings.hotkeys;

    if (hotkeyChangedListener && hotkeys && hotkeys.onChanged
      && typeof hotkeys.onChanged.removeListener === "function") {
      hotkeys.onChanged.removeListener(hotkeyChangedListener);
    }

    hotkeyChangedListener = null;
  }

  /*
   * 첫 실행 안내(FTUE)를 표시할지 결정한다.
   * 전송 동의와 닉네임이 모두 갖춰지면(=설정을 마쳤으면) 숨긴다.
   * 별도 "다시 보지 않기" 플래그를 두지 않는 이유는, 설정을 되돌린 사용자에게
   * 다시 안내가 필요하기 때문이다.
   */
  function syncOnboarding() {
    var section = document.getElementById("onboarding");
    var settings = window.bgmsSettings.read();
    var configured = window.bgmsSettings.canSendHandoff(settings);

    if (!section) {
      return;
    }

    section.classList.toggle("is-hidden", configured);

    // 첫 설정이 남았으면 접힌 설정 영역을 펼쳐 전송 토글이 바로 보이게 한다.
    if (!configured && document.getElementById("settings-disclosure")) {
      document.getElementById("settings-disclosure").open = true;
    }

    // 1단계 문구는 남은 작업에 따라 바꿔준다.
    setText("onboarding-step-1", settings.handoffEnabled
      ? window.bgmsI18n.translate("onboardingStepNickname")
      : window.bgmsI18n.translate("onboardingStepConsent"));
  }

  /* 지원/피드백 링크. 컨트롤러의 화이트리스트 키만 넘긴다. */
  function bindFooterLinks() {
    [["open-community", "community"], ["open-discord", "discord"]].forEach(function (pair) {
      var button = document.getElementById(pair[0]);

      if (!button) {
        return;
      }

      button.addEventListener("click", function () {
        var controller = getController();

        if (controller && typeof controller.openExternalLink === "function") {
          controller.openExternalLink(pair[1]);
        }
      });
    });
  }

  function bindHotkeyControls() {
    var editButton = document.getElementById("edit-hotkeys");

    if (!editButton) {
      return;
    }

    editButton.addEventListener("click", function () {
      var controller = getController();

      if (controller && typeof controller.openHotkeySettings === "function") {
        controller.openHotkeySettings();
      }
    });
  }

  function bindRefreshButton() {
    var refreshButton = document.getElementById("desktop-refresh");

    if (!refreshButton) {
      return;
    }

    refreshButton.addEventListener("click", function () {
      var controller = getController();

      if (controller && typeof controller.refreshDiagnostics === "function") {
        controller.refreshDiagnostics();
      }
    });
  }

  function bindDiagnosticsDisclosure() {
    var disclosure = document.getElementById("diagnostics-disclosure");

    if (!disclosure) {
      return;
    }

    disclosure.addEventListener("toggle", function () {
      if (disclosure.open) {
        renderStatus(lastDiagnosticsState);
    renderMatchCard(lastDiagnosticsState);
    renderDiagnostics(lastDiagnosticsState);
      }
    });
  }

  var lastDiagnosticsState = null;

  function handleDiagnosticsState(state) {
    lastDiagnosticsState = state;
    renderStatus(state);
    renderTrack(state);
    renderMatchCard(state);
    renderDiagnostics(state);
  }

  function subscribeDiagnostics() {
    var controller = getController();

    if (!controller || typeof controller.subscribe !== "function") {
      renderStatus(null);
      renderMatchCard(null);
      renderDiagnostics(null);
      return;
    }

    controller.subscribe(handleDiagnosticsState);
  }

  window.bgmsI18n.applyTranslations(document);
  bindLanguageButtons();
  bindSettingsControls();
  bindServiceSettingsControls();
  bindStatusStrip();
  bindDesktopDrag();
  bindDesktopClose();
  bindRefreshButton();
  bindHotkeyControls();
  bindHotkeyChanges();
  bindFooterLinks();
  syncLanguageButtons();
  syncSettingsControls();
  syncServiceSettingsControls();
  subscribeDiagnostics();
  syncHotkeyDisplay();
  bindDiagnosticsDisclosure();

  window.addEventListener("bgms:language-change", function () {
    window.bgmsI18n.applyTranslations(document);
    syncLanguageButtons();
    syncSettingsControls();
    syncServiceSettingsControls();
    renderStatus(lastDiagnosticsState);
    renderMatchCard(lastDiagnosticsState);
    renderDiagnostics(lastDiagnosticsState);
  });

  // 다른 창이나 시나리오 코드가 설정을 바꿀 때도 컨트롤 상태를 맞춘다.
  window.addEventListener("bgms:service-settings-change", function () {
    syncServiceSettingsControls();
    renderStatus(lastDiagnosticsState);
    renderMatchCard(lastDiagnosticsState);
    renderDiagnostics(lastDiagnosticsState);
  });

  window.addEventListener("storage", function (event) {
    if (event.key === window.bgmsSettings.STORAGE_KEY) {
      syncServiceSettingsControls();
      renderStatus(lastDiagnosticsState);
    renderMatchCard(lastDiagnosticsState);
    renderDiagnostics(lastDiagnosticsState);
    }
  });

  window.addEventListener("beforeunload", cleanupHotkeyChanges);
})();
