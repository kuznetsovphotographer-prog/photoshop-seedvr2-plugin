@echo off
setlocal

set "SEEDVR2_BAT=%~f0"
fltmc >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator permission...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath $env:SEEDVR2_BAT -Verb RunAs -WorkingDirectory 'C:\'"
  exit /b
)

set "UPIA=C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"

if not exist "%UPIA%" (
  echo Adobe UnifiedPluginInstallerAgent was not found.
  echo Install or repair Adobe Creative Cloud Desktop, then try again.
  echo.
  pause
  exit /b 1
)

echo Removing the installed SeedVR2 Upscaler plugin.
echo Close Photoshop and unload any development copy in UXP Developer Tool first.
echo Source folders and CCX packages will not be removed.
echo.
pause

pushd C:\
if errorlevel 1 exit /b 1
"%UPIA%" /remove "SeedVR2 Upscaler"
set "REMOVE_RESULT=%ERRORLEVEL%"
echo.
"%UPIA%" /list all | findstr /i /c:"SeedVR2 Upscaler" >nul
set "PLUGIN_FOUND=%ERRORLEVEL%"
popd

if not "%REMOVE_RESULT%"=="0" goto remove_failed
if "%PLUGIN_FOUND%"=="0" goto remove_failed

echo SeedVR2 Upscaler is removed.
echo Restart Photoshop if it was open.
echo.
pause
exit /b 0

:remove_failed
echo Adobe did not confirm removal. Installer exit code: %REMOVE_RESULT%
echo Check: C:\ProgramData\Adobe\UPI\Log\Upia.log
echo Check: C:\ProgramData\Adobe\UPI\Log\EMCL.log
echo.
pause
exit /b 1
