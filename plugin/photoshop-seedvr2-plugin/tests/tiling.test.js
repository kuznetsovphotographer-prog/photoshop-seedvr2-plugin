const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("../src/imageSizing.js");
require("../src/tileLayout.js");
require("../src/tileBlending.js");
require("../src/settings.js");
require("../src/tiledUpscale.js");
const geometry = globalThis.SeedVR2TileLayout;
const blend = globalThis.SeedVR2TileBlending;
const settings = globalThis.SeedVR2Settings;

function layout(width = 97, height = 65, tileCount = 4, extra = {}) {
  return geometry.computeLayout({ width, height, tileCount, mode: "scale", factor: 2, ...extra });
}

test("orientation, identical crops, outer bounds and coverage for 2/4/6 parts", () => {
  for (const [w, h] of [[97, 65], [65, 97], [67, 67], [2, 3], [3001, 2003]]) {
    for (const count of [2, 4, 6]) {
      const l = layout(w, h, count);
      assert.equal(l.tiles.length, count);
      assert.equal(l.columns * l.rows, count);
      assert.equal(l.targetWidth % 2, 0);
      assert.equal(l.targetHeight % 2, 0);
      for (const tile of l.tiles) {
        assert.equal(tile.bounds.right - tile.bounds.left, l.tileWidth);
        assert.equal(tile.bounds.bottom - tile.bounds.top, l.tileHeight);
        assert(tile.target.right > tile.target.left && tile.target.bottom > tile.target.top);
      }
      assert.equal(l.tiles[0].target.left, 0);
      assert.equal(l.tiles[0].target.top, 0);
      assert.equal(l.tiles.at(-1).target.right, l.targetWidth);
      assert.equal(l.tiles.at(-1).target.bottom, l.targetHeight);
      if (count === 6) { assert.equal(l.columns, w >= h ? 3 : 2); }
      if (w < 100) {
        for (let y = 0; y < l.targetHeight; y++) {
          for (let x = 0; x < l.targetWidth; x++) {
            assert(l.tiles.reduce((sum, tile) => sum + blend.weightAt(tile, x, y), 0) > 0, `${w}x${h}, ${count}: hole ${x},${y}`);
          }
        }
      }
    }
  }
});

test("2500 cap applies to each overlapping crop, never to the assembled canvas", () => {
  for (const count of [2, 4, 6]) {
    const l = layout(6001, 4001, count, { factor: 4 });
    assert.equal(l.resolution, 2500);
    assert(l.capped);
    assert(Math.min(l.targetWidth, l.targetHeight) > 2500);
    const exact = layout(3001, 2003, count, { mode: "pixels", shortestSide: 2001 });
    assert.equal(exact.resolution, 2002);
    assert.equal(exact.scale, 2002 / Math.min(exact.tileWidth, exact.tileHeight));
  }
});

test("invalid geometry and oversized PNG fail before rendering", () => {
  assert.throws(() => layout(0, 20), /positive/);
  assert.throws(() => layout(1, 5, 6), /too small/);
  assert.throws(() => layout(30001, 10), /30000/);
  assert.throws(() => layout(29999, 100, 6, { mode: "pixels", shortestSide: 2500 }), /30000/);
});

function pixelsFor(tile, sample, components = 4) {
  const b = tile.target;
  const width = b.right - b.left;
  const data = new Uint8Array(width * (b.bottom - b.top) * components);
  for (let y = b.top; y < b.bottom; y++) {
    for (let x = b.left; x < b.right; x++) {
      const p = ((y - b.top) * width + x - b.left) * components;
      data.set(sample(x, y).slice(0, components), p);
    }
  }
  return { bounds: b, width, data, components };
}

test("block blending retains constant colors and alpha at every seam and four-way crossing", () => {
  for (const count of [2, 4, 6]) {
    const l = layout(61, 43, count);
    for (const rgba of [[80, 120, 150, 255], [80, 120, 150, 127], [0, 0, 0, 0]]) {
      for (let top = 0; top < l.targetHeight; top += 13) {
        for (let left = 0; left < l.targetWidth; left += 17) {
          const a = blend.createAccumulator({ left, top, right: Math.min(left + 17, l.targetWidth), bottom: Math.min(top + 13, l.targetHeight) });
          for (const tile of l.tiles) { blend.addTile(a, tile, pixelsFor(tile, () => rgba)); }
          const result = blend.finish(a);
          for (let i = 0; i < result.length; i++) { assert.equal(result[i], rgba[i % 4]); }
        }
      }
    }
  }
});

test("synthetic gradient and straight lines stay aligned across joins", () => {
  const l = layout(53, 37, 6);
  const sample = (x, y) => [x % 11 === 0 ? 255 : x, y % 7 === 0 ? 255 : y, (x + y) % 256, 255];
  const a = blend.createAccumulator({ left: 0, top: 0, right: l.targetWidth, bottom: l.targetHeight });
  for (const tile of l.tiles) { blend.addTile(a, tile, pixelsFor(tile, sample)); }
  const result = blend.finish(a);
  for (let y = 0; y < l.targetHeight; y++) {
    for (let x = 0; x < l.targetWidth; x++) {
      assert.deepEqual(Array.from(result.slice((y * l.targetWidth + x) * 4, (y * l.targetWidth + x) * 4 + 4)), sample(x, y));
    }
  }
});

test("trimmed transparent regions keep their original offsets and alpha", () => {
  const tile = { target: { left: 0, top: 0, right: 4, bottom: 2 }, feather: {} };
  const a = blend.createAccumulator(tile.target);
  blend.addTile(a, tile, { bounds: { left: 2, top: 1, right: 3, bottom: 2 }, width: 1, components: 4, data: new Uint8Array([90, 120, 200, 128]) });
  const result = blend.finish(a);
  assert.deepEqual(Array.from(result.slice(24, 28)), [90, 120, 200, 128]);
  assert.equal(result.filter((_, i) => i % 4 === 3 && i !== 27).some(Boolean), false);
});

test("RGB pixels are opaque; transparent neighbors do not leave black fringes", () => {
  const tile = { target: { left: 0, top: 0, right: 1, bottom: 1 }, feather: {} };
  const a = blend.createAccumulator(tile.target);
  blend.addTile(a, tile, { bounds: tile.target, width: 1, components: 3, data: new Uint8Array([100, 150, 200]) });
  blend.addTile(a, tile, null);
  assert.deepEqual(Array.from(blend.finish(a)), [100, 150, 200, 128]);
  assert.throws(() => blend.finish(blend.createAccumulator(tile.target)), /uncovered/);
});

test("old settings/Actions default to tiling OFF and persist strict booleans", () => {
  assert.equal(settings.normalizeSettings({}).tiledEnabled, false);
  assert.equal(settings.normalizeSettings({}).tileCount, 4);
  assert.equal(settings.normalizeSettings({ tiledEnabled: "true", tileCount: 5 }).tiledEnabled, false);
  const storage = new Map();
  globalThis.localStorage = { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) };
  settings.saveSettings({ tiledEnabled: true, tileCount: 6 });
  assert.equal(settings.loadSettings().tiledEnabled, true);
  assert.equal(settings.loadSettings().tileCount, 6);
  assert(storage.has("seedvr2UpscalerSettings.v2"));
});

async function runSequence({ cancelAt = 0, failAt = 0 } = {}) {
  const token = { cancelled: false };
  const l = layout(97, 65, 4);
  const deleted = [];
  const calls = [];
  const progress = [];
  const seeds = [];
  let running = false;
  let assembled = false;
  let completed = 0;
  const crops = l.tiles.map((t) => ({ name: `crop-${t.index}` }));
  const host = {
    exportTilesFromSnapshot: async () => crops,
    deleteEntryQuietly: async (f) => { if (f) { deleted.push(f.name); } },
    assembleTileResults: async (outputs, source, grid, logger, cancelToken, report) => {
      assembled = true;
      assert.equal(outputs.length, 4);
      report(0.5);
      report(1);
      return { name: "assembled" };
    }
  };
  const client = {
    uploadImage: async (file) => {
      assert.equal(running, false);
      calls.push(file.name);
      return { imageName: file.name };
    },
    runPrompt: async (prompt, node, report, options) => {
      assert.equal(running, false);
      running = true;
      const index = calls.length;
      options.onPromptQueued(`prompt-${index}`);
      if (index === failAt) { throw new Error("render failed"); }
      report({ value: 9, max: 10 });
      report({ value: 1, max: 10 });
      await new Promise((resolve) => setImmediate(resolve));
      running = false;
      return { image: { filename: `output-${index}` } };
    },
    downloadImage: async (image) => {
      completed++;
      if (completed === cancelAt) { token.cancelled = true; }
      return { file: { name: image.filename } };
    }
  };
  const mapper = {
    normalizeSeed: () => 123,
    patchWorkflow: async (options) => { seeds.push(options.seed); return { prompt: {}, outputNodeId: "15" }; }
  };
  let error;
  let result;
  try {
    result = await globalThis.SeedVR2TiledUpscale.run({ client, photoshop: host, mapper, source: {}, sourceFile: {}, layout: l,
      cancelToken: token, onPromptQueued() {}, onProgress: (p) => progress.push(p) });
  } catch (e) { error = e; }
  return { error, result, deleted, calls, assembled, progress, seeds };
}

test("parts render one at a time, share seed, clean up, and report monotonic overall progress", async () => {
  const r = await runSequence();
  assert.equal(r.error, undefined);
  assert.equal(r.result.file.name, "assembled");
  assert.deepEqual(r.calls, ["crop-0", "crop-1", "crop-2", "crop-3"]);
  assert.deepEqual(r.seeds, [123, 123, 123, 123]);
  assert.equal(r.deleted.length, 8);
  assert(!r.deleted.includes("assembled"));
  assert(r.progress.every((p, i) => i === 0 || p >= r.progress[i - 1]));
  assert.equal(r.progress.at(-1), 98);
});

test("Stop after the second part prevents remaining prompts and assembly", async () => {
  const r = await runSequence({ cancelAt: 2 });
  assert.equal(r.error.kind, "cancelled");
  assert.equal(r.calls.length, 2);
  assert.equal(r.assembled, false);
  assert.equal(r.deleted.length, 6);
});

test("intermediate server failure aborts the whole operation and cleans downloaded files", async () => {
  const r = await runSequence({ failAt: 2 });
  assert.match(r.error.message, /render failed/);
  assert.equal(r.calls.length, 2);
  assert.equal(r.assembled, false);
  assert.equal(r.deleted.length, 5);
});

function clientInVm() {
  const sandbox = { require: () => ({ storage: { localFileSystem: {}, formats: {} } }),
    setTimeout, clearTimeout, setInterval, clearInterval, URL, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/comfyClient.js"), "utf8"), sandbox);
  return new sandbox.SeedVR2ComfyClient.ComfyClient("http://127.0.0.1:8188");
}

test("socket handles early completion, ignores foreign progress and closes cleanly", async () => {
  const client = clientInVm();
  const ws = { readyState: 1, close() { this.readyState = 3; } };
  let progress = 0;
  await client.waitForSocketDone(ws, "ours", () => progress++, {}, [
    { type: "progress", data: { prompt_id: "other", value: 1, max: 2 } },
    { type: "progress", data: { prompt_id: "ours", value: 1, max: 2 } },
    { type: "executing", data: { prompt_id: "ours", node: null } }
  ]);
  assert.equal(progress, 1);
  assert.equal(ws.readyState, 3);
});

test("polling reports execution failures and timeouts immediately", async () => {
  const client = clientInVm();
  client.getHistory = async () => ({ ours: { status: { status_str: "error", messages: [["execution_error", { exception_message: "OOM" }]] } } });
  await assert.rejects(client.waitForHistoryImage("ours", "15", {}), /OOM/);
  await assert.rejects(client.waitForHistoryImage("ours", "15", {}, Date.now() - 1), /timed out/);
});

test("WebSocket failure falls back to polling and runPrompt always closes its socket", async () => {
  const client = clientInVm();
  let closed = false;
  const ws = { readyState: 3, close() { closed = true; } };
  client.openSocket = async () => ws;
  client.queuePrompt = async () => "ours";
  client.getHistory = async () => ({ ours: { outputs: { "15": { images: [{ filename: "ok.png" }] } } } });
  const result = await client.runPrompt({}, "15", () => {}, { cancelToken: {} });
  assert.equal(result.image.filename, "ok.png");
  assert(closed);
});
