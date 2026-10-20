# SeedVR2 Upscaler 0.2.0 для Windows

В этом комплекте: CCX, установщик, удаление и API workflow. Модели и ComfyUI скачиваются отдельно.

## Установка

1. Полностью распакуйте ZIP в обычную папку.
2. Оставьте CCX и оба BAT-файла рядом.
3. Если использовали UXP Developer Tool, сделайте Unload прежнего экземпляра.
4. Закройте Photoshop.
5. Запустите INSTALL_SEEDVR2_UPSCALER.bat, подтвердите права Windows и приглашение в консоли.
6. Дождитесь сообщения об успешной установке, затем запустите Photoshop.
7. Откройте Plugins -> SeedVR2 Upscaler -> SeedVR2 Upscaler.

Нужен Adobe Creative Cloud Desktop. Можно также открыть CCX двойным щелчком. При обновлении сохраняется тот же plugin ID.

## Перед Первой Генерацией

Запустите локальный ComfyUI на http://127.0.0.1:8188, установите узлы ComfyUI-SeedVR2_VideoUpscaler и модели seedvr2_ema_7b_fp16.safetensors / ema_vae_fp16.safetensors. Сначала проверьте узлы в самом ComfyUI.

Приложенный JSON: API-шаблон, не универсальная схема редактора. LoadImage содержит пример имени; плагин заменяет его автоматически.

Photoshop 24.0+: обычный режим. 24.4+ с Imaging API: Tiled Upscale. 25.0+: Actions. Профиль 7B FP16 тяжёлый; части уменьшают размер одного запроса, но не память весов модели.

## Обработка По Частям

Выберите 2x/3x/4x либо Shortest Side Limit, настройте New Window, включите Tiled Upscale и выберите 2/4/6 parts. Части обрабатываются по очереди и собираются с перекрытиями.

2500 px ограничивает короткую сторону части, а не всю сборку. Точный итоговый размер виден под кнопками. При выделении + New Window OFF результат возвращается в старые bounds, без увеличения исходного холста.

Не меняйте исходник во время обработки. При ошибке финальной вставки Open Last Result открывает готовый PNG новым документом в текущем сеансе плагина.

## Удаление

Закройте Photoshop и запустите UNINSTALL_SEEDVR2_UPSCALER.bat. ComfyUI и модели не удаляются.

Полное руководство и GIF:
https://github.com/kuznetsovphotographer-prog/photoshop-seedvr2-plugin
