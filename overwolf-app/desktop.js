(function () {
  "use strict";

  function queryLanguageButtons() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-language]"));
  }

  function querySettingButtons(setting) {
    return Array.prototype.slice.call(document.querySelectorAll("[data-setting='" + setting + "']"));
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

    if (state.summarySent) {
      return t("handoffSent");
    }

    if (state.summaryReady) {
      return t("handoffReady");
    }

    return t("handoffDisabled");
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
  bindDesktopDrag();
  bindDesktopClose();
  bindRefreshButton();
  syncLanguageButtons();
  syncSettingsControls();
  subscribeDiagnostics();

  window.addEventListener("bgms:language-change", function () {
    window.bgmsI18n.applyTranslations(document);
    syncLanguageButtons();
    syncSettingsControls();
    renderDiagnostics(lastDiagnosticsState);
  });
})();
