const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function hostHarness() {
  const documents = [];
  let nextId = 10;
  let activeId = 1;
  let disposed = 0;
  let allocated = 0;
  let largestBuffer = 0;
  let failWrite = false;
  const source = { id: 1, width: 1500, height: 400, activeHistoryState: { id: 7 } };
  documents.push(source);
  function makeDoc(width, height, data) {
    const doc = { id: nextId++, width, height, activeHistoryState: { id: 1 },
      activeLayers: [{ id: nextId++ }], data: data || new Uint8Array(width * height * 4),
      async closeWithoutSaving() { documents.splice(documents.indexOf(doc), 1); },
      saveAs: { png: async (file) => { file.width = width; file.height = height; file.data = doc.data.slice(); } }
    };
    documents.push(doc);
    activeId = doc.id;
    return doc;
  }
  const app = {
    documents,
    get activeDocument() { return documents.find((doc) => doc.id === activeId); },
    open: async (file) => makeDoc(file.width, file.height, file.data)
  };
  documents.add = async (options) => {
    assert.equal(options.fill, "transparent");
    assert.equal(options.profile, "sRGB IEC61966-2.1");
    return makeDoc(options.width, options.height);
  };
  function imageData(width, height, data, components = 4) {
    allocated++;
    largestBuffer = Math.max(largestBuffer, data.length);
    return { width, height, components, getData: async () => data, dispose() { disposed++; } };
  }
  const imaging = {
    async getPixels({ documentID, sourceBounds: b, applyAlpha, componentSize }) {
      assert.equal(applyAlpha, false);
      assert.equal(componentSize, 8);
      const doc = documents.find((d) => d.id === documentID);
      let minX = b.right, minY = b.bottom, maxX = b.left, maxY = b.top;
      for (let y = b.top; y < b.bottom; y++) {
        for (let x = b.left; x < b.right; x++) {
          if (doc.data[(y * doc.width + x) * 4 + 3]) {
            minX = Math.min(x, minX); minY = Math.min(y, minY); maxX = Math.max(x + 1, maxX); maxY = Math.max(y + 1, maxY);
          }
        }
      }
      if (maxX <= minX || maxY <= minY) { return { imageData: imageData(0, 0, new Uint8Array()), level: 0 }; }
      const width = maxX - minX, height = maxY - minY;
      const data = new Uint8Array(width * height * 4);
      for (let y = minY; y < maxY; y++) {
        data.set(doc.data.subarray((y * doc.width + minX) * 4, (y * doc.width + maxX) * 4), (y - minY) * width * 4);
      }
      return { imageData: imageData(width, height, data), level: 0,
        sourceBounds: { left: minX, top: minY, right: maxX, bottom: maxY } };
    },
    async createImageDataFromBuffer(data, options) { return imageData(options.width, options.height, data); },
    async putPixels({ documentID, imageData: pixels, targetBounds: b, replace }) {
      if (failWrite) { throw new Error("write failed"); }
      assert.equal(replace, false);
      const doc = documents.find((d) => d.id === documentID);
      const data = await pixels.getData();
      for (let y = 0; y < pixels.height; y++) {
        doc.data.set(data.subarray(y * pixels.width * 4, (y + 1) * pixels.width * 4), ((y + b.top) * doc.width + b.left) * 4);
      }
    }
  };
  const photoshop = {
    app, imaging, constants: {},
    action: { batchPlay: async ([descriptor]) => { if (descriptor._obj === "select") { activeId = descriptor._target[0]._id; } } },
    core: { executeAsModal: async (callback) => callback({ isCancelled: false }) }
  };
  const sandbox = { console, setTimeout, Uint8Array, Float32Array,
    require(name) {
      if (name === "photoshop") { return photoshop; }
      return { storage: { localFileSystem: { getTemporaryFolder: async () => ({ createFile: async (name) => ({ name, delete: async function () { this.deleted = true; } }) }) } } };
    }
  };
  for (const name of ["imageSizing", "tileLayout", "tileBlending", "tiledUpscale", "photoshop"]) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../src/${name}.js`), "utf8"), sandbox);
  }
  return { sandbox, source, documents, stats: () => ({ disposed, allocated, largestBuffer, activeId }), fail: () => { failWrite = true; } };
}

function renderParts(harness, grid) {
  return grid.tiles.map((tile) => {
    const b = tile.target;
    const width = b.right - b.left, height = b.bottom - b.top;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gx = b.left + x, gy = b.top + y;
        const alpha = gx < 12 || gy < 7 ? 0 : 128;
        data.set(alpha ? [80, 120, 150, alpha] : [0, 0, 0, 0], (y * width + x) * 4);
      }
    }
    return { tile, file: { width, height, data } };
  });
}

test("Photoshop adapter assembles blocks with trimmed alpha and disposes all image buffers", async () => {
  const h = hostHarness();
  const grid = h.sandbox.SeedVR2TileLayout.computeLayout({ width: 601, height: 151, tileCount: 6, mode: "scale", factor: 2 });
  const parts = renderParts(h, grid);
  const output = await h.sandbox.SeedVR2Photoshop.assembleTileResults(parts, { docId: 1 }, grid, null, {});
  for (let y = 0; y < grid.targetHeight; y++) {
    for (let x = 0; x < grid.targetWidth; x++) {
      const p = (y * grid.targetWidth + x) * 4;
      assert.equal(output.data[p + 3], x < 12 || y < 7 ? 0 : 128);
      if (output.data[p + 3]) { assert.equal(output.data[p], 80); }
    }
  }
  assert.equal(h.stats().disposed, h.stats().allocated);
  assert(h.stats().largestBuffer <= 1024 * 128 * 4);
  assert.equal(h.documents.length, 1);
  assert.equal(h.stats().activeId, 1);
});

test("assembly write failure closes only temporary documents and restores the original", async () => {
  const h = hostHarness();
  const grid = h.sandbox.SeedVR2TileLayout.computeLayout({ width: 20, height: 16, tileCount: 4, mode: "scale", factor: 2 });
  h.fail();
  await assert.rejects(h.sandbox.SeedVR2Photoshop.assembleTileResults(renderParts(h, grid), { docId: 1 }, grid, null, {}), /write failed/);
  assert.equal(h.documents.length, 1);
  assert.equal(h.stats().disposed, h.stats().allocated);
  assert.equal(h.stats().activeId, 1);
});

test("document snapshot verification rejects edits, resizing and closure", () => {
  const h = hostHarness();
  const snapshot = { docId: 1, historyStateId: 7, documentWidth: 1500, documentHeight: 400 };
  assert.equal(h.sandbox.SeedVR2Photoshop.verifyDocumentUnchanged(snapshot), h.source);
  h.source.activeHistoryState.id++;
  assert.throws(() => h.sandbox.SeedVR2Photoshop.verifyDocumentUnchanged(snapshot), /changed/);
  h.source.activeHistoryState.id = 7;
  h.source.width++;
  assert.throws(() => h.sandbox.SeedVR2Photoshop.verifyDocumentUnchanged(snapshot), /changed/);
  h.documents.length = 0;
  assert.throws(() => h.sandbox.SeedVR2Photoshop.verifyDocumentUnchanged(snapshot), /closed/);
});

test("guard identifies changed history versus changed size and logs expected/current values", () => {
  const h = hostHarness();
  const snapshot = { docId: 1, historyStateId: 7, historyStateName: "Open", documentWidth: 1500, documentHeight: 400 };
  h.source.activeHistoryState = { id: 8, name: "Brush" };
  const logs = [];
  assert.throws(() => h.sandbox.SeedVR2Photoshop.verifyDocumentUnchanged(snapshot, { info: (message) => logs.push(message) }),
    (error) => error.kind === "source_changed" && /History: 7.*8.*Brush/.test(error.message));
  assert(logs.some((message) => /"historyId":7/.test(message) && /"historyId":8/.test(message)));
  h.source.activeHistoryState.id = 7;
  h.source.width = 1501;
  assert.throws(() => h.sandbox.SeedVR2Photoshop.verifyDocumentUnchanged(snapshot), /Size: 1500x400 -> 1501x400/);
});
