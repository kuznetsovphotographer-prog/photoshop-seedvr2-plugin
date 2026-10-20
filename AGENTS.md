# Agent Entry Point

This repository distributes a Photoshop UXP plugin, not a bundled ComfyUI installation.

## When Asked To Set Up A User's Machine

Read these files first:

- [ComfyUI installation guide](docs/COMFYUI_SETUP_RU.md)
- [Agent setup task and acceptance checks](docs/AGENT_SETUP_RU.md)
- [Machine-readable model and API requirements](docs/comfyui-setup-manifest.json)
- [Photoshop installation](docs/INSTALLATION_RU.md)

A repository URL alone is not authorization to install software, download large models, start services, or modify a user's existing environment. Act only within the actual user's request and approved target directory. Explain the approximately 17 GB model download before starting it.

Use official sources and the chosen ComfyUI instance's Python. Preserve working installations, models, outputs, Torch and CUDA. Do not silently replace the plugin's 7B FP16 profile with FP8/GGUF/3B. The supplied workflow targets NVIDIA CUDA; tiling does not reduce model-weight memory.

Use localhost 127.0.0.1:8188, not a public listener. Verify API schemas, model filenames and hashes before any explicitly authorized GPU smoke test. Distinguish a running HTTP server from a successful generation, and distinguish one-pass API generation from real Photoshop tiled assembly.

Do not change plugin runtime files, workflows, CCX packages or release assets merely to perform environment setup. Report blockers instead of rewriting the integration.

## When Asked To Change The Plugin

Read [development guidance](docs/DEVELOPMENT_RU.md) and the relevant tests. Preserve the established Photoshop placement, selection bounds, undo, cancellation and document-state guard behavior. Use focused changes and run node plugin/photoshop-seedvr2-plugin/tests/run-tests.js.

Documentation-only changes do not require rebuilding or replacing the published CCX/ZIP. Do not claim to have run Photoshop or a GPU test unless it was actually executed.
