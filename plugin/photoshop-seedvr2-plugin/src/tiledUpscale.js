(function () {
  function throwIfCancelled(token) {
    if (token && token.cancelled) {
      const error = new Error("Upscaling cancelled.");
      error.kind = "cancelled";
      throw error;
    }
  }

  async function run(options) {
    const { client, source, sourceFile, layout, logger, cancelToken } = options;
    const host = options.photoshop || globalThis.SeedVR2Photoshop;
    const mapper = options.mapper || globalThis.SeedVR2WorkflowMapper;
    const files = [];
    const outputs = [];
    let assembled = null;
    let lastProgress = 0;
    const report = (value, stage) => {
      lastProgress = Math.max(lastProgress, Math.min(100, value));
      options.onProgress && options.onProgress(lastProgress, stage);
    };
    try {
      throwIfCancelled(cancelToken);
      report(2, "Preparing parts...");
      const crops = await host.exportTilesFromSnapshot(sourceFile, source, layout, logger, cancelToken);
      files.push(...crops);
      if (crops.length !== layout.count) { throw new Error("Photoshop exported an unexpected number of parts."); }
      throwIfCancelled(cancelToken);
      const seed = mapper.normalizeSeed("random");
      logger && logger.info(`Tiled upscale: ${layout.columns}x${layout.rows}, ${layout.resolution}px per part, seed ${seed}, output ${layout.targetWidth}x${layout.targetHeight}.`);
      if (host.logSourceCheckpoint) { host.logSourceCheckpoint(source, logger, "after-parts-export"); }
      logger && logger.info(`Part input: ${layout.tileWidth}x${layout.tileHeight}px including overlap. Approximate upscaled part: ${Math.ceil(layout.tileWidth * layout.scale)}x${Math.ceil(layout.tileHeight * layout.scale)}px.`);
      for (let i = 0; i < crops.length; i += 1) {
        throwIfCancelled(cancelToken);
        const stage = `Part ${i + 1}/${layout.count}`;
        const start = 5 + 85 * i / layout.count;
        const range = 85 / layout.count;
        report(start, stage);
        const upload = await client.uploadImage(crops[i], `part-${i + 1}`);
        throwIfCancelled(cancelToken);
        const patched = await mapper.patchWorkflow({ imageName: upload.imageName, resolution: layout.resolution, seed });
        throwIfCancelled(cancelToken);
        const result = await client.runPrompt(patched.prompt, patched.outputNodeId, (progress) => {
          if (progress && progress.max > 0 && Number.isFinite(progress.value)) {
            report(start + range * 0.94 * Math.max(0, Math.min(1, progress.value / progress.max)), stage);
          }
        }, { cancelToken, onPromptQueued: options.onPromptQueued });
        options.onPromptQueued && options.onPromptQueued("");
        throwIfCancelled(cancelToken);
        const downloaded = await client.downloadImage(result.image);
        files.push(downloaded.file);
        if (downloaded.objectUrl) {
          URL.revokeObjectURL(downloaded.objectUrl);
        }
        outputs.push({ file: downloaded.file, tile: layout.tiles[i] });
        throwIfCancelled(cancelToken);
        report(start + range, stage);
      }
      report(90, "Stitching...");
      if (host.logSourceCheckpoint) { host.logSourceCheckpoint(source, logger, "before-stitching"); }
      assembled = await host.assembleTileResults(outputs, source, layout, logger, cancelToken,
        (fraction) => report(90 + 8 * fraction, "Stitching..."));
      throwIfCancelled(cancelToken);
      if (host.logSourceCheckpoint) { host.logSourceCheckpoint(source, logger, "after-stitching"); }
      report(98, "Applying...");
      return { file: assembled };
    } catch (error) {
      await host.deleteEntryQuietly(assembled);
      throw error;
    } finally {
      for (const file of files) {
        await host.deleteEntryQuietly(file);
      }
    }
  }

  globalThis.SeedVR2TiledUpscale = { run, throwIfCancelled };
})();
