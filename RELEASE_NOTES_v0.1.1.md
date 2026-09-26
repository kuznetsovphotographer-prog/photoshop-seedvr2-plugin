# SeedVR2 Upscaler v0.1.1

## Основные возможности

- апскейл всего документа в текущем или новом окне;
- локальная обработка выделенной области;
- возврат выделения новым слоем в исходные границы;
- режимы `2x`, `3x`, `4x` и точная короткая сторона;
- автоматический предел `2500 px` по короткой стороне;
- переключатель `New Window`;
- WebSocket-прогресс ComfyUI с polling fallback;
- остановка активной генерации;
- запись запуска как шага `SeedVR2 Upscale` в Photoshop Actions;
- BAT-установка и удаление через официальный Adobe UPIA.

## Workflow

- SeedVR2 7B FP16;
- LAB color correction;
- VAE encode/decode tiling `1024`, overlap `128`;
- `uniform_batch_size: true`;
- `batch_size: 1`;
- alpha-цепочка через `JoinImageWithAlpha`;
- без Torch Compile.

## Совместимость

- Photoshop 24.0+ для панели;
- Photoshop 25.0+ для Actions;
- локальный ComfyUI на `127.0.0.1:8188`.

