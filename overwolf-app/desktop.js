(function () {
  "use strict";

  function queryLanguageButtons() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-language]"));
  }

  function syncLanguageButtons() {
    var language = window.bgmsI18n.getLanguage();

    queryLanguageButtons().forEach(function (button) {
      var isSelected = button.getAttribute("data-language") === language;

      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
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

  window.bgmsI18n.applyTranslations(document);
  bindLanguageButtons();
  syncLanguageButtons();

  window.addEventListener("bgms:language-change", function () {
    window.bgmsI18n.applyTranslations(document);
    syncLanguageButtons();
  });
})();
