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
    if (historyButton) {
      historyButton.addEventListener("click", function () {
        var controller = getController();

        if (controller && typeof controller.openSessionHistory === "function") {
          controller.openSessionHistory();
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

    if (element) {
      element.textContent = text;
    }
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

    if (!state) {
      // 컨트롤러가 아직 없어도(미리보기/기동 직전) 전송 설정 상태는 보여줄 수 있다.
      setText("handoff-status", describeHandoff({}));
      updateDiagnosticsDisclosure(null);
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
    setText("handoff-status", describeHandoff(state));
    updateDiagnosticsDisclosure(state);
  }

  /*
   * 진단 패널은 기본 접힘이다. 서비스 경고나 GEP 오류가 감지되면 한 번 펼치고,
   * 사용자가 직접 접은 뒤에는 다시 강제로 펼치지 않는다.
   */
  var diagnosticsAutoOpened = false;

  function updateDiagnosticsDisclosure(state) {
    var disclosure = document.getElementById("diagnostics-disclosure");
    var hint = document.getElementById("diagnostics-hint");
    var t = window.bgmsI18n.translate;
    var degraded = Boolean(state) && Boolean(window.bgmsGepState)
      && window.bgmsGepState.isServiceDegraded(state);

    if (hint) {
      hint.textContent = degraded
        ? (state.gepErrorReason || t("diagnosticsAttention"))
        : t("diagnosticsIdle");
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
    var fallback = { toggle_overlay: "Ctrl+Shift+B", open_desktop: "Ctrl+Shift+G" };

    function render(assigned) {
      var values = assigned || fallback;

      setText("hotkey-toggle-overlay", values.toggle_overlay || fallback.toggle_overlay);
      setText("hotkey-open-desktop", values.open_desktop || fallback.open_desktop);
    }

    if (!controller || typeof controller.getAssignedHotkeys !== "function") {
      render(null);
      return;
    }

    controller.getAssignedHotkeys(render);
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

  var lastDiagnosticsState = null;

  function handleDiagnosticsState(state) {
    lastDiagnosticsState = state;
    renderDiagnostics(state);
  }

  function subscribeDiagnostics() {
    var controller = getController();

    if (!controller || typeof controller.subscribe !== "function") {
      renderDiagnostics(null);
      return;
    }

    controller.subscribe(handleDiagnosticsState);
  }

  window.bgmsI18n.applyTranslations(document);
  bindLanguageButtons();
  bindSettingsControls();
  bindServiceSettingsControls();
  bindDesktopDrag();
  bindDesktopClose();
  bindRefreshButton();
  bindHotkeyControls();
  bindFooterLinks();
  syncLanguageButtons();
  syncSettingsControls();
  syncServiceSettingsControls();
  subscribeDiagnostics();
  syncHotkeyDisplay();

  window.addEventListener("bgms:language-change", function () {
    window.bgmsI18n.applyTranslations(document);
    syncLanguageButtons();
    syncSettingsControls();
    syncServiceSettingsControls();
    renderDiagnostics(lastDiagnosticsState);
  });

  // 다른 창이나 시나리오 코드가 설정을 바꿀 때도 컨트롤 상태를 맞춘다.
  window.addEventListener("bgms:service-settings-change", function () {
    syncServiceSettingsControls();
    renderDiagnostics(lastDiagnosticsState);
  });

  window.addEventListener("storage", function (event) {
    if (event.key === window.bgmsSettings.STORAGE_KEY) {
      syncServiceSettingsControls();
      renderDiagnostics(lastDiagnosticsState);
    }
  });
})();
