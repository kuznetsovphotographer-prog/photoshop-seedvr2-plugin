(function () {
  const INPUT_NODE_ID = "16";
  const UPSCALER_NODE_ID = "10";
  const VAE_NODE_ID = "13";
  const OUTPUT_NODE_ID = "15";

  const FIXED_SETTINGS = {
    vae: {
      encode_tiled: true,
      encode_tile_size: 1024,
      encode_tile_overlap: 128,
      decode_tiled: true,
      decode_tile_size: 1024,
      decode_tile_overlap: 128
    },
    upscaler: {
      uniform_batch_size: true,
      batch_size: 1
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function requiredNode(workflow, id, classType) {
    const node = workflow && workflow[String(id)];
    if (!node) {
      throw new Error(`SeedVR2 workflow node ${id} was not found.`);
    }
    if (node.class_type !== classType) {
      throw new Error(`SeedVR2 workflow node ${id} must be ${classType}, but is ${node.class_type}.`);
    }
    if (!node.inputs) {
      throw new Error(`SeedVR2 workflow node ${id} does not have inputs.`);
    }
    return node;
  }

  function normalizeSeed(value) {
    if (value === undefined || value === null || String(value).trim().toLowerCase() === "random") {
      return Math.floor(Math.random() * 0x100000000);
    }
    const seed = Number(value);
    if (!Number.isFinite(seed) || seed < 0) {
      throw new Error("Seed must be a positive integer or the word random.");
    }
    return Math.min(0xffffffff, Math.floor(seed));
  }

  function normalizeResolution(value) {
    const resolution = Math.round(Number(value));
    if (!Number.isFinite(resolution) || resolution < 16 || resolution > 2500 || resolution % 2 !== 0) {
      throw new Error("SeedVR2 resolution must be an even number between 16 and 2500 pixels.");
    }
    return resolution;
  }

  function assertNoTorchCompile(workflow) {
    for (const node of Object.values(workflow || {})) {
      if (node && node.class_type === "SeedVR2TorchCompileSettings") {
        throw new Error("SeedVR2 Torch Compile must stay disabled for the Photoshop single-image workflow.");
      }
    }
  }

  function enforceFixedSettings(workflow) {
    const vae = requiredNode(workflow, VAE_NODE_ID, "SeedVR2LoadVAEModel");
    const upscaler = requiredNode(workflow, UPSCALER_NODE_ID, "SeedVR2VideoUpscaler");
    Object.assign(vae.inputs, FIXED_SETTINGS.vae);
    Object.assign(upscaler.inputs, FIXED_SETTINGS.upscaler);
  }

  function validateFixedSettings(workflow) {
    const vae = requiredNode(workflow, VAE_NODE_ID, "SeedVR2LoadVAEModel");
    const upscaler = requiredNode(workflow, UPSCALER_NODE_ID, "SeedVR2VideoUpscaler");
    for (const [name, expected] of Object.entries(FIXED_SETTINGS.vae)) {
      if (vae.inputs[name] !== expected) {
        throw new Error(`SeedVR2 VAE optimization ${name} must be ${expected}.`);
      }
    }
    for (const [name, expected] of Object.entries(FIXED_SETTINGS.upscaler)) {
      if (upscaler.inputs[name] !== expected) {
        throw new Error(`SeedVR2 upscaler optimization ${name} must be ${expected}.`);
      }
    }
  }

  function validateWorkflow(workflow) {
    requiredNode(workflow, INPUT_NODE_ID, "LoadImage");
    requiredNode(workflow, "17", "JoinImageWithAlpha");
    requiredNode(workflow, "14", "SeedVR2LoadDiTModel");
    requiredNode(workflow, VAE_NODE_ID, "SeedVR2LoadVAEModel");
    requiredNode(workflow, UPSCALER_NODE_ID, "SeedVR2VideoUpscaler");
    requiredNode(workflow, OUTPUT_NODE_ID, "SaveImage");
    assertNoTorchCompile(workflow);
    validateFixedSettings(workflow);
    return workflow;
  }

  function patchWorkflowObject(template, options) {
    const workflow = clone(template);
    enforceFixedSettings(workflow);
    validateWorkflow(workflow);

    const imageName = String(options && options.imageName || "").trim();
    if (!imageName) {
      throw new Error("ComfyUI upload did not return an input image name.");
    }

    const input = requiredNode(workflow, INPUT_NODE_ID, "LoadImage");
    const upscaler = requiredNode(workflow, UPSCALER_NODE_ID, "SeedVR2VideoUpscaler");
    input.inputs.image = imageName;
    upscaler.inputs.resolution = normalizeResolution(options && options.resolution);
    upscaler.inputs.seed = normalizeSeed(options && options.seed);
    validateWorkflow(workflow);

    return {
      prompt: workflow,
      outputNodeId: OUTPUT_NODE_ID,
      seed: upscaler.inputs.seed,
      resolution: upscaler.inputs.resolution
    };
  }

  async function readPluginJson(pathParts) {
    const { storage } = require("uxp");
    const fs = storage.localFileSystem;
    let entry = await fs.getPluginFolder();
    for (const part of pathParts) {
      entry = await entry.getEntry(part);
    }
    return JSON.parse(await entry.read());
  }

  async function loadWorkflow() {
    return readPluginJson(["workflows", "seedvr2_simple_image_upscale_api.json"]);
  }

  async function patchWorkflow(options) {
    return patchWorkflowObject(await loadWorkflow(), options);
  }

  globalThis.SeedVR2WorkflowMapper = {
    FIXED_SETTINGS,
    OUTPUT_NODE_ID,
    enforceFixedSettings,
    loadWorkflow,
    normalizeResolution,
    normalizeSeed,
    patchWorkflow,
    patchWorkflowObject,
    validateFixedSettings,
    validateWorkflow
  };
})();
