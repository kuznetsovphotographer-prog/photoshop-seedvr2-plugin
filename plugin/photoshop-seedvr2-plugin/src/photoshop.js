(function () {
  const photoshop = require("photoshop");
  const { app, action, constants, core } = photoshop;
  const { storage } = require("uxp");
  const fs = storage.localFileSystem;

  function toNumber(value) {
    if (typeof value === "number") {
      return value;
    }
    if (value && typeof value._value === "number") {
      return value._value;
    }
    if (value && typeof value.value === "number") {
      return value.value;
    }
    return Number(value);
  }

  function plainBounds(bounds) {
    if (!bounds) {
      return null;
    }
    if (Array.isArray(bounds)) {
      return {
        left: Math.round(toNumber(bounds[0])),
        top: Math.round(toNumber(bounds[1])),
        right: Math.round(toNumber(bounds[2])),
        bottom: Math.round(toNumber(bounds[3]))
      };
    }
    const left = Math.round(toNumber(bounds.left));
    const top = Math.round(toNumber(bounds.top));
    const right = bounds.right === undefined
      ? left + Math.round(toNumber(bounds.width))
      : Math.round(toNumber(bounds.right));
    const bottom = bounds.bottom === undefined
      ? top + Math.round(toNumber(bounds.height))
      : Math.round(toNumber(bounds.bottom));
    return { left, top, right, bottom };
  }

  function boundsSize(bounds) {
    return {
      width: Math.max(0, bounds.right - bounds.left),
      height: Math.max(0, bounds.bottom - bounds.top)
    };
  }

  function clampBounds(bounds, width, height) {
    return {
      left: Math.max(0, Math.min(width, bounds.left)),
      top: Math.max(0, Math.min(height, bounds.top)),
      right: Math.max(0, Math.min(width, bounds.right)),
      bottom: Math.max(0, Math.min(height, bounds.bottom))
    };
  }

  function logStage(logger, stage, detail) {
    if (logger) {
      logger.info(`stage: ${stage}${detail ? ` (${detail})` : ""}`);
    }
  }

  function getDocumentById(docId) {
    return Array.from(app.documents || []).find((doc) => doc.id === docId) || null;
  }

  function activeLayer(doc) {
    if (doc.activeLayers && doc.activeLayers.length) {
      return doc.activeLayers[0];
    }
    if (doc.layers && doc.layers.length) {
      return doc.layers[0];
    }
    return null;
  }

  async function getActiveDocument() {
    if (!app.documents || app.documents.length === 0 || !app.activeDocument) {
      throw new Error("No active Photoshop document.");
    }
    return app.activeDocument;
  }

  async function activateDocumentById(docId) {
    await action.batchPlay([
      {
        _obj: "select",
        _target: [{ _ref: "document", _id: docId }],
        _options: { dialogOptions: "dontDisplay" }
      }
    ], {});
  }

  async function closeWithoutSaving(doc) {
    if (!doc) {
      return;
    }
    if (typeof doc.closeWithoutSaving === "function") {
      await doc.closeWithoutSaving();
      return;
    }
    await doc.close(constants.SaveOptions.DONOTSAVECHANGES);
  }

  async function getSelectionBounds(doc) {
    try {
      return plainBounds(await Promise.resolve(doc.selection.bounds));
    } catch (error) {
      return null;
    }
  }

  async function inspectSource(logger) {
    logStage(logger, "inspect-source:start");
    const doc = await getActiveDocument();
    const width = Math.round(toNumber(doc.width));
    const height = Math.round(toNumber(doc.height));
    const rawSelection = await getSelectionBounds(doc);
    const selectionBounds = rawSelection ? clampBounds(rawSelection, width, height) : null;
    const selectionSize = selectionBounds ? boundsSize(selectionBounds) : null;
    const hasSelection = Boolean(selectionSize && selectionSize.width > 0 && selectionSize.height > 0);
    const bounds = hasSelection
      ? selectionBounds
      : { left: 0, top: 0, right: width, bottom: height };
    const size = boundsSize(bounds);
    const historyState = doc.activeHistoryState || null;

    if (size.width < 1 || size.height < 1) {
      throw new Error("The Photoshop source area is empty.");
    }

    const source = {
      mode: hasSelection ? "selection" : "document",
      docId: doc.id,
      docTitle: doc.title || doc.name || "Untitled",
      historyStateId: historyState ? historyState.id : null,
      documentWidth: width,
      documentHeight: height,
      bounds,
      width: size.width,
      height: size.height
    };
    logStage(logger, "inspect-source:done", `${source.mode} ${source.width}x${source.height}`);
    return source;
  }

  async function exportVisibleMergedPng(source, logger) {
    logStage(logger, "export-native:start");
    const tempFolder = await fs.getTemporaryFolder();
    const file = await tempFolder.createFile(`seedvr2-source-${Date.now()}.png`, { overwrite: true });

    await core.executeAsModal(async () => {
      const sourceDoc = getDocumentById(source.docId);
      if (!sourceDoc) {
        throw new Error("The original Photoshop document was closed before export.");
      }
      let tempDoc = null;
      try {
        tempDoc = await sourceDoc.duplicate(`SeedVR2 merged export ${Date.now()}`, true);
        logStage(logger, "export-native:duplicated");
        if (source.mode === "selection") {
          await tempDoc.crop(source.bounds);
          logStage(logger, "export-native:cropped", `${source.width}x${source.height}`);
        }
        await tempDoc.saveAs.png(file, {}, true);
        logStage(logger, "export-native:saved", file.name);
      } finally {
        if (tempDoc) {
          await closeWithoutSaving(tempDoc).catch((error) => {
            console.debug(`Could not close temporary SeedVR2 export: ${error.message || String(error)}`);
          });
        }
        if (getDocumentById(source.docId)) {
          await activateDocumentById(source.docId).catch((error) => {
            console.debug(`Could not reactivate SeedVR2 source document: ${error.message || String(error)}`);
          });
        }
      }
    }, { commandName: "Export SeedVR2 source" });

    logger && logger.info(`Exported merged Photoshop pixels: ${source.width} x ${source.height}px.`);
    return file;
  }

  function verifyDocumentUnchanged(snapshot) {
    const doc = getDocumentById(snapshot.docId);
    if (!doc) {
      throw new Error("The original Photoshop document was closed while SeedVR2 was working.");
    }
    const historyState = doc.activeHistoryState || null;
    const historyStateId = historyState ? historyState.id : null;
    const width = Math.round(toNumber(doc.width));
    const height = Math.round(toNumber(doc.height));
    if (
      historyStateId !== snapshot.historyStateId ||
      width !== snapshot.documentWidth ||
      height !== snapshot.documentHeight
    ) {
      throw new Error("The Photoshop document changed while SeedVR2 was working. Automatic replacement was cancelled.");
    }
    return doc;
  }

  async function deleteLayer(layer) {
    if (!layer) {
      return;
    }
    if (typeof layer.delete === "function") {
      await layer.delete();
      return;
    }
    await action.batchPlay([
      {
        _obj: "delete",
        _target: [{ _ref: "layer", _id: layer.id }],
        _options: { dialogOptions: "dontDisplay" }
      }
    ], {});
  }

  async function setRectangleSelection(bounds) {
    await action.batchPlay([
      {
        _obj: "set",
        _target: [
          {
            _ref: "channel",
            _property: "selection"
          }
        ],
        to: {
          _obj: "rectangle",
          top: { _unit: "pixelsUnit", _value: bounds.top },
          left: { _unit: "pixelsUnit", _value: bounds.left },
          bottom: { _unit: "pixelsUnit", _value: bounds.bottom },
          right: { _unit: "pixelsUnit", _value: bounds.right }
        },
        _options: { dialogOptions: "dontDisplay" }
      }
    ], {});
  }

  async function safeRenameLayer(layer, layerName, logger) {
    if (!layer) {
      return;
    }
    try {
      layer.name = layerName;
    } catch (error) {
      logger && logger.warn(`Could not rename placed layer: ${error.message || String(error)}`);
    }
  }

  async function placeEmbeddedFile(fileEntry) {
    const token = await fs.createSessionToken(fileEntry);
    await action.batchPlay([
      {
        _obj: "placeEvent",
        null: {
          _path: token,
          _kind: "local"
        },
        linked: false,
        freeTransformCenterState: {
          _enum: "quadCenterState",
          _value: "QCSAverage"
        },
        offset: {
          _obj: "offset",
          horizontal: { _unit: "pixelsUnit", _value: 0 },
          vertical: { _unit: "pixelsUnit", _value: 0 }
        },
        _isCommand: false,
        _options: { dialogOptions: "dontDisplay" }
      }
    ], { synchronousExecution: true });
  }

  async function transformActiveLayer(scaleXPercent, scaleYPercent, dx, dy) {
    await action.batchPlay([
      {
        _obj: "transform",
        _target: [
          {
            _ref: "layer",
            _enum: "ordinal",
            _value: "targetEnum"
          }
        ],
        freeTransformCenterState: {
          _enum: "quadCenterState",
          _value: "QCSAverage"
        },
        width: { _unit: "percentUnit", _value: scaleXPercent },
        height: { _unit: "percentUnit", _value: scaleYPercent },
        offset: {
          _obj: "offset",
          horizontal: { _unit: "pixelsUnit", _value: dx },
          vertical: { _unit: "pixelsUnit", _value: dy }
        },
        _options: { dialogOptions: "dontDisplay" }
      }
    ], { synchronousExecution: true });
  }

  function centerOf(bounds) {
    return {
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2
    };
  }

  async function fitLayerToBounds(layer, targetBounds, logger) {
    const startBounds = plainBounds(layer.boundsNoEffects || layer.bounds);
    const startSize = boundsSize(startBounds);
    const targetSize = boundsSize(targetBounds);
    if (startSize.width < 1 || startSize.height < 1) {
      throw new Error("Placed SeedVR2 layer has empty bounds.");
    }

    const startCenter = centerOf(startBounds);
    const targetCenter = centerOf(targetBounds);
    const scaleX = (targetSize.width / startSize.width) * 100;
    const scaleY = (targetSize.height / startSize.height) * 100;
    const dx = targetCenter.x - startCenter.x;
    const dy = targetCenter.y - startCenter.y;

    logger && logger.info(`Placed layer before fit: left ${startBounds.left}, top ${startBounds.top}, right ${startBounds.right}, bottom ${startBounds.bottom}.`);
    logger && logger.info(`Transforming SeedVR2 layer to ${targetSize.width} x ${targetSize.height}px at original selection.`);
    await transformActiveLayer(scaleX, scaleY, dx, dy);

    const finalBounds = plainBounds(layer.boundsNoEffects || layer.bounds);
    const finalDx = targetBounds.left - finalBounds.left;
    const finalDy = targetBounds.top - finalBounds.top;
    if (finalDx !== 0 || finalDy !== 0) {
      await layer.translate(finalDx, finalDy);
      logger && logger.info(`Final pixel alignment shift: ${finalDx}px, ${finalDy}px.`);
    }

    const alignedBounds = plainBounds(layer.boundsNoEffects || layer.bounds);
    logger && logger.info(`Placed layer bounds: left ${alignedBounds.left}, top ${alignedBounds.top}, right ${alignedBounds.right}, bottom ${alignedBounds.bottom}.`);
  }

  async function placeSelectionResultIntoSource(file, snapshot, logger) {
    if (!snapshot || snapshot.mode !== "selection") {
      throw new Error("SeedVR2 can place a result into the source document only when a selection was exported.");
    }
    verifyDocumentUnchanged(snapshot);
    logStage(logger, "apply-selection:start");

    return core.executeAsModal(async (executionContext) => {
      const sourceDoc = verifyDocumentUnchanged(snapshot);
      let suspension = null;
      try {
        await activateDocumentById(snapshot.docId);
        suspension = await executionContext.hostControl.suspendHistory({
          documentID: snapshot.docId,
          name: "SeedVR2 Selection Upscale"
        });

        await setRectangleSelection(snapshot.bounds);
        await placeEmbeddedFile(file);
        const placedDoc = await getActiveDocument();
        if (!placedDoc || placedDoc.id !== snapshot.docId) {
          throw new Error("Photoshop placed the SeedVR2 result into an unexpected document.");
        }

        const layer = activeLayer(placedDoc);
        if (!layer) {
          throw new Error("Photoshop did not create an active SeedVR2 result layer.");
        }

        await safeRenameLayer(layer, "SeedVR2 Upscale", logger);
        await fitLayerToBounds(layer, snapshot.bounds, logger);
        await setRectangleSelection(snapshot.bounds);
        await activateDocumentById(snapshot.docId);

        await executionContext.hostControl.resumeHistory(suspension, true);
        suspension = null;
        logStage(logger, "apply-selection:done", `${snapshot.width}x${snapshot.height}`);
        logger && logger.info("Placed the SeedVR2 result into the original selection as a new aligned layer.");
        return sourceDoc;
      } catch (error) {
        if (getDocumentById(snapshot.docId)) {
          await activateDocumentById(snapshot.docId).catch(() => null);
        }
        if (suspension) {
          await executionContext.hostControl.resumeHistory(suspension, false).catch(() => null);
        }
        throw error;
      }
    }, { commandName: "Place SeedVR2 selection result" });
  }

  async function replaceDocumentWithResult(file, snapshot, logger) {
    verifyDocumentUnchanged(snapshot);
    logStage(logger, "apply-document:start");

    return core.executeAsModal(async (executionContext) => {
      const sourceDoc = verifyDocumentUnchanged(snapshot);
      let resultDoc = null;
      let suspension = null;
      try {
        await activateDocumentById(snapshot.docId);
        suspension = await executionContext.hostControl.suspendHistory({
          documentID: snapshot.docId,
          name: "SeedVR2 Upscale"
        });

        resultDoc = await app.open(file);
        logStage(logger, "apply-document:result-opened");
        const width = Math.round(toNumber(resultDoc.width));
        const height = Math.round(toNumber(resultDoc.height));
        const resultLayer = activeLayer(resultDoc);
        if (!resultLayer || width < 1 || height < 1) {
          throw new Error("Photoshop could not read the downloaded SeedVR2 result.");
        }

        await activateDocumentById(snapshot.docId);
        await sourceDoc.flatten();
        await sourceDoc.resizeImage(width, height);
        const previousLayer = activeLayer(sourceDoc);

        await activateDocumentById(resultDoc.id);
        const duplicatedLayers = await resultDoc.duplicateLayers([resultLayer], sourceDoc);
        const replacementLayer = duplicatedLayers && duplicatedLayers[0];
        if (!replacementLayer) {
          throw new Error("Photoshop could not copy the SeedVR2 result into the original document.");
        }

        await activateDocumentById(snapshot.docId);
        await deleteLayer(previousLayer);
        try {
          replacementLayer.name = "SeedVR2 Upscale";
        } catch (error) {
          console.debug(`Could not rename SeedVR2 layer: ${error.message || String(error)}`);
        }
        await closeWithoutSaving(resultDoc);
        resultDoc = null;

        await executionContext.hostControl.resumeHistory(suspension, true);
        suspension = null;
        logStage(logger, "apply-document:done", `${width}x${height}`);
        logger && logger.info(`Replaced the original document with ${width} x ${height}px SeedVR2 pixels.`);
        return sourceDoc;
      } catch (error) {
        if (resultDoc) {
          await closeWithoutSaving(resultDoc).catch(() => null);
        }
        if (getDocumentById(snapshot.docId)) {
          await activateDocumentById(snapshot.docId).catch(() => null);
        }
        if (suspension) {
          await executionContext.hostControl.resumeHistory(suspension, false).catch(() => null);
        }
        throw error;
      }
    }, { commandName: "Apply SeedVR2 result" });
  }

  async function openResultDocument(file, logger) {
    logStage(logger, "open-result-document:start");
    return core.executeAsModal(async () => {
      const doc = await app.open(file);
      logger && logger.info("Opened the SeedVR2 result as a new Photoshop document.");
      return doc;
    }, { commandName: "Open SeedVR2 result" });
  }

  async function deleteEntryQuietly(entry) {
    if (!entry || typeof entry.delete !== "function") {
      return;
    }
    try {
      await entry.delete();
    } catch (error) {
      console.debug(`Could not delete temporary SeedVR2 file: ${error.message || String(error)}`);
    }
  }

  async function showAlert(message) {
    if (typeof app.showAlert === "function") {
      await app.showAlert(String(message));
      return;
    }
    alert(String(message));
  }

  globalThis.SeedVR2Photoshop = {
    deleteEntryQuietly,
    exportVisibleMergedPng,
    inspectSource,
    openResultDocument,
    placeSelectionResultIntoSource,
    replaceDocumentWithResult,
    showAlert,
    verifyDocumentUnchanged
  };
})();
