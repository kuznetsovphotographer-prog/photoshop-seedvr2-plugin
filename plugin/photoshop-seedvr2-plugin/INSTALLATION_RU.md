# Установка SeedVR2 Upscaler

## Для разработки

1. Запустите Photoshop и Adobe UXP Developer Tool.
2. Добавьте `manifest.json` из корня плагина.
3. Нажмите `Load`.
4. Откройте панель через меню Photoshop `Plugins -> SeedVR2 Upscaler -> SeedVR2 Upscaler`.

## Перед использованием

1. Запустите ComfyUI через Stability Matrix.
2. Проверьте, что ComfyUI доступен по адресу `http://127.0.0.1:8188`.
3. Убедитесь, что workflow SeedVR2 вручную выполняется в ComfyUI.

## Штатная установка

После ручного подтверждения обеих Photoshop-веток упакуйте плагин в `.ccx` через Adobe UXP Developer Tool. Рядом с `.ccx` следует создать BAT-файлы установки и удаления с помощью общего helper-скрипта `write-ccx-installer.ps1`.
