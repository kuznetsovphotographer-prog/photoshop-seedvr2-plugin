const fs = require("fs");
const path = require("path");

require("../src/imageSizing.js");
require("../src/workflowMapper.js");
require("../src/settings.js");

const root = path.resolve(__dirname, "..");
const workflow = JSON.parse(
  fs.readFileSync(path.join(root, "workflows", "seedvr2_simple_image_upscale_api.json"), "utf8")
);
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const mainSource = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const sizing = globalThis.SeedVR2ImageSizing;
const mapper = globalThis.SeedVR2WorkflowMapper;

assert(sizing.computeTargetResolution({ width: 640, height: 480, mode: "scale", factor: 2 }).resolution === 960, "2x sizing failed");
assert(sizing.computeTargetResolution({ width: 640, height: 480, mode: "scale", factor: 3 }).resolution === 1440, "3x sizing failed");
assert(sizing.computeTargetResolution({ width: 640, height: 480, mode: "scale", factor: 4 }).resolution === 1920, "4x sizing failed");
assert(sizing.computeTargetResolution({ width: 2000, height: 3000, mode: "scale", factor: 4 }).resolution === 2500, "factor cap failed");
assert(sizing.computeTargetResolution({ width: 1000, height: 800, mode: "pixels", shortestSide: 2499 }).resolution === 2500, "even rounding failed");
assert(sizing.computeTargetResolution({ width: 1000, height: 800, mode: "pixels", shortestSide: 9999 }).resolution === 2500, "pixel cap failed");
assert(globalThis.SeedVR2Settings.DEFAULTS.shortestSide === 2000, "default exact limit must be 2000");
assert(globalThis.SeedVR2Settings.normalizeShortestSide(3000) === 2500, "settings cap failed");
assert(globalThis.SeedVR2Settings.normalizeShortestSide(2001) === 2002, "settings even rounding failed");
assert(globalThis.SeedVR2Settings.normalizeShortestSide(100) === 500, "settings floor failed");
assert(globalThis.SeedVR2Settings.normalizeFactor(5) === 2, "settings factor fallback failed");
assert(globalThis.SeedVR2Settings.normalizeFactor(3) === 3, "settings factor keep failed");
assert(manifest.host.data.enableMenuRecording === true, "Photoshop menu/action recording must be enabled");
assert(/action\.recordAction\s*\(/.test(mainSource), "Upscale button must record a Photoshop Action step");
assert(/globalThis\[ACTION_METHOD_NAME\]/.test(mainSource), "Photoshop Action playback handler must be globally accessible");
assert(globalThis.SeedVR2Settings.DEFAULTS.newWindow === false, "newWindow default must be OFF");
assert(globalThis.SeedVR2Settings.normalizeSettings({}).newWindow === false, "missing newWindow must normalize to OFF");
assert(globalThis.SeedVR2Settings.normalizeSettings({ newWindow: true }).newWindow === true, "newWindow true must be preserved");
assert(globalThis.SeedVR2Settings.normalizeSettings({ newWindow: false }).newWindow === false, "newWindow false must be preserved");

const settingsStorage = {};
globalThis.localStorage = {
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(settingsStorage, key) ? settingsStorage[key] : null;
  },
  setItem(key, value) {
    settingsStorage[key] = String(value);
  }
};
globalThis.SeedVR2Settings.saveSettings({
  activeMode: "pixels",
  factor: 4,
  shortestSide: 1200,
  newWindow: true
});
assert(globalThis.SeedVR2Settings.loadSettings().newWindow === true, "saved newWindow true must load back");
const settingsKey = Object.keys(settingsStorage)[0];
settingsStorage[settingsKey] = JSON.stringify({
  activeMode: "scale",
  factor: 3,
  shortestSide: 1500
});
assert(globalThis.SeedVR2Settings.loadSettings().newWindow === false, "old settings without newWindow must load as OFF");

const patched = mapper.patchWorkflowObject(workflow, {
  imageName: "seedvr2-document-test.png",
  resolution: 2000,
  seed: 123
});

assert(patched.prompt["16"].inputs.image === "seedvr2-document-test.png", "input node patch failed");
assert(patched.prompt["10"].inputs.resolution === 2000, "resolution patch failed");
assert(patched.prompt["10"].inputs.seed === 123, "seed patch failed");
assert(patched.prompt["13"].inputs.encode_tiled === true, "encode_tiled invariant failed");
assert(patched.prompt["13"].inputs.encode_tile_size === 1024, "encode_tile_size invariant failed");
assert(patched.prompt["13"].inputs.encode_tile_overlap === 128, "encode_tile_overlap invariant failed");
assert(patched.prompt["13"].inputs.decode_tiled === true, "decode_tiled invariant failed");
assert(patched.prompt["13"].inputs.decode_tile_size === 1024, "decode_tile_size invariant failed");
assert(patched.prompt["13"].inputs.decode_tile_overlap === 128, "decode_tile_overlap invariant failed");
assert(patched.prompt["10"].inputs.uniform_batch_size === true, "uniform_batch_size invariant failed");
assert(patched.prompt["10"].inputs.batch_size === 1, "batch_size invariant failed");
assert(!Object.values(patched.prompt).some((node) => node.class_type === "SeedVR2TorchCompileSettings"), "Torch Compile must stay disabled");
assert(patched.prompt["14"].inputs.model === "seedvr2_ema_7b_fp16.safetensors", "7B FP16 model must be preserved");
assert(patched.prompt["10"].inputs.color_correction === "lab", "lab correction must be preserved");
assert(patched.prompt["10"].inputs.max_resolution === 0, "long-side limit must stay disabled");
assert(patched.prompt["17"].inputs.alpha[0] === "16", "alpha chain must be preserved");

const intentionallyDisabled = JSON.parse(JSON.stringify(workflow));
intentionallyDisabled["13"].inputs.encode_tiled = false;
intentionallyDisabled["13"].inputs.encode_tile_size = 256;
intentionallyDisabled["13"].inputs.encode_tile_overlap = 0;
intentionallyDisabled["13"].inputs.decode_tiled = false;
intentionallyDisabled["13"].inputs.decode_tile_size = 256;
intentionallyDisabled["13"].inputs.decode_tile_overlap = 0;
intentionallyDisabled["10"].inputs.uniform_batch_size = false;
intentionallyDisabled["10"].inputs.batch_size = 5;
const forced = mapper.patchWorkflowObject(intentionallyDisabled, {
  imageName: "seedvr2-selection-test.png",
  resolution: 1800,
  seed: 456
});
assert(forced.prompt["13"].inputs.encode_tiled === true, "mapper must force encode_tiled");
assert(forced.prompt["13"].inputs.encode_tile_size === 1024, "mapper must force encode_tile_size");
assert(forced.prompt["13"].inputs.encode_tile_overlap === 128, "mapper must force encode_tile_overlap");
assert(forced.prompt["13"].inputs.decode_tiled === true, "mapper must force decode_tiled");
assert(forced.prompt["13"].inputs.decode_tile_size === 1024, "mapper must force decode_tile_size");
assert(forced.prompt["13"].inputs.decode_tile_overlap === 128, "mapper must force decode_tile_overlap");
assert(forced.prompt["10"].inputs.uniform_batch_size === true, "mapper must force uniform_batch_size");
assert(forced.prompt["10"].inputs.batch_size === 1, "mapper must force batch_size");

const withTorchCompile = JSON.parse(JSON.stringify(workflow));
withTorchCompile["99"] = {
  class_type: "SeedVR2TorchCompileSettings",
  inputs: {}
};
let rejectedTorchCompile = false;
try {
  mapper.patchWorkflowObject(withTorchCompile, {
    imageName: "must-not-run.png",
    resolution: 2000,
    seed: 789
  });
} catch (error) {
  rejectedTorchCompile = /Torch Compile/.test(error.message);
}
assert(rejectedTorchCompile, "mapper must reject Torch Compile");

console.log("SeedVR2 tests passed");
