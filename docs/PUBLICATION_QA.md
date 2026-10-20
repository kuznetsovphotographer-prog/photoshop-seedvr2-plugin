# Publication QA: v0.2.0

Prepared on 2026-10-20 from the author's final v0.2.0 CCX.

## Verified

- Manifest version 0.2.0, plugin ID unchanged: com.local.photoshop.seedvr2-upscaler.
- All 23 non-documentation archive records match the author's CCX byte for byte and match the public source tree: manifest, HTML, CSS, icons, JS, workflow, tests and icon script.
- Internal OPENROUTER_FIX_SPEC_RU.md and PROJECT_STATE.md excluded from the publication CCX. Three documentation files replaced by public versions. The author's original CCX was not modified.
- JavaScript syntax checks and manifest/workflow JSON parsing passed.
- Original assertions plus all 25 Node tests passed.
- Root and panel PNG icons passed the UXP icon validator.
- Windows ZIP contains the expected six files; each entry matches its standalone copy.
- Workflow copies in plugin, repository and Windows bundle match.
- Local documentation links checked; README preview rendered without broken images or horizontal overflow at 1280 px.
- All seven screen recordings were sampled and visually reviewed. Eight new GIFs prepared, total approximately 7.8 MiB; the older selection GIF retained.
- Before/after detail images registered and resized for comparison, with processing disclosed. Actual screen dialogs show 1800 x 2417 and 3600 x 4834 pixels.

## SHA256

Original author CCX, retained locally:

    949c429ce605f57e686ec7dc2d8fca5ade54cafe8f131b6c02691e324c3c9954

Publication CCX, documentation-only cleanup:

    897fa6b93dc61593bc24ff03ff96372db17a4830186a5a90bb748bf6273bf5bb

Windows ZIP:

    9089b05d86ac1c83a0ceebf3ffc93751a43c107ae37debab3e8d266b3b57fd27

Standalone asset checksums: [SHA256SUMS.txt](../ccx/SHA256SUMS.txt).

## Manual Scope

The author's recordings show the running plugin and a successful 2x/four-part result. Photoshop, ComfyUI GPU generation and BAT installation/uninstallation were not executed automatically during publication. The cleaned publication CCX still needs a manual installation smoke-test; archive and runtime equivalence checks do not substitute for that test. See [manual scenarios](../plugin/photoshop-seedvr2-plugin/MANUAL_TEST_RU.md).
