(function () {
  const PIXELS_MIN = 500;
  const PIXELS_MAX = 2500;
  const RESOLUTION_MIN = 16;
  const VALID_FACTORS = [2, 3, 4];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function roundEven(value) {
    const rounded = Math.round(Number(value) || 0);
    return rounded % 2 === 0 ? rounded : rounded + 1;
  }

  function normalizeFactor(value) {
    const factor = Number(value);
    return VALID_FACTORS.includes(factor) ? factor : 2;
  }

  function normalizeShortestSide(value) {
    return clamp(roundEven(value), PIXELS_MIN, PIXELS_MAX);
  }

  function computeTargetResolution(options) {
    const width = Math.max(1, Math.round(Number(options && options.width) || 1));
    const height = Math.max(1, Math.round(Number(options && options.height) || 1));
    const sourceShortestSide = Math.min(width, height);
    const mode = options && options.mode === "pixels" ? "pixels" : "scale";
    const factor = normalizeFactor(options && options.factor);

    const requestedResolution = mode === "pixels"
      ? normalizeShortestSide(options && options.shortestSide)
      : Math.max(RESOLUTION_MIN, roundEven(sourceShortestSide * factor));
    const resolution = Math.min(PIXELS_MAX, requestedResolution);
    const scale = resolution / sourceShortestSide;

    return {
      mode,
      factor,
      sourceWidth: width,
      sourceHeight: height,
      sourceShortestSide,
      requestedResolution,
      resolution,
      capped: requestedResolution > PIXELS_MAX,
      targetWidth: roundEven(width * scale),
      targetHeight: roundEven(height * scale)
    };
  }

  globalThis.SeedVR2ImageSizing = {
    PIXELS_MIN,
    PIXELS_MAX,
    VALID_FACTORS,
    computeTargetResolution,
    normalizeFactor,
    normalizeShortestSide,
    roundEven
  };
})();
