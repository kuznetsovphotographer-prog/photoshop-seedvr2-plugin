(function () {
  const $ = (id) => document.getElementById(id);
  const ACTION_METHOD_NAME = "seedVR2UpscaleActionHandler";
  let logger;
  let isWorking = false;
  let currentClient = null;
  let currentPromptId = "";
  let cancelToken = null;
  let activeMode = "scale";
  let selectedFactor = 2;
  let newWindow = false;
  let tiledEnabled = false;
  let tileCount = 4;
  let previewSource = null;
  let previewPending = false;
  let lastProgress = 0;
  let recoveryFile = null;

  function readShortestSideText() {
    return $("shortestSideInput").value;
  }

  function writeShortestSideText(value) {
    $("shortestSideInput").value = String(value);
  }

  function setShortestSideDisabled(disabled) {
    const input = $("shortestSideInput");
    input.disabled = Boolean(isWorking);
    input.tabIndex = isWorking ? -1 : 0;
  }

  function getShortestSideInput() {
    return globalThis.SeedVR2ImageSizing.normalizeShortestSide(readShortestSideText());
  }

  function getUiSettings() {
    return {
      comfyUrl: globalThis.SeedVR2Settings.DEFAULTS.comfyUrl,
      activeMode,
      factor: selectedFactor,
      shortestSide: getShortestSideInput(),
      newWindow,
      tiledEnabled,
      tileCount
    };
  }

  function saveSettings() {
    globalThis.SeedVR2Settings.saveSettings(getUiSettings());
  }

  function actionInfoFromSettings(settings) {
    const normalized = globalThis.SeedVR2Settings.normalizeSettings(settings);
    return {
      activeMode: normalized.activeMode,
      factor: normalized.factor,
      shortestSide: normalized.shortestSide,
      newWindow: normalized.newWindow,
      tiledEnabled: normalized.tiledEnabled,
      tileCount: normalized.tileCount,
      seed: "random"
    };
  }

  async function recordUpscaleAction(settings) {
    try {
      const photoshop = require("photoshop");
      if (!photoshop || !photoshop.action || typeof photoshop.action.recordAction !== "function") {
        logger && logger.warn("Photoshop Actions recording requires Photoshop 25.0 or newer.");
        return;
      }

      await photoshop.action.recordAction({
        name: "SeedVR2 Upscale",
        methodName: ACTION_METHOD_NAME
      }, actionInfoFromSettings(settings));
    } catch (error) {
      logger && logger.warn(`SeedVR2 action recording skipped: ${error.message || String(error)}`);
    }
  }

  function maybeSave(options) {
    if (!options || options.save !== false) {
      saveSettings();
    }
  }

  function refreshScaleButtons() {
    const scaleActive = activeMode === "scale";
    document.querySelectorAll(".scale-button[data-factor]").forEach((button) => {
      button.classList.toggle(
        "is-active",
        scaleActive && Number(button.dataset.factor) === selectedFactor
      );
    });
  }

  function setMode(mode, options) {
    activeMode = mode === "pixels" ? "pixels" : "scale";
    const scaleActive = activeMode === "scale";
    $("scaleModeToggle").setAttribute("aria-checked", scaleActive ? "true" : "false");
    $("pixelsModeToggle").setAttribute("aria-checked", scaleActive ? "false" : "true");
    $("scaleModeToggle").querySelector(".radio-dot").classList.toggle("is-active", scaleActive);
    $("pixelsModeToggle").querySelector(".radio-dot").classList.toggle("is-active", !scaleActive);
    $("scaleButtons").classList.toggle("is-disabled", !scaleActive);
    $("pixelsContainer").classList.toggle("is-disabled", scaleActive);
    setShortestSideDisabled(scaleActive || isWorking);
    refreshScaleButtons();
    renderTilePreview();
    maybeSave(options);
  }

  function setFactor(factor, options) {
    selectedFactor = globalThis.SeedVR2ImageSizing.normalizeFactor(factor);
    refreshScaleButtons();
    renderTilePreview();
    maybeSave(options);
  }

  function setNewWindow(enabled, options) {
    newWindow = globalThis.SeedVR2Settings.normalizeNewWindow(enabled);
    const toggle = $("newWindowToggle");
    const state = $("newWindowState");
    const label = newWindow ? "ON" : "OFF";
    toggle.classList.toggle("is-on", newWindow);
    toggle.setAttribute("aria-checked", newWindow ? "true" : "false");
    toggle.setAttribute("aria-label", `New Window ${label}`);
    state.textContent = label;
    maybeSave(options);
  }

  function tileOptions(source, settings) {
    return {
      width: source.width, height: source.height,
      mode: settings.activeMode, factor: settings.factor,
      shortestSide: settings.shortestSide, tileCount: settings.tileCount
    };
  }

  function renderTilePreview() {
    const preview = $("tilePreview");
    preview.classList.remove("is-error");
    if (!tiledEnabled) {
      preview.textContent = "Process and blend image parts";
      return;
    }
    if (!previewSource) {
      preview.textContent = "Open an image to calculate the output size";
      return;
    }
    try {
      const layout = globalThis.SeedVR2TileLayout.computeLayout(tileOptions(previewSource, getUiSettings()));
      preview.textContent = `${layout.count} parts | ${layout.targetWidth} x ${layout.targetHeight} px` +
        (layout.capped ? " | 2500 px limit per part" : "") +
        (previewSource.mode === "selection" ? " | selection" : "");
    } catch (error) {
      preview.textContent = error.message || String(error);
      preview.classList.add("is-error");
    }
  }

  async function refreshSourcePreview() {
    if (isWorking || previewPending) { return; }
    previewPending = true;
    try {
      previewSource = await globalThis.SeedVR2Photoshop.inspectSource();
    } catch (error) {
      previewSource = null;
    } finally {
      previewPending = false;
      if (!isWorking) { renderTilePreview(); }
    }
  }

  function setTiled(enabled, count, options) {
    tiledEnabled = enabled === true;
    tileCount = globalThis.SeedVR2TileLayout.normalizeTileCount(count);
    const toggle = $("tiledToggle");
    toggle.classList.toggle("is-on", tiledEnabled);
    toggle.setAttribute("aria-checked", String(tiledEnabled));
    toggle.setAttribute("aria-label", `Tiled Upscale ${tiledEnabled ? "On" : "Off"}`);
    $("tiledState").textContent = tiledEnabled ? "ON" : "OFF";
    $("tileButtons").classList.toggle("is-disabled", !tiledEnabled);
    document.querySelectorAll(".tile-button").forEach((button) => {
      const selected = tiledEnabled && Number(button.dataset.parts) === tileCount;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    renderTilePreview();
    maybeSave(options);
  }

  function setControlsBusy(busy) {
    $("scaleModeToggle").classList.toggle("is-disabled", busy);
    $("pixelsModeToggle").classList.toggle("is-disabled", busy);
    document.querySelectorAll(".scale-button").forEach((button) => {
      button.disabled = busy;
    });
    $("newWindowToggle").classList.toggle("is-disabled", busy);
    $("newWindowToggle").tabIndex = busy ? -1 : 0;
    $("newWindowToggle").setAttribute("aria-disabled", String(busy));
    $("tiledToggle").classList.toggle("is-disabled", busy);
    $("tiledToggle").tabIndex = busy ? -1 : 0;
    $("tiledToggle").setAttribute("aria-disabled", String(busy));
    setShortestSideDisabled(busy || activeMode !== "pixels");
    $("openLastResultBtn").disabled = busy;
  }

  function setProgress(value) {
    const loader = $("loaderProgress");
    if (!Number.isFinite(value)) {
      loader.style.width = "100%";
      loader.classList.add("is-active", "is-indeterminate");
      return;
    }
    const percent = Math.max(lastProgress, Math.min(100, Math.round(value)));
    lastProgress = percent;
    loader.classList.add("is-active");
    loader.classList.remove("is-indeterminate");
    loader.style.width = `${percent}%`;
  }

  function clearProgress() {
    const loader = $("loaderProgress");
    loader.classList.remove("is-active", "is-indeterminate");
    loader.style.width = "0";
  }

  function updateBusyLabel() {
    const label = $("upscaleLabel");
    if (!isWorking) {
      label.textContent = "Upscale";
      return;
    }
    label.textContent = cancelToken && cancelToken.cancelled
      ? "Stopping..."
      : $("upscaleBtn").matches(":hover") ? "Stop" : "Working...";
  }

  function setBusy(busy) {
    isWorking = busy;
    $("upscaleBtn").setAttribute("aria-busy", busy ? "true" : "false");
    $("upscaleBtn").parentElement.classList.toggle("is-busy", busy);
    $("upscaleBtn").parentElement.classList.remove("is-stopping");
    $("upscaleIcon").hidden = busy;
    $("busyIcon").hidden = !busy;
    setControlsBusy(busy);
    updateBusyLabel();
    if (busy) {
      lastProgress = 0;
      $("progressStatus").hidden = false;
      $("progressStatus").textContent = "Preparing...";
      setProgress(Number.NaN);
    } else {
      clearProgress();
      $("progressStatus").hidden = true;
      refreshSourcePreview();
    }
  }

  async function handleStop() {
    if (!isWorking || !cancelToken || cancelToken.cancelled) {
      return;
    }
    cancelToken.cancelled = true;
    $("upscaleBtn").parentElement.classList.add("is-stopping");
    updateBusyLabel();
    logger.warn("Stop requested. Interrupting ComfyUI generation.");
    const promptId = currentPromptId;
    const client = currentClient;
    try {
      if (client && promptId) {
        await client.deletePrompt(promptId);
      }
    } catch (error) {
      logger.warn(`Could not remove queued prompt: ${error.message || String(error)}`);
    }
    try {
      if (client && promptId) {
        await client.interrupt();
      }
    } catch (error) {
      logger.warn(`Could not interrupt ComfyUI: ${error.message || String(error)}`);
    }
  }

  function throwIfCancelled(token) {
    if (token && token.cancelled) {
      const error = new Error("Upscaling cancelled.");
      error.kind = "cancelled";
      throw error;
    }
  }

  async function runUpscale(options = {}) {
    if (isWorking) {
      if (options.allowStop) {
        await handleStop();
        return;
      }
      throw new Error("SeedVR2 Upscaler is already running.");
    }

    if (!logger) {
      logger = globalThis.SeedVR2Logger.createLogger();
    }

    const settings = globalThis.SeedVR2Settings.normalizeSettings(
      options.settings || getUiSettings()
    );
    if (!options.settings) {
      globalThis.SeedVR2Settings.saveSettings(settings);
    }

    const isActionPlayback = options.source === "action";
    const token = { cancelled: false };
    cancelToken = token;
    currentClient = null;
    currentPromptId = "";
    let exportedFile = null;
    let downloaded = null;
    let source = null;
    let openedResultDocument = false;
    let deliveryStarted = false;
    let retainedForRecovery = false;
    setBusy(true);

    try {
      source = await globalThis.SeedVR2Photoshop.inspectSource(logger);
      const layout = settings.tiledEnabled
        ? globalThis.SeedVR2TileLayout.computeLayout(tileOptions(source, settings)) : null;
      if (layout) { globalThis.SeedVR2Photoshop.assertTilingSupported(); }
      if (options.recordAction) {
        await recordUpscaleAction(settings);
      }

      const sizing = layout || globalThis.SeedVR2ImageSizing.computeTargetResolution({
        width: source.width, height: source.height, mode: settings.activeMode,
        factor: settings.factor, shortestSide: settings.shortestSide
      });
      logger.info(
        `Source mode: ${source.mode}. Target shortest side${layout ? " per part" : ""}: ${sizing.resolution}px` +
        `${sizing.capped ? " (capped at 2500px)." : "."}`
      );

      const client = new globalThis.SeedVR2ComfyClient.ComfyClient(settings.comfyUrl, logger);
      currentClient = client;
      const stats = await client.testConnection();
      throwIfCancelled(token);
      const version = stats && stats.system && stats.system.comfyui_version || "unknown";
      logger.info(`Connected to ComfyUI ${version}.`);

      exportedFile = await globalThis.SeedVR2Photoshop.exportVisibleMergedPng(source, logger);
      throwIfCancelled(token);
      if (layout) {
        downloaded = await globalThis.SeedVR2TiledUpscale.run({
          client, source, sourceFile: exportedFile, layout, logger, cancelToken: token,
          onPromptQueued(promptId) { currentPromptId = promptId; },
          onProgress(value, stage) {
            setProgress(value);
            $("progressStatus").textContent = stage;
          }
        });
      } else {
        logger.info("stage: upload:start");
        const upload = await client.uploadImage(exportedFile, source.mode);
        throwIfCancelled(token);
        logger.info(`Uploaded Photoshop pixels to ComfyUI input: ${upload.imageName}.`);

        const patched = await globalThis.SeedVR2WorkflowMapper.patchWorkflow({
          imageName: upload.imageName, resolution: sizing.resolution, seed: "random"
        });
        logger.info(`Queued SeedVR2 with seed ${patched.seed}.`);
        logger.info("stage: queue:start");
        const result = await client.runPrompt(patched.prompt, patched.outputNodeId, (progress) => {
          if (progress && progress.max) {
            setProgress(5 + (progress.value / progress.max) * 90);
          }
        }, {
          cancelToken: token,
          onPromptQueued(promptId) { currentPromptId = promptId; }
        });
        currentPromptId = "";
        throwIfCancelled(token);
        downloaded = await client.downloadImage(result.image);
        throwIfCancelled(token);
        logger.info("stage: download:done");
        logger.info(`Downloaded SeedVR2 result: ${downloaded.file.name}.`);
      }
      throwIfCancelled(token);
      $("progressStatus").textContent = "Applying...";
      setProgress(98);
      deliveryStarted = true;

      if (settings.newWindow) {
        logger.info("Output mode: new document.");
        await globalThis.SeedVR2Photoshop.openResultDocument(downloaded.file, logger, token);
        openedResultDocument = true;
      } else if (source.mode === "selection") {
        logger.info("Output mode: current document selection layer.");
        await globalThis.SeedVR2Photoshop.placeSelectionResultIntoSource(downloaded.file, source, logger, token);
      } else {
        logger.info("Output mode: current document.");
        await globalThis.SeedVR2Photoshop.replaceDocumentWithResult(downloaded.file, source, logger, token);
      }
      logger.info("SeedVR2 upscale completed.");
      setProgress(100);
    } catch (error) {
      if (error && error.kind === "cancelled") {
        logger.warn("SeedVR2 upscale stopped by user.");
        if (isActionPlayback) { throw error; }
      } else {
        logger.error(globalThis.SeedVR2Logger.formatError(error));
        let recoveryNote = "";
        if (deliveryStarted && downloaded && downloaded.file) {
          if (recoveryFile && recoveryFile !== downloaded.file) {
            await globalThis.SeedVR2Photoshop.deleteEntryQuietly(recoveryFile);
          }
          recoveryFile = downloaded.file;
          retainedForRecovery = true;
          $("openLastResultBtn").hidden = false;
          recoveryNote = "\n\nThe completed result was kept. Click Open Last Result to open it in a new document without generating again.";
          logger.warn(`Completed result retained for recovery: ${recoveryFile.nativePath || recoveryFile.name}.`);
        }
        if (isActionPlayback) {
          throw error;
        }
        await globalThis.SeedVR2Photoshop.showAlert((error.message || String(error)) + recoveryNote);
      }
    } finally {
      await globalThis.SeedVR2Photoshop.deleteEntryQuietly(exportedFile);
      if (!openedResultDocument && !retainedForRecovery) {
        await globalThis.SeedVR2Photoshop.deleteEntryQuietly(downloaded && downloaded.file);
      } else if (openedResultDocument && downloaded && downloaded.file) {
        logger.info(`Retained temporary result while the Photoshop document is open: ${downloaded.file.name}.`);
      }
      if (downloaded && downloaded.objectUrl) {
        URL.revokeObjectURL(downloaded.objectUrl);
      }
      currentClient = null;
      currentPromptId = "";
      cancelToken = null;
      setBusy(false);
    }
  }

  async function handleUpscale() {
    await runUpscale({ allowStop: true, recordAction: true });
  }

  async function openLastResult() {
    if (isWorking || !recoveryFile) { return; }
    const file = recoveryFile;
    const token = { cancelled: false };
    cancelToken = token;
    setBusy(true);
    $("progressStatus").textContent = "Opening completed result...";
    try {
      await globalThis.SeedVR2Photoshop.openResultDocument(file, logger, token);
      recoveryFile = null;
      $("openLastResultBtn").hidden = true;
      logger.info("Opened retained result without rerunning ComfyUI.");
    } catch (error) {
      if (error.kind !== "cancelled") {
        logger.error(globalThis.SeedVR2Logger.formatError(error));
        await globalThis.SeedVR2Photoshop.showAlert(error.message || String(error));
      }
    } finally {
      cancelToken = null;
      setBusy(false);
    }
  }

  function bindModeToggle(element, mode) {
    const choose = () => {
      if (!isWorking) {
        setMode(mode);
      }
    };
    element.addEventListener("click", choose);
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose();
      }
    });
  }

  function attachEvents() {
    bindModeToggle($("scaleModeToggle"), "scale");
    bindModeToggle($("pixelsModeToggle"), "pixels");
    document.querySelectorAll(".scale-button[data-factor]").forEach((button) => {
      button.addEventListener("click", () => {
        if (isWorking) {
          return;
        }
        setFactor(button.dataset.factor);
        setMode("scale");
      });
    });
    const sanitizeShortestSideInput = () => {
      const input = $("shortestSideInput");
      const digits = input.value.replace(/[^\d]/g, "").slice(0, 4);
      if (input.value !== digits) {
        input.value = digits;
      }
    };
    const normalizeShortestSideInput = () => {
      writeShortestSideText(getShortestSideInput());
      saveSettings();
      renderTilePreview();
    };
    $("shortestSideInput").addEventListener("focus", () => {
      if (isWorking) {
        return;
      }
      if (activeMode !== "pixels") {
        setMode("pixels");
      }
      const input = $("shortestSideInput");
      input.selectionStart = 0;
      input.selectionEnd = input.value.length;
    });
    $("shortestSideInput").addEventListener("blur", () => {
      normalizeShortestSideInput();
    });
    $("shortestSideInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        $("shortestSideInput").blur();
      } else if (event.key === "Escape") {
        event.preventDefault();
        writeShortestSideText(getShortestSideInput());
        $("shortestSideInput").blur();
      }
    });
    $("shortestSideInput").addEventListener("input", () => {
      sanitizeShortestSideInput();
      renderTilePreview();
    });
    $("shortestSideInput").addEventListener("change", normalizeShortestSideInput);
    $("newWindowToggle").addEventListener("click", () => {
      if (!isWorking) {
        setNewWindow(!newWindow);
      }
    });
    $("newWindowToggle").addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!isWorking) {
          setNewWindow(!newWindow);
        }
      }
    });
    $("upscaleBtn").addEventListener("click", handleUpscale);
    $("upscaleBtn").addEventListener("mouseenter", updateBusyLabel);
    $("upscaleBtn").addEventListener("mouseleave", updateBusyLabel);
    $("openLastResultBtn").addEventListener("click", openLastResult);
    document.querySelectorAll(".tile-button").forEach((button) => {
      button.addEventListener("click", () => {
        if (!isWorking) { setTiled(true, button.dataset.parts); }
      });
    });
    const toggleTiled = () => { if (!isWorking) { setTiled(!tiledEnabled, tileCount); } };
    $("tiledToggle").addEventListener("click", toggleTiled);
    $("tiledToggle").addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleTiled();
      }
    });
  }

  globalThis[ACTION_METHOD_NAME] = async function seedVR2RecordedUpscale(executionContext, info) {
    const settings = globalThis.SeedVR2Settings.normalizeSettings(info);
    await runUpscale({ source: "action", settings });
    return actionInfoFromSettings(settings);
  };

  document.addEventListener("DOMContentLoaded", () => {
    logger = globalThis.SeedVR2Logger.createLogger();
    const settings = globalThis.SeedVR2Settings.loadSettings();
    writeShortestSideText(
      globalThis.SeedVR2ImageSizing.normalizeShortestSide(settings.shortestSide)
    );
    setFactor(settings.factor, { save: false });
    setNewWindow(settings.newWindow, { save: false });
    setTiled(settings.tiledEnabled, settings.tileCount, { save: false });
    setMode(settings.activeMode, { save: false });
    attachEvents();
    refreshSourcePreview();
    setInterval(refreshSourcePreview, 1500);
    logger.info("SeedVR2 Upscaler 0.2.0 is ready.");
  });
})();
