const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const baseUrl = "http://127.0.0.1:8188";
const template = require("../workflows/seedvr2_simple_image_upscale_api.json");
const response = (data) => ({ ok: true, json: async () => data });
const modelNames = ["seedvr2_ema_7b_fp16.safetensors", "ema_vae_fp16.safetensors"];

function harness({ online = true, busy = false, models = modelNames, refuseLaunch = false, notComfy = false } = {}) {
  const calls = [];
  const store = new Map();
  const nativePath = "E:/Plugin test/scripts/start-comfy.cmd";
  const sandbox = {
    setTimeout, clearTimeout,
    localStorage: { getItem: store.get.bind(store), setItem: store.set.bind(store) },
    require(id) {
      assert.equal(id, "uxp");
      return { shell: { async openPath(chosen) {
        assert.equal(chosen, nativePath);
        calls.push("launch");
        if (refuseLaunch) return "permission denied";
        online = true;
        return "";
      } }, storage: { localFileSystem: { getPluginFolder: async () => ({
        async getEntry(folder) {
          assert.equal(folder, "scripts");
          return { async getEntry(file) {
            assert.equal(file, "start-comfy.cmd");
            return { nativePath };
          } };
        }
      }) } } };
    },
    async fetch(input, options) {
      const { pathname } = new URL(input);
      if (pathname === "/system_stats") {
        calls.push("probe");
        if (!online) throw new Error("no listener");
        return response(notComfy ? {} : { system: { comfyui_version: "test" } });
      }
      if (pathname === "/queue") return response({ queue_running: busy ? [[1]] : [], queue_pending: [] });
      if (pathname === "/models/seedvr2") return response(models);
      if (pathname.startsWith("/object_info/")) {
        const type = pathname.split("/").pop();
        const node = Object.values(sandbox.SeedVR2WorkflowMapper.buildEngineWorkflow(template, true).prompt)
          .find((entry) => entry.class_type === type);
        assert(node);
        return response({ [type]: { input: { required: node.inputs } } });
      }
      if (pathname === "/free") {
        assert.equal(options.method, "POST");
        assert.deepEqual(JSON.parse(options.body), { unload_models: true, free_memory: true });
        calls.push("free");
        return response({});
      }
      assert.fail(`Unexpected URL: ${input}`);
    }
  };
  for (const name of ["workflowMapper", "comfyEngine"]) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../src/${name}.js`), "utf8"), sandbox);
  }
  sandbox.SeedVR2WorkflowMapper.loadWorkflow = async () => template;
  return { calls, engine: sandbox.SeedVR2ComfyEngine, mapper: sandbox.SeedVR2WorkflowMapper };
}

test("cold startup opens the launcher once, then reuses the running ComfyUI instance", async () => {
  const { engine, calls } = harness({ online: false });
  const options = { onStarting: () => calls.push("starting") };
  assert.equal((await engine.ensureReady(baseUrl, options)).system.comfyui_version, "test");
  await engine.ensureReady(baseUrl, options);
  assert.deepEqual(calls, ["probe", "starting", "launch", "probe", "probe"]);
});

test("startup cancellation, a foreign listener and permission denial do not submit a job", async () => {
  const cancelled = harness({ online: false });
  await assert.rejects(cancelled.engine.ensureReady(baseUrl, {
    check() { if (cancelled.calls.length) throw new Error("cancelled"); }
  }), /cancelled/);
  assert.deepEqual(cancelled.calls, ["probe"]);
  const foreign = harness({ notComfy: true });
  await assert.rejects(foreign.engine.ensureReady(baseUrl), /did not identify/);
  assert.deepEqual(foreign.calls, ["probe"]);
  const denied = harness({ online: false, refuseLaunch: true });
  await assert.rejects(denied.engine.ensureReady(baseUrl), /permission denied/);
});

test("preload and unload share cache keys with normal upscale but do not use or save a user image", async () => {
  const { engine, mapper, calls } = harness();
  const progress = [];
  const seen = [];
  const client = { baseUrl, async runPrompt(prompt, outputId, onProgress, options) {
    await options.beforeQueue();
    seen.push(prompt);
    assert.equal(prompt[outputId].class_type, "PreviewImage");
    assert.equal(prompt["16"].class_type, "EmptyImage");
    assert.equal(prompt["16"].inputs.width, 128);
    assert.equal(prompt["10"].inputs.image[0], "16");
    assert.equal(prompt["17"], undefined);
    onProgress({ value: 37, max: 100 });
  } };
  await engine.preload(client, (value) => progress.push(value));
  assert.deepEqual(progress, [undefined, 37]);
  assert.equal(engine.cacheReady(baseUrl), true);
  const warm = mapper.patchWorkflowObject(template, { imageName: "portrait.png", resolution: 2000, cacheModels: true }).prompt;
  assert.equal(warm["15"].class_type, "SaveImage");
  assert.equal(warm["16"].inputs.image, "portrait.png");
  assert.equal(warm["17"].class_type, "JoinImageWithAlpha");
  assert.equal(await engine.unload(client), true);
  assert.equal(engine.cacheReady(baseUrl), false);
  assert.equal(calls.at(-1), "free");
  for (const role of ["dit", "vae"]) {
    const key = warm["10"].inputs[role][0];
    assert.equal(seen[0]["10"].inputs[role][0], key);
    assert.equal(seen[1]["10"].inputs[role][0], key);
    assert.equal(warm[key].inputs.offload_device, "cpu");
    assert.equal(seen[0][key].inputs.model, warm[key].inputs.model);
    assert.equal(seen[0][key].inputs.cache_model, true);
    assert.equal(seen[1][key].inputs.cache_model, false);
  }
  const regular = mapper.patchWorkflowObject(template, { imageName: "portrait.png", resolution: 2000 }).prompt;
  assert.equal(regular["13"].inputs.cache_model, false);
  assert.equal(regular["14"].inputs.cache_model, false);
});

test("engine controls refuse busy queues, missing models and remote services", async () => {
  const runPrompt = () => assert.fail("Must not enqueue");
  const busy = harness({ busy: true });
  await assert.rejects(busy.engine.preload({ baseUrl, runPrompt }), /ComfyUI is busy/);
  await assert.rejects(busy.engine.unload({ baseUrl, runPrompt }), /ComfyUI is busy/);
  assert(!busy.calls.includes("free"));
  const missing = harness({ models: [] });
  await assert.rejects(missing.engine.preload({ baseUrl, runPrompt }), /model files not found/);
  await assert.rejects(missing.engine.unload({ baseUrl: "http://example.com", runPrompt }), /only on local/);
  const offline = harness({ online: false });
  assert.equal(await offline.engine.unload({ baseUrl, runPrompt }), false);
  assert.deepEqual(offline.calls, ["probe"]);
});
