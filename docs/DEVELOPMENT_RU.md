# Разработка и сборка CCX

## Загрузка исходников

В Adobe UXP Developer Tool выберите:

```text
plugin/photoshop-seedvr2-plugin/manifest.json
```

После изменений используйте `Reload` или `Unload -> Load`. Точное выравнивание элементов проверяйте в реальной панели Photoshop: браузерное превью UXP не повторяет полностью.

## Проверка кода

Откройте PowerShell в:

```text
plugin/photoshop-seedvr2-plugin
```

Выполните:

```powershell
node --check .\src\main.js
node --check .\src\photoshop.js
node --check .\src\settings.js
node --check .\src\workflowMapper.js
node .\tests\run-tests.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

## Сборка CCX

1. Проверьте оба режима вывода, выделение, Undo, Stop и Actions в Photoshop.
2. Увеличьте `version` в `manifest.json`.
3. В UXP Developer Tool выберите плагин и команду Package.
4. Укажите отдельную пустую папку для результата.
5. Переименовывать plugin ID нельзя: обновления должны сохранять `com.local.photoshop.seedvr2-upscaler`.
6. Положите новый CCX в `ccx/` под именем:

```text
com.local.photoshop.seedvr2-upscaler_PS.ccx
```

7. Запустите BAT-установщик и проведите smoke-test установленной сборки, а не только Load-версии.

## Что не включать в публикацию

- временные логи;
- папку `tmp`;
- переписку с моделями и ремонтные спецификации;
- локальные абсолютные пути;
- модели SeedVR2;
- тестовые исходные фотографии без права на публикацию.

## Проверка релиза

- CCX содержит ту же версию, что исходный manifest;
- CCX включает запись Photoshop Actions;
- BAT устанавливает и удаляет плагин;
- workflow выполняется вручную;
- README-ссылки открываются;
- GIF и изображения отображаются на GitHub;
- размер репозитория остается разумным.

