(function () {
  function intersection(a, b) {
    const bounds = {
      left: Math.max(a.left, b.left), top: Math.max(a.top, b.top),
      right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom)
    };
    return bounds.right > bounds.left && bounds.bottom > bounds.top ? bounds : null;
  }

  function smooth(value) {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  }

  function weightAt(tile, x, y) {
    const b = tile.target;
    if (x < b.left || x >= b.right || y < b.top || y >= b.bottom) {
      return 0;
    }
    const f = tile.feather;
    return (f.left ? smooth((x + 0.5 - b.left) / f.left) : 1) *
      (f.right ? smooth((b.right - x - 0.5) / f.right) : 1) *
      (f.top ? smooth((y + 0.5 - b.top) / f.top) : 1) *
      (f.bottom ? smooth((b.bottom - y - 0.5) / f.bottom) : 1);
  }

  function createAccumulator(bounds) {
    const length = (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
    return { bounds, sums: new Float32Array(length * 4), weights: new Float32Array(length) };
  }

  // Include geometric weight for transparent/trimmed pixels as well, so alpha is not inflated.
  function addTile(accumulator, tile, pixels) {
    const region = intersection(accumulator.bounds, tile.target);
    if (!region) {
      return;
    }
    const dst = accumulator.bounds;
    const width = dst.right - dst.left;
    for (let y = region.top; y < region.bottom; y += 1) {
      for (let x = region.left; x < region.right; x += 1) {
        const index = (y - dst.top) * width + x - dst.left;
        const weight = weightAt(tile, x, y);
        accumulator.weights[index] += weight;
        if (!pixels || x < pixels.bounds.left || x >= pixels.bounds.right ||
            y < pixels.bounds.top || y >= pixels.bounds.bottom) {
          continue;
        }
        const p = ((y - pixels.bounds.top) * pixels.width + x - pixels.bounds.left) * pixels.components;
        const alpha = pixels.components === 4 ? pixels.data[p + 3] / 255 : 1;
        const offset = index * 4;
        accumulator.sums[offset] += pixels.data[p] * alpha * weight;
        accumulator.sums[offset + 1] += pixels.data[p + 1] * alpha * weight;
        accumulator.sums[offset + 2] += pixels.data[p + 2] * alpha * weight;
        accumulator.sums[offset + 3] += alpha * weight;
      }
    }
  }

  function finish(accumulator) {
    const output = new Uint8Array(accumulator.weights.length * 4);
    for (let i = 0; i < accumulator.weights.length; i += 1) {
      const weight = accumulator.weights[i];
      if (!(weight > 0)) {
        throw new Error("Tile assembly has an uncovered pixel.");
      }
      const p = i * 4;
      const alpha = accumulator.sums[p + 3];
      if (alpha > 0) {
        output[p] = Math.round(accumulator.sums[p] / alpha);
        output[p + 1] = Math.round(accumulator.sums[p + 1] / alpha);
        output[p + 2] = Math.round(accumulator.sums[p + 2] / alpha);
        output[p + 3] = Math.round(255 * Math.min(1, alpha / weight));
      }
    }
    return output;
  }

  globalThis.SeedVR2TileBlending = { intersection, weightAt, createAccumulator, addTile, finish };
})();
