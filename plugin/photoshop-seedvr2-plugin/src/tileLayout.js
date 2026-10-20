(function () {
  const VALID_COUNTS = [2, 4, 6];
  const MAX_PNG_SIDE = 30000;

  function normalizeTileCount(value) {
    return VALID_COUNTS.includes(Number(value)) ? Number(value) : 4;
  }

  function positions(length, count, overlap) {
    const size = Math.ceil((length + (count - 1) * overlap) / count);
    const starts = Array.from({ length: count }, (_, i) => count === 1
      ? 0 : Math.round(i * (length - size) / (count - 1)));
    return { size, starts };
  }

  function computeLayout(options) {
    const width = Math.round(Number(options.width));
    const height = Math.round(Number(options.height));
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
      throw new Error("The source dimensions must be positive integer pixels.");
    }
    const count = normalizeTileCount(options.tileCount);
    const landscape = width >= height;
    const columns = count === 4 ? 2 : landscape ? (count === 2 ? 2 : 3) : (count === 2 ? 1 : 2);
    const rows = count / columns;
    if (width < columns || height < rows) {
      throw new Error("The selected area is too small for this number of parts.");
    }
    const overlap = Math.min(128, Math.floor(Math.min(width / columns, height / rows) / 4));
    const x = positions(width, columns, overlap);
    const y = positions(height, rows, overlap);
    const sizing = globalThis.SeedVR2ImageSizing.computeTargetResolution({
      width: x.size, height: y.size, mode: options.mode,
      factor: options.factor, shortestSide: options.shortestSide
    });
    const scale = sizing.resolution / Math.min(x.size, y.size);
    const targetWidth = globalThis.SeedVR2ImageSizing.roundEven(width * scale);
    const targetHeight = globalThis.SeedVR2ImageSizing.roundEven(height * scale);
    if (Math.max(width, height, targetWidth, targetHeight) > MAX_PNG_SIDE) {
      throw new Error("The calculated image exceeds Photoshop's 30000 px PNG limit. Reduce the target size.");
    }
    const projectX = (value) => Math.round(value * targetWidth / width);
    const projectY = (value) => Math.round(value * targetHeight / height);
    const tiles = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const left = x.starts[column];
        const top = y.starts[row];
        const right = left + x.size;
        const bottom = top + y.size;
        const target = { left: projectX(left), top: projectY(top), right: projectX(right), bottom: projectY(bottom) };
        tiles.push({
          index: tiles.length, row, column,
          bounds: { left, top, right, bottom }, target,
          feather: {
            left: column ? projectX(x.starts[column - 1] + x.size) - target.left : 0,
            right: column + 1 < columns ? target.right - projectX(x.starts[column + 1]) : 0,
            top: row ? projectY(y.starts[row - 1] + y.size) - target.top : 0,
            bottom: row + 1 < rows ? target.bottom - projectY(y.starts[row + 1]) : 0
          }
        });
      }
    }
    return {
      width, height, count, columns, rows, overlap, tileWidth: x.size, tileHeight: y.size,
      resolution: sizing.resolution, capped: sizing.capped, scale, targetWidth, targetHeight, tiles
    };
  }

  globalThis.SeedVR2TileLayout = { VALID_COUNTS, MAX_PNG_SIDE, normalizeTileCount, computeLayout };
})();
