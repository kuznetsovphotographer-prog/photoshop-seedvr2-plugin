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
        classList: { toggle() {}, add() {}, remove() {} },
        addEventListener(name, handler) { this.handlers[name] = handler; },
        querySelector: (name) => element(id + name),
        setAttribute() {}, matches: () => false, parentElement: { classList: { toggle() {}, add() {}, remove() {} } } });
    }
    return elements.get(id);
  };
  const source = { docId: 9, width: 600, height: 400, mode: sourceMode };
  const calls = [];
  const deleted = [];
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
    document: { getElementById: element, querySelectorAll: () => [], addEventListener(name, callback) { if (name === "DOMContentLoaded") { initialize = callback; } } },
    console, URL, setInterval() {},
    SeedVR2Logger: { createLogger: () => ({ info() {}, warn() {}, error() {} }), formatError: (e) => e.message },
    SeedVR2Photoshop: host,
    SeedVR2ComfyClient: { ComfyClient: class {
      async testConnection() { return {}; }
      async uploadImage() { calls.push("single-upload"); return { imageName: "image.png" }; }
      async runPrompt() { return { image: {} }; }
      async downloadImage() { return { file: result }; }
    } },
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
