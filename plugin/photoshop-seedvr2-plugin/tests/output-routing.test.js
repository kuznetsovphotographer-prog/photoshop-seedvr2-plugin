const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function panelHarness(sourceMode, changed = false) {
  const elements = new Map();
  let initialize;
  const element = (id) => {
    if (!elements.has(id)) {
      elements.set(id, { value: "2000", style: {}, hidden: id === "openLastResultBtn", dataset: {}, handlers: {},
        attributes: {},
        classList: { toggle() {}, add() {}, remove() {} },
        addEventListener(name, handler) { this.handlers[name] = handler; },
        querySelector: (name) => element(id + name),
        setAttribute(name, value) { this.attributes[name] = value; },
        matches: () => false, parentElement: { classList: { toggle() {}, add() {}, remove() {} } } });
    }
    return elements.get(id);
  };
  const factors = [2, 3, 4].map((value) => Object.assign(element(`factor-${value}`), { dataset: { factor: String(value) } }));
  const tiles = [2, 4, 6].map((value) => Object.assign(element(`tile-${value}`), { dataset: { parts: String(value) } }));
  const groups = {
    ".choice-hitbox[data-factor]": factors, ".tile-button": tiles, ".choice-hitbox": [...factors, ...tiles]
  };
  const source = { docId: 9, width: 600, height: 400, mode: sourceMode };
  const calls = [];
  const deleted = [];
  const storage = new Map();
  const result = { name: "assembled.png" };
  const host = {
    inspectSource: async () => source,
    assertTilingSupported() {},
    exportVisibleMergedPng: async () => ({ name: "frozen.png" }),
    deleteEntryQuietly: async (file) => { if (file) { deleted.push(file.name); } },
    showAlert: async (message) => calls.push(message),
    openResultDocument: async (file) => { assert.equal(file, result); calls.push("new"); },
    placeSelectionResultIntoSource: async (file, original) => {
      if (changed) { throw new Error("source changed"); }
      assert.equal(file, result); assert.equal(original, source); calls.push("selection");
    },
    replaceDocumentWithResult: async (file, original) => {
      if (changed) { throw new Error("source changed"); }
      assert.equal(file, result); assert.equal(original, source); calls.push("document");
    }
  };
  const sandbox = {
    document: {
      getElementById: element, querySelectorAll: (selector) => groups[selector] || [],
      addEventListener(name, callback) { if (name === "DOMContentLoaded") { initialize = callback; } }
    },
    console, URL, setInterval() {},
    localStorage: { getItem: storage.get.bind(storage), setItem: storage.set.bind(storage) },
    SeedVR2Logger: { createLogger: () => ({ info() {}, warn() {}, error() {} }), formatError: (e) => e.message },
    SeedVR2Photoshop: host,
    SeedVR2ComfyClient: { ComfyClient: class {
      constructor(baseUrl) { this.baseUrl = baseUrl; }
      async uploadImage() { calls.push("single-upload"); return { imageName: "image.png" }; }
      async runPrompt() { return { image: {} }; }
      async downloadImage() { return { file: result }; }
    } },
    SeedVR2ComfyEngine: { ensureReady: async () => ({}), cacheReady: () => false, isLocal: () => true },
    SeedVR2TiledUpscale: { run: async ({ layout, source: original, onProgress }) => {
      assert.equal(layout.count, 6); assert.equal(original.mode, sourceMode);
      calls.push("tiled"); onProgress(98, "Applying..."); return { file: result };
    } },
    SeedVR2WorkflowMapper: { patchWorkflow: async () => ({ prompt: {}, outputNodeId: "15", seed: 1 }) }
  };
  for (const name of ["settings", "imageSizing", "tileLayout", "main"]) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../src/${name}.js`), "utf8"), sandbox);
  }
  return { sandbox, calls, deleted, element, initialize: () => initialize() };
}

for (const mode of ["document", "selection"]) {
  for (const newWindow of [false, true]) {
    test(`tiled ${mode}, New Window ${newWindow ? "ON" : "OFF"} routes one assembled image`, async () => {
      const { sandbox, calls } = panelHarness(mode);
      const info = await sandbox.seedVR2UpscaleActionHandler({}, {
        tiledEnabled: true, tileCount: 6, newWindow, activeMode: "pixels", shortestSide: 2000
      });
      assert.deepEqual(calls, ["tiled", newWindow ? "new" : mode]);
      assert.equal(info.tiledEnabled, true);
      assert.equal(info.tileCount, 6);
      assert.equal(info.newWindow, newWindow);
    });
  }
}

test("an old Action without tile fields follows the original single-image path", async () => {
  const { sandbox, calls } = panelHarness("document");
  const info = await sandbox.seedVR2UpscaleActionHandler({}, { factor: 3 });
  assert.deepEqual(calls, ["single-upload", "document"]);
  assert.equal(info.tiledEnabled, false);
});

test("Actions wait for ComfyUI before exporting, and reuse the warmed workflow for tiles", async () => {
  const h = panelHarness("selection");
  const stages = [];
  h.sandbox.SeedVR2ComfyEngine.ensureReady = async (url, { onStarting }) => {
    onStarting();
    assert.equal(h.element("engineStatus").textContent, "Starting ComfyUI...");
    assert.equal(url, "http://127.0.0.1:8188");
    stages.push("ready");
  };
  h.sandbox.SeedVR2ComfyEngine.cacheReady = () => true;
  h.sandbox.SeedVR2Photoshop.exportVisibleMergedPng = async () => { stages.push("export"); return {}; };
  const tiledRun = h.sandbox.SeedVR2TiledUpscale.run;
  h.sandbox.SeedVR2TiledUpscale.run = async (options) => {
    assert.equal(options.cacheModels, true);
    stages.push("tiled");
    return tiledRun(options);
  };
  await h.sandbox.seedVR2UpscaleActionHandler({}, { tiledEnabled: true, tileCount: 6 });
  assert.deepEqual(stages, ["ready", "export", "tiled"]);
});

test("the panel shows preload progress and blocks Actions until the operation is done", async () => {
  const h = panelHarness("document");
  h.initialize();
  let finish;
  let started;
  const inFlight = new Promise((resolve) => { started = resolve; });
  h.sandbox.SeedVR2ComfyEngine.preload = async (_client, report) => {
    report(37);
    started();
    await new Promise((resolve) => { finish = resolve; });
  };
  const preload = h.element("preloadModelBtn").handlers.click();
  await inFlight;
  assert.match(h.element("engineStatus").textContent, /37%/);
  assert.equal(h.element("upscaleBtn").disabled, true);
  assert.equal(h.element("unloadModelBtn").disabled, true);
  await assert.rejects(h.sandbox.seedVR2UpscaleActionHandler({}, {}), /memory operation/);
  finish();
  await preload;
  assert.equal(h.element("upscaleBtn").disabled, false);
  assert.match(h.element("engineStatus").textContent, /cached in RAM/);
});

test("scale and tile pills remain selectable with a matching accessible pressed state", () => {
  const h = panelHarness("document");
  h.initialize();
  const pressed = (id) => h.element(id).attributes["aria-pressed"];
  assert.equal(pressed("factor-2"), "true");
  h.element("factor-4").handlers.click();
  assert.equal(pressed("factor-2"), "false");
  assert.equal(pressed("factor-4"), "true");
  h.element("pixelsModeToggle").handlers.click();
  assert.equal(pressed("factor-4"), "false");
  assert.equal(pressed("tile-6"), "false");
  h.element("tile-6").handlers.click();
  assert.equal(pressed("tile-6"), "true");
  assert.equal(pressed("tile-4"), "false");
  assert.equal(h.element("tiledToggle").attributes["aria-checked"], "true");
});

test("source change failure propagates out of Action playback without opening a new result", async () => {
  const { sandbox, calls } = panelHarness("selection", true);
  await assert.rejects(sandbox.seedVR2UpscaleActionHandler({}, { tiledEnabled: true, tileCount: 6 }), /source changed/);
  assert.deepEqual(calls, ["tiled"]);
});

test("failed source replacement retains the completed PNG and opens it on explicit recovery without rendering again", async () => {
  const h = panelHarness("document", true);
  h.initialize();
  await assert.rejects(h.sandbox.seedVR2UpscaleActionHandler({}, { tiledEnabled: true, tileCount: 6 }), /source changed/);
  assert.equal(h.element("openLastResultBtn").hidden, false);
  assert(!h.deleted.includes("assembled.png"));
  await h.element("openLastResultBtn").handlers.click();
  assert.deepEqual(h.calls, ["tiled", "new"]);
  assert.equal(h.element("openLastResultBtn").hidden, true);
  assert(!h.deleted.includes("assembled.png"));
});
