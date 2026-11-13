/*
 * BGMS Companion - 데스크탑 창 광고 (Overwolf Ads SDK)
 *
 * 2026-11-01부터 Overwolf 는 Overwolf 수익화가 있는 앱만 승인한다.
 * 광고는 데스크탑 창 한 곳(400x300)에만 두고, 인게임 HUD 에는 두지 않는다.
 * 모든 기능은 광고와 무관하게 동작한다. SDK 로드에 실패해도 빈 칸만 남는다.
 *
 * 공식 기준: https://dev.overwolf.com/ow-native/reference/ads/owad
 */
(function () {
  "use strict";

  var AD_SDK_URL = "https://content.overwolf.com/libs/ads/latest/owads.min.js";
  var AD_CONTAINER_ID = "bgms-ad-desktop";
  var AD_SETTINGS = { size: { width: 400, height: 300 }, containerId: "bgms_400x300_dt" };
  var DESKTOP_WINDOW = "desktop";

  var ad = null;
  var sdkReady = false;

  function startAd() {
    var container = document.getElementById(AD_CONTAINER_ID);

    if (ad || !sdkReady || !container || typeof window.OwAd !== "function") {
      return;
    }

    ad = new window.OwAd(container, AD_SETTINGS);
  }

  function stopAd() {
    if (!ad) {
      return;
    }

    ad.shutdown();
    ad = null;
  }

  // 창이 최소화된 동안에는 보이지 않는 광고를 돌리지 않는다.
  function bindWindowState() {
    if (typeof overwolf === "undefined" || !overwolf.windows || !overwolf.windows.onStateChanged) {
      return;
    }

    overwolf.windows.onStateChanged.addListener(function (event) {
      if (!event || event.window_name !== DESKTOP_WINDOW) {
        return;
      }

      if (event.window_state === "minimized" || event.window_state === "closed") {
        stopAd();
      } else {
        startAd();
      }
    });
  }

  function loadSdk() {
    var script = document.createElement("script");

    script.src = AD_SDK_URL;
    script.async = true;
    script.onload = function () {
      sdkReady = true;
      startAd();
    };
    // 로드 실패는 앱 기능에 영향이 없으므로 콘솔에만 남긴다.
    script.onerror = function () {
      console.warn("BGMS: Overwolf Ads SDK failed to load");
    };
    document.head.appendChild(script);
  }

  bindWindowState();
  loadSdk();
})();
