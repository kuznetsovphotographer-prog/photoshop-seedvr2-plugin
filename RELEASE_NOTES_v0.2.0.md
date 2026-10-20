# SeedVR2 Upscaler v0.2.0

Sequential tiled upscaling for Adobe Photoshop, powered by local ComfyUI and SeedVR2.

## Новое

- **Tiled Upscale:** 2, 4 или 6 перекрывающихся частей, обработка строго по очереди и сборка одного PNG.
- Плавное смешивание стыков с учётом прозрачности; общий seed для частей.
- Предел **2500 px по короткой стороне части**, а не собранной картинки. Итог может достигать 4K и выше в зависимости от исходника и настроек.
- Поддержка целого документа и рамки выделения, все четыре сочетания New Window ON/OFF.
- Общий прогресс с этапами Part, Stitching и Applying; Stop не запускает оставшиеся части.
- Настройки tiled-режима сохраняются и записываются в Photoshop Actions. Старые экшены совместимы.
- **Open Last Result:** при ошибке возврата можно открыть уже собранный PNG новым документом без повторной генерации, пока сеанс плагина не закрыт.
- Новые GIF установки, запуска, настроек и сравнения; обновлённое руководство.

## Пример Из Демонстрации

**1800 × 2417 → 3600 × 4834 px**, режим **2x**, **4 части**. Ширина и высота удвоены; число частей не является дополнительным множителем.

Меньшие последовательные фрагменты могут снизить пиковый расход VRAM для кадра. Требования к памяти весов модели сохраняются: workflow по-прежнему использует 7B FP16. Работа на любой малой GPU, ускорение и полностью невидимые стыки не гарантируются.

## Скачать И Обновить

Скачайте **SeedVR2-Upscaler-v0.2.0-Windows.zip**, полностью распакуйте, закройте Photoshop и запустите **INSTALL_SEEDVR2_UPSCALER.bat**. CCX должен оставаться рядом с BAT. Для установки нужен Adobe Creative Cloud Desktop.

Plugin ID сохранён; пакет обновляет прежний SeedVR2 Upscaler. Developer Tool-копию перед установкой нужно выгрузить через Unload. Версия 0.1.1 остаётся в предыдущих релизах.

Обычный режим: Photoshop 24.0+. Tiled: Photoshop 24.4+ с Imaging API. Actions: Photoshop 25.0+. Нужны отдельно установленные ComfyUI, узлы и модели SeedVR2.

## Ограничения

Сборка tiled-результата: sRGB, 8 bit RGBA. SeedVR2 может менять детали и оттенки в соседних частях. Не редактируйте исходник во время обработки; перед возвратом проверяются его размеры и история.

[Установка](https://github.com/kuznetsovphotographer-prog/photoshop-seedvr2-plugin/blob/main/docs/INSTALLATION_RU.md) · [GIF-демонстрации](https://github.com/kuznetsovphotographer-prog/photoshop-seedvr2-plugin/blob/main/docs/DEMONSTRATIONS_RU.md) · [Руководство](https://github.com/kuznetsovphotographer-prog/photoshop-seedvr2-plugin/blob/main/docs/USAGE_RU.md)
