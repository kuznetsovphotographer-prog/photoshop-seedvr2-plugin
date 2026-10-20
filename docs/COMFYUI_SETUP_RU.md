# ComfyUI И Модели SeedVR2 С Нуля

Инструкция для Windows и Photoshop-плагина **SeedVR2 Upscaler 0.2.0**. Ссылки и размеры проверены **20 октября 2026 года**. Новые версии ComfyUI и узлов могут потребовать отдельной проверки совместимости.

**Уже есть рабочий ComfyUI?** Не устанавливайте второй без необходимости. Перейдите к разделу «Установка узлов» и убедитесь, что используете Python именно существующей сборки.

**Нужна помощь агента?** Передайте ему [задание для Codex / OpenCode](AGENT_SETUP_RU.md). Точные файлы, URL, размеры и SHA256 собраны в [машиночитаемом списке](comfyui-setup-manifest.json).

## Что Устанавливается Отдельно

| Компонент | Для чего |
| --- | --- |
| ComfyUI | Локальный сервер обработки |
| ComfyUI-SeedVR2_VideoUpscaler | Узлы SeedVR2 и зависимости |
| Две модели .safetensors | Веса 7B FP16 и VAE |
| CCX плагина | Панель внутри Photoshop |

CCX не устанавливает ComfyUI, Python, CUDA или модели. Для этого плагина не нужны модели Flux, SDXL, CLIP или отдельный checkpoint Stable Diffusion.

Текущий workflow настроен на **NVIDIA CUDA и 7B FP16**. Совместимость самого ComfyUI с AMD, Intel, CPU или macOS не означает, что опубликованный профиль плагина проверен на них. Части уменьшают кадр одного прохода, но не память весов модели.

## 1. Выберите Способ Установки

| Способ | Когда выбирать | Официальная загрузка / инструкция |
| --- | --- | --- |
| **Portable NVIDIA** | Отдельная папка, удобно для ручной настройки и агента | [Portable](https://docs.comfy.org/installation/comfyui_portable_windows) · [Архивы](https://github.com/Comfy-Org/ComfyUI/releases/latest) |
| **Stability Matrix** | Нужен менеджер установки и запуска, как в демонстрации автора | [Загрузка](https://github.com/LykosAI/StabilityMatrix/releases/latest) · [Установка пакетов](https://github.com/LykosAI/StabilityMatrix/blob/main/docs/package-manager/installing-packages.md) |
| **Comfy Desktop** | Предпочитаете установщик и графический launcher | [Загрузка](https://www.comfy.org/download) · [Windows](https://docs.comfy.org/installation/desktop/windows) |
| **Ручная установка** | Уже умеете работать с Python/venv или это делает агент | [Официальное руководство](https://docs.comfy.org/installation/manual_install) |

Не скачивайте неизвестные «сборки со всеми моделями». В этом репозитории **нет собственной готовой сборки ComfyUI**: ниже описана настройка официального дистрибутива.

### Вариант A: Portable NVIDIA

1. На странице [релизов ComfyUI](https://github.com/Comfy-Org/ComfyUI/releases/latest) скачайте **NVIDIA x64 Portable**, подходящий вашей GPU и драйверу. Не выбирайте AMD, Intel или ARM64 по ошибке.
2. Распакуйте .7z через [7-Zip](https://www.7-zip.org/) в отдельную доступную для записи папку, например `D:\AI\ComfyUI_windows_portable`.
3. Запустите `run_nvidia_gpu.bat`. Дождитесь готовности `http://127.0.0.1:8188`; консоль должна оставаться открытой.

Ожидаемая структура:

```text
ComfyUI_windows_portable/
  python_embeded/python.exe
  ComfyUI/main.py
  ComfyUI/custom_nodes/
  ComfyUI/models/
  run_nvidia_gpu.bat
```

Имя `python_embeded` именно такое, с одной d. В релизе v0.42.1 при проверке были стандартный NVIDIA-архив и вариант `nvidia_cu126`; выбирайте по актуальной [официальной инструкции](https://docs.comfy.org/installation/comfyui_portable_windows), а не только по номеру CUDA. Эта инструкция не означает, что v0.42.1 полностью протестирован с плагином.

### Вариант B: Stability Matrix

Скачайте Windows ZIP из [официальных релизов](https://github.com/LykosAI/StabilityMatrix/releases/latest), распакуйте и откройте `StabilityMatrix.exe`. В **Packages → Add Package** выберите **ComfyUI**, подходящий CUDA-backend, затем Install и Launch. Проверьте адрес сервера.

Через меню пакета откройте его папку и найдите Python его окружения, обычно `venv\Scripts\python.exe`. Пути моделей могут быть общими для пакетов; не переносите и не удаляйте существующую библиотеку. Источники: [установка launcher](https://github.com/LykosAI/StabilityMatrix/blob/main/docs/getting-started/installation.md), [управление пакетами](https://github.com/LykosAI/StabilityMatrix/blob/main/docs/package-manager/managing-packages.md).

### Вариант C: Comfy Desktop

Установите приложение с [официальной страницы](https://www.comfy.org/download), выберите **локальную установку**, а не Comfy Cloud. По [руководству Windows](https://docs.comfy.org/installation/desktop/windows) создайте/запустите локальный экземпляр.

Определите реальную папку выбранного экземпляра, его окружение и адрес API. Нельзя считать папку launcher папкой ComfyUI или автоматически предполагать порт 8188. Для этого плагина сервер должен отвечать на `127.0.0.1:8188`; если занят другой порт, сначала разберитесь с существующим сервером. Код плагина ради этого не меняйте.

### Вариант D: Вручную

Используйте [официальный порядок](https://docs.comfy.org/installation/manual_install): Git, отдельное виртуальное окружение, совместимые Python и PyTorch с поддержкой вашей NVIDIA GPU, затем зависимости ComfyUI.

```powershell
# В новой папке, не поверх существующей установки:
git clone https://github.com/Comfy-Org/ComfyUI.git
Set-Location .\ComfyUI
python -m venv .venv
# Сначала установите совместимый CUDA PyTorch в .venv по официальному руководству.
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# После установки узлов и моделей:
.\.venv\Scripts\python.exe main.py --listen 127.0.0.1 --port 8188
```

Системный `python` в примере нужен только для создания venv и должен быть совместимым. Не устанавливайте Torch и зависимости в глобальный Python. Не копируйте случайную nightly-команду CUDA: подбор зависит от GPU, драйвера и версии Python.

## 2. Установка Узлов

Нужен [ComfyUI-SeedVR2_VideoUpscaler от numz](https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler). Если доступен Manager, найдите это точное имя, установите и перезапустите сервер.

Для ручной установки укажите реальные пути. Ниже **пример Portable**, не команда для любой сборки:

```powershell
$ComfyRoot = 'D:\AI\ComfyUI_windows_portable\ComfyUI'
$Python = 'D:\AI\ComfyUI_windows_portable\python_embeded\python.exe'
$NodeRoot = Join-Path $ComfyRoot 'custom_nodes\seedvr2_videoupscaler'
if (-not (Test-Path -LiteralPath $Python)) { throw 'Проверьте путь Python вашей сборки.' }
if (Test-Path -LiteralPath $NodeRoot) { throw 'Узлы уже есть: проверьте их, не клонируйте поверх.' }
git -C $ComfyRoot clone https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler.git custom_nodes/seedvr2_videoupscaler
if ($LASTEXITCODE -ne 0) { throw 'Не удалось скачать узлы.' }
& $Python -m pip install -r (Join-Path $NodeRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Не удалось установить зависимости узлов.' }
& $Python -m pip check
```

Для Stability Matrix, Desktop или ручной установки замените **оба** пути на пути выбранного экземпляра. Затем перезапустите ComfyUI. Для Git-команды нужен [Git](https://git-scm.com/); если его нет, проще использовать Manager.

Источник способа установки и автозагрузки моделей: [руководство узлов](https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler#-installation). При ошибках импорта смотрите первую traceback в консоли. Не переустанавливайте весь Torch вслепую.

## 3. Откуда Скачать Модели

В опубликованном workflow нужны **ровно эти файлы**:

| Файл | Размер | Страница | Прямая загрузка |
| --- | --- | --- | --- |
| `seedvr2_ema_7b_fp16.safetensors` | 16 479 334 424 байта, около 16.5 GB | [DiT 7B FP16](https://huggingface.co/numz/SeedVR2_comfyUI/blob/main/seedvr2_ema_7b_fp16.safetensors) | [Скачать](https://huggingface.co/numz/SeedVR2_comfyUI/resolve/09ced71023636e9bc8cdf9cdecfb2625d1e691e8/seedvr2_ema_7b_fp16.safetensors) |
| `ema_vae_fp16.safetensors` | 501 324 814 байт, около 501 MB | [VAE FP16](https://huggingface.co/numz/SeedVR2_comfyUI/blob/main/ema_vae_fp16.safetensors) | [Скачать](https://huggingface.co/numz/SeedVR2_comfyUI/resolve/09ced71023636e9bc8cdf9cdecfb2625d1e691e8/ema_vae_fp16.safetensors) |

Всего около **17 GB** только для моделей. Дополнительно нужны место для ComfyUI, Python, PyTorch, кеша загрузок и изображений. Не клонируйте целиком Hugging Face-репозиторий: там есть другие крупные варианты, которые этому профилю не нужны.

Разместите **оба файла в одной папке**:

```text
<корень работающего ComfyUI>/models/SEEDVR2/
  seedvr2_ema_7b_fp16.safetensors
  ema_vae_fp16.safetensors
```

VAE здесь кладётся в `SEEDVR2`, а не автоматически в общую `models/vae`. Не переименовывайте FP8, GGUF, 3B или sharp-модель под имя 7B FP16.

Узлы также поддерживают автозагрузку при первом использовании; ручная загрузка заранее позволяет видеть прогресс и проверить файлы. Официальные источники моделей: [numz](https://huggingface.co/numz/SeedVR2_comfyUI/tree/main), [зеркало AInVFX из руководства узлов](https://huggingface.co/AInVFX/SeedVR2_comfyUI). У зеркала сверяйте имя и SHA256.

### Проверка Загрузки

```powershell
$Models = 'D:\AI\ComfyUI_windows_portable\ComfyUI\models\SEEDVR2'
Get-FileHash -LiteralPath (Join-Path $Models 'seedvr2_ema_7b_fp16.safetensors') -Algorithm SHA256
Get-FileHash -LiteralPath (Join-Path $Models 'ema_vae_fp16.safetensors') -Algorithm SHA256
```

Ожидаемые SHA256 взяты со страниц файлов Hugging Face:

```text
7b8241aa957606ab6cfb66edabc96d43234f9819c5392b44d2492d9f0b0bbe4a  seedvr2_ema_7b_fp16.safetensors
20678548f420d98d26f11442d3528f8b8c94e57ee046ef93dbb7633da8612ca1  ema_vae_fp16.safetensors
```

Если файл весит несколько килобайт, вероятно, сохранена HTML-страница или Git LFS pointer вместо весов. При несовпадении хеша не используйте файл как исправный. Прямые ссылки выше закреплены за ревизией Hugging Face, указанной в JSON-списке.

## 4. Проверка До Photoshop

Запустите выбранный ComfyUI. В PowerShell выполните безопасные GET-проверки, **без генерации**:

```powershell
$Base = 'http://127.0.0.1:8188'
Invoke-RestMethod -Uri "$Base/system_stats" -TimeoutSec 15
$Info = Invoke-RestMethod -Uri "$Base/object_info" -TimeoutSec 30
$Required = @('LoadImage','JoinImageWithAlpha','SeedVR2LoadDiTModel','SeedVR2LoadVAEModel','SeedVR2VideoUpscaler','SaveImage')
foreach ($Name in $Required) {
    if ($null -eq $Info.PSObject.Properties[$Name]) { throw "Нет узла: $Name" }
}
$Info.SeedVR2LoadDiTModel.input.required.model[0]
$Info.SeedVR2LoadVAEModel.input.required.model[0]
```

Последние две команды должны показывать списки, в которых доступны нужные модели. Источник API: [официальные маршруты ComfyUI](https://docs.comfy.org/development/comfyui-server/comms_routes).

Это проверяет доступность API и зарегистрированных узлов, **но не доказывает успешную GPU-генерацию**. Для полной проверки выполните один маленький тест: обычный режим, 2x, New Window ON. Либо поручите агенту тест через API по [отдельному заданию](AGENT_SETUP_RU.md).

[JSON workflow](../workflows/workflows-for-comfyui/seedvr2_simple_image_upscale_api.json) предназначен для API. Не все версии редактора импортируют его как визуальную схему. В LoadImage записано примерное имя: плагин/агент должен загрузить свою картинку и подставить возвращённое сервером имя. Drag-and-drop JSON сам по себе не проверка.

## 5. Что Может Помешать

| Симптом | Что проверить |
| --- | --- |
| Страница открывается, а плагин не подключается | API именно на 127.0.0.1:8188; не Cloud и не другой экземпляр |
| Нет SeedVR2 в object_info | Установлены ли зависимости в Python этого экземпляра; ошибки импорта; перезапуск |
| Модель не видна | Точные имена, SEEDVR2, полная загрузка, правильный экземпляр сервера |
| Torch не видит CUDA | GPU, драйвер, CUDA-сборка PyTorch выбранного окружения |
| Out of memory | 7B FP16 может не помещаться; 4/6 частей не уменьшают веса модели |
| Нет Python-wheel для зависимости | Совместимость Python/пакетов; не чинить установкой случайного nightly Torch |
| Порт 8188 занят | Сначала определить процесс; не завершать чужую работу и не запускать сервер поверх |

Не открывайте сервер в интернет и не добавляйте `--listen 0.0.0.0` ради Photoshop: localhost достаточно. Используйте официальные источники; custom nodes исполняют код на компьютере. Успешную конфигурацию сохраняйте, а обновления ComfyUI/узлов проверяйте отдельно.

Далее: [установка панели Photoshop](INSTALLATION_RU.md) · [ошибки и решения](TROUBLESHOOTING_RU.md).
