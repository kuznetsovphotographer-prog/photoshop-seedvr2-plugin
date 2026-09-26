(function () {
  const STORAGE_KEY = "seedvr2UpscalerSettings.v2";

  const DEFAULTS = {
    comfyUrl: "http://127.0.0.1:8188",
    activeMode: "scale",
    factor: 2,
    shortestSide: 2000,
    newWindow: false
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function roundEven(value) {
    const rounded = Math.round(Number(value) || DEFAULTS.shortestSide);
    return rounded % 2 === 0 ? rounded : rounded + 1;
  }

  function normalizeFactor(value) {
    const factor = Number(value);
    return [2, 3, 4].includes(factor) ? factor : DEFAULTS.factor;
  }

  function normalizeShortestSide(value) {
    return clamp(roundEven(value), 500, 2500);
  }

  function normalizeNewWindow(value) {
    return value === true;
  }

  function normalizeSettings(settings) {
    return {
      comfyUrl: DEFAULTS.comfyUrl,
      activeMode: settings && settings.activeMode === "pixels" ? "pixels" : "scale",
      factor: normalizeFactor(settings && settings.factor),
      shortestSide: normalizeShortestSide(settings && settings.shortestSide),
      newWindow: normalizeNewWindow(settings && settings.newWindow)
    };
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULTS };
      }
      return normalizeSettings(JSON.parse(raw));
    } catch (error) {
      return { ...DEFAULTS };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
  }

  globalThis.SeedVR2Settings = {
    DEFAULTS,
    loadSettings,
    normalizeFactor,
    normalizeNewWindow,
    normalizeSettings,
    normalizeShortestSide,
    saveSettings
  };
})();
