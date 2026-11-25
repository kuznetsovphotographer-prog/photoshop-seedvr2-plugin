# SeedVR2 Upscaler v0.2.5

Теперь для апскейла не обязательно сначала открывать Stability Matrix. Один раз укажите путь к ComfyUI, и плагин сам запустит сервер при нажатии **Upscale** или **Preload**. Если ComfyUI уже работает, плагин подключится к нему.

В панели появились две кнопки для памяти. **Preload** заранее прогревает SeedVR2 7B и VAE на служебном кадре. **Unload** очищает кэш и просит ComfyUI освободить память, не закрывая сервер.

Модель осталась одна: **SeedVR2 7B FP16**. Размеры **2×, 3×, 4×**, цель по короткой стороне, деление на **2, 4 или 6 частей** и Photoshop Actions остались на месте.

Скачайте **SeedVR2-Upscaler-v0.2.5-Windows.zip**, распакуйте его целиком, закройте Photoshop и запустите `INSTALL_SEEDVR2_UPSCALER.bat`. В архиве также есть CCX и BAT для удаления. ComfyUI и веса в комплект не входят.

[Установка и настройка автозапуска](https://github.com/kuznetsovphotographer-prog/photoshop-seedvr2-plugin/blob/v0.2.5/docs/INSTALLATION_RU.md) · [Подготовка ComfyUI и моделей](https://github.com/kuznetsovphotographer-prog/photoshop-seedvr2-plugin/blob/v0.2.5/docs/COMFYUI_SETUP_RU.md)
