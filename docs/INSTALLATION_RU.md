# Установка SeedVR2 Upscaler

## 1. Что понадобится

- Windows;
- Adobe Photoshop 24.0+;
- Adobe Creative Cloud Desktop;
- локальный ComfyUI;
- NVIDIA GPU с CUDA;
- свободное место для моделей SeedVR2.

Для Photoshop Actions нужен Photoshop 25.0 или новее.

## 2. Подготовьте ComfyUI

Плагин обращается к локальному серверу:

```text
http://127.0.0.1:8188
```

Установите `ComfyUI-SeedVR2_VideoUpscaler` через ComfyUI Manager:

1. Откройте `Manager`.
2. Выберите `Custom Nodes Manager`.
3. Найдите `ComfyUI-SeedVR2_VideoUpscaler`.
4. Установите узлы и перезапустите ComfyUI.

Официальный репозиторий узлов:

```text
https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler
```

Ручная установка, если Manager недоступен:

```powershell
cd <папка-ComfyUI>
git clone https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler.git custom_nodes/seedvr2_videoupscaler
```

После клонирования установите зависимости способом, соответствующим вашей сборке ComfyUI, и перезапустите ComfyUI.

## 3. Проверьте workflow до установки плагина

Откройте в ComfyUI:

```text
workflows/workflows-for-comfyui/seedvr2_simple_image_upscale_api.json
```

Workflow использует:

```text
seedvr2_ema_7b_fp16.safetensors
ema_vae_fp16.safetensors
```

На первом запуске официальные узлы могут скачать модели автоматически в `ComfyUI/models/SEEDVR2`. Дождитесь завершения и выполните workflow вручную на небольшой тестовой фотографии.

Установка Photoshop-панели имеет смысл только после успешного ручного запуска workflow.

## 4. Установите CCX

Закройте Photoshop.

### Рекомендуемый способ

Убедитесь, что в одной папке лежат:

```text
com.local.photoshop.seedvr2-upscaler_PS.ccx
INSTALL_SEEDVR2_UPSCALER.bat
```

Запустите:

```text
ccx/INSTALL_SEEDVR2_UPSCALER.bat
```

Разрешите запрос контроля учетных записей Windows. После сообщения `SeedVR2 Upscaler is installed` перезапустите Photoshop.

### Установка двойным щелчком

Можно дважды щелкнуть по:

```text
ccx/com.local.photoshop.seedvr2-upscaler_PS.ccx
```

Подтвердите установку в Creative Cloud Desktop. Если плагин не появился, используйте BAT-файл.

## 5. Откройте панель

В Photoshop выберите:

```text
Plugins -> SeedVR2 Upscaler -> SeedVR2 Upscaler
```

Запустите ComfyUI, откройте фотографию и выполните первый тест в режиме `2x` на небольшом изображении.

## 6. Ручная загрузка через UXP Developer Tool

Этот способ нужен разработчикам или при проверке исходников.

1. Запустите Photoshop и Adobe UXP Developer Tool.
2. Нажмите `Add Plugin`.
3. Выберите:

```text
plugin/photoshop-seedvr2-plugin/manifest.json
```

4. Нажмите `Load`.
5. Откройте панель через меню `Plugins` в Photoshop.

После изменения исходников используйте `Reload` или `Unload -> Load`.

## 7. Обновление

Закройте Photoshop и запустите установщик новой версии поверх старой. Если Adobe не заменил пакет:

1. Запустите `UNINSTALL_SEEDVR2_UPSCALER.bat`.
2. Запустите `INSTALL_SEEDVR2_UPSCALER.bat`.
3. Перезапустите Photoshop.

## 8. Удаление

Закройте Photoshop и запустите:

```text
ccx/UNINSTALL_SEEDVR2_UPSCALER.bat
```

## 9. Проверка после установки

- панель открывается без ошибок;
- ComfyUI отвечает на `127.0.0.1:8188`;
- `2x` запускает обработку;
- нижняя синяя полоса показывает прогресс;
- `Stop` останавливает очередь;
- `New Window ON` открывает результат отдельным документом;
- `New Window OFF` возвращает результат в текущий документ.

Если что-то не работает, откройте [TROUBLESHOOTING_RU.md](TROUBLESHOOTING_RU.md).

