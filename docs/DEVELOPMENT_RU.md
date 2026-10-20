# Разработка И Сборка CCX 0.2.0

## Источник Публикации

Runtime-файлы версии 0.2.0 извлечены из финального CCX автора. Код, manifest, стили и workflow при публикации не менялись. В публикационной копии CCX удалены внутреннее ремонтное задание и PROJECT_STATE; README, инструкция и ручной чек-лист заменены публичными версиями. Остальные записи архива сохранены. Исходный CCX автора не изменён.

## Загрузка

В Adobe UXP Developer Tool выгрузите старый экземпляр через Unload, затем Add Plugin и выберите:

```text
plugin/photoshop-seedvr2-plugin/manifest.json
```

Нажмите Load. После изменений используйте Unload → Load. Геометрию и поля ввода проверяйте в Photoshop: браузерный preview не повторяет UXP полностью.

## Модули

| Файл в src/ | Задача |
| --- | --- |
| main.js | UI, Actions, запуск, маршрутизация результата и recovery |
| settings.js | Настройки .v2, включая tiledEnabled и tileCount |
| tileLayout.js | Сетка, перекрытия, расчёт целевого размера и лимитов |
| tiledUpscale.js | Строго последовательный цикл запросов, отмена и прогресс |
| tileBlending.js | Плавные нормализованные веса и alpha-aware смешивание |
| photoshop.js | Экспорт, native crop/resize, Imaging API, возврат и undo |
| comfyClient.js | Upload, очередь, WebSocket, polling и download |
| workflowMapper.js | Подстановка изображения, цели, seed и проверенных настроек |

Сеть ожидается вне executeAsModal; изменения Photoshop выполняются модально. Original-document guard нельзя отключать ради обхода ошибки вставки.

## Автоматические Проверки

Откройте PowerShell в `plugin/photoshop-seedvr2-plugin`:

```powershell
Get-ChildItem .\src\*.js | ForEach-Object { node --check $_.FullName }
node .\tests\run-tests.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

В проверке публикации прошли исходные assertions и **25 Node-тестов**: геометрия, лимиты, стыки/alpha, последовательность, Stop, ошибки, настройки/Actions, четыре маршрута вывода, guard и recovery. Тесты Imaging API используют модель Photoshop, а не реальное приложение.

## Ручная Проверка

Сценарии: [MANUAL_TEST_RU.md](../plugin/photoshop-seedvr2-plugin/MANUAL_TEST_RU.md). Проверьте установленный CCX в Photoshop: все сетки, размеры, New Window, выделение, Undo, Stop, Actions, прогресс и прокрутку.

Записи автора показывают рабочую панель и один результат 2x/4 части. Они не заменяют полный прогон совместимости на всех версиях Photoshop и видеокартах. Во время публикации Photoshop автоматически не запускался.

## Сборка

1. Пройдите ручную проверку.
2. Укажите новый номер версии в manifest при изменении кода.
3. В UXP Developer Tool выберите Package.
4. Укажите отдельную пустую папку вывода.
5. Сохраните ID `com.local.photoshop.seedvr2-upscaler`.
6. Положите CCX и проверенные BAT-файлы рядом, обновите инструкцию, ZIP и контрольные суммы.
7. Проверьте установку именно собранного CCX вручную.

В релизе нужны CCX и Windows ZIP; исходники GitHub архивирует автоматически. Старый релиз оставляйте для отката. После очистки только документации автоматически проверяется совпадение каждого runtime-файла с оригинальным CCX; установка очищенного пакета в Photoshop требует отдельного ручного smoke-test.

## Что Не Публиковать

Модели, токены, логи, temp, личные пути, ремонтные спецификации и фотографии без разрешения автора. Не меняйте лицензию проекта без решения владельца.
