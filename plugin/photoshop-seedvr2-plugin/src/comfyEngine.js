(function () {
  const LOCAL_URL = "http://127.0.0.1:8188";
  const CACHE_KEY = "seedvr2-upscaler.engine-cache.v1";
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let cacheState;

  function isLocal(baseUrl) {
    return baseUrl === LOCAL_URL || baseUrl === "http://localhost:8188";
  }

  function rememberCache(state) {
    cacheState = state;
    try { localStorage.setItem(CACHE_KEY, state); } catch (_) { /* Keep state in this panel. */ }
  }

  function readCache() {
    if (cacheState === undefined) {
      try { cacheState = localStorage.getItem(CACHE_KEY) || ""; } catch (_) { cacheState = ""; }
    }
    return cacheState;
  }

  function cacheReady(baseUrl) {
    return isLocal(baseUrl) && readCache() === "ready";
  }

  async function bounded(task, message, ms = 3000) {
    let timeout;
    try {
      return await Promise.race([task, new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), ms);
      })]);
    } finally {
      clearTimeout(timeout);
    }
  }

  function request(baseUrl, path, options, timeout) {
    return bounded(fetch(baseUrl + path, options), `ComfyUI did not respond to ${path} in time.`, timeout);
  }

  async function json(response, label) {
    if (!response.ok) throw new Error(`${label} (HTTP ${response.status}).`);
    return bounded(response.json(), `${label}: incomplete response.`);
  }

  async function probe(baseUrl) {
    let response;
    try { response = await request(baseUrl, "/system_stats"); }
    catch (_) { return null; }
    const data = await json(response, `Could not identify the service at ${baseUrl}`);
    if (!data || !data.system || !data.system.comfyui_version) {
      throw new Error(`The service at ${baseUrl} did not identify itself as ComfyUI.`);
    }
    return data;
  }

  async function openLauncher(check) {
    const { shell, storage } = require("uxp");
    if (!shell || typeof shell.openPath !== "function") {
      throw new Error("Automatic launch is unavailable in this Photoshop. Start ComfyUI manually.");
    }
    const folder = await storage.localFileSystem.getPluginFolder();
    const scripts = await folder.getEntry("scripts");
    const launcher = await scripts.getEntry("start-comfy.cmd");
    if (!launcher.nativePath || !/\.cmd$/i.test(launcher.nativePath)) {
      throw new Error("The Windows launcher has no local path in this Photoshop.");
    }
    check();
    const error = await shell.openPath(launcher.nativePath,
      "Start local ComfyUI for SeedVR2 without opening Stability Matrix.");
    if (error) throw new Error(`Could not open the ComfyUI launcher: ${error}`);
  }

  async function ensureReady(baseUrl, { check = () => {}, onStarting = () => {} } = {}) {
    check();
    const running = await probe(baseUrl);
    check();
    if (running) return running;
    if (!isLocal(baseUrl)) {
      throw new Error("Could not reach ComfyUI. Automatic launch is available only on local port 8188.");
    }
    onStarting();
    await openLauncher(check);
    const deadline = Date.now() + 155000;
    while (Date.now() < deadline) {
      check();
      const ready = await probe(baseUrl);
      check();
      if (ready) return ready;
      await wait(900);
    }
    throw new Error("ComfyUI did not start. Check comfyui-path.txt and comfy-launch.log in %LOCALAPPDATA%\\SeedVR2Upscaler, or start ComfyUI manually.");
  }

  async function requireIdle(baseUrl) {
    const queue = await json(await request(baseUrl, "/queue"), "Could not check the ComfyUI queue");
    if (!queue || !Array.isArray(queue.queue_running) || !Array.isArray(queue.queue_pending)) {
      throw new Error("Could not verify that the ComfyUI queue is empty.");
    }
    if (queue.queue_running.length || queue.queue_pending.length) {
      throw new Error("ComfyUI is busy. Wait for its queue to finish and try again.");
    }
  }

  function requireLocal(baseUrl) {
    if (!isLocal(baseUrl)) throw new Error("Preload and Unload are available only on local ComfyUI port 8188.");
  }

  async function checkGraph(baseUrl, graph) {
    const types = [...new Set(Object.values(graph.prompt).map((node) => node.class_type))];
    const schemas = await Promise.all(types.map(async (type) => {
      const info = await json(await request(baseUrl, `/object_info/${type}`, undefined, 8000), `Could not check ${type}`);
      if (!info || !info[type]) throw new Error(`ComfyUI is missing the ${type} node.`);
      return info[type];
    }));
    for (const [id, node] of Object.entries(graph.prompt)) {
      const input = schemas[types.indexOf(node.class_type)].input || {};
      const available = { ...input.required, ...input.optional };
      for (const name of Object.keys(node.inputs)) {
        if (!(name in available)) throw new Error(`ComfyUI node ${node.class_type} (${id}) does not support ${name}.`);
      }
    }
    const models = await json(await request(baseUrl, "/models/seedvr2", undefined, 8000), "Could not list installed SeedVR2 models");
    const missing = graph.models.filter((file) => !Array.isArray(models) || !models.includes(file));
    if (missing.length) throw new Error(`SeedVR2 model files not found: ${missing.join(", ")}.`);
  }

  async function runMemoryPass(client, keepCached, onProgress) {
    const mapper = globalThis.SeedVR2WorkflowMapper;
    const graph = mapper.buildEngineWorkflow(await mapper.loadWorkflow(), keepCached);
    await checkGraph(client.baseUrl, graph);
    await requireIdle(client.baseUrl);
    // Mark before submission: a dropped response can leave a queued task and a partial cache.
    if (keepCached) rememberCache("possible");
    onProgress();
    await client.runPrompt(graph.prompt, graph.outputNodeId, (data) => {
      const max = Number(data && data.max);
      const value = Number(data && data.value);
      if (max > 0 && Number.isFinite(value)) onProgress(Math.max(0, Math.min(99, 100 * value / max)));
    }, { beforeQueue: () => requireIdle(client.baseUrl) });
  }

  async function preload(client, onProgress = () => {}) {
    requireLocal(client.baseUrl);
    await requireIdle(client.baseUrl);
    await runMemoryPass(client, true, onProgress);
    rememberCache("ready");
  }

  async function unload(client, onProgress = () => {}) {
    const baseUrl = client.baseUrl;
    requireLocal(baseUrl);
    if (!await probe(baseUrl)) return false;
    await requireIdle(baseUrl);
    if (readCache()) {
      // ComfyUI /free alone does not clear the custom SeedVR2 cache. A pass with
      // the same loader IDs and caching disabled clears those two entries.
      await runMemoryPass(client, false, onProgress);
      rememberCache("");
      // History can appear slightly before the queue reports that execution finished.
      await wait(300);
      await requireIdle(baseUrl);
    }
    const response = await request(baseUrl, "/free", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unload_models: true, free_memory: true })
    });
    if (!response.ok) throw new Error(`ComfyUI refused to release memory (HTTP ${response.status}).`);
    return true;
  }

  globalThis.SeedVR2ComfyEngine = { ensureReady, cacheReady, preload, unload, isLocal };
})();
