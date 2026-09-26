@echo off
setlocal

fltmc >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator permission...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs -WorkingDirectory 'C:\'"
  exit /b
)

set "UPIA=C:\Program Files\Common Files\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"
set "CCX=%~dp0com.local.photoshop.seedvr2-upscaler_PS.ccx"

if not exist "%UPIA%" (
  echo Adobe UnifiedPluginInstallerAgent was not found.
  echo Install or repair Adobe Creative Cloud Desktop, then try again.
  echo.
  pause
  exit /b 1
)

if not exist "%CCX%" (
  echo Plugin package was not found next to this installer:
  echo %CCX%
  echo.
  pause
  exit /b 1
)

echo Installing SeedVR2 Upscaler...
echo.

pushd C:\
"%UPIA%" /install "%CCX%"
echo.
"%UPIA%" /list all | findstr /i /c:"SeedVR2 Upscaler" >nul
set "PLUGIN_FOUND=%ERRORLEVEL%"
popd

if "%PLUGIN_FOUND%"=="0" (
  echo SeedVR2 Upscaler is installed.
  echo Restart Photoshop, then open Plugins ^> SeedVR2 Upscaler ^> SeedVR2 Upscaler.
) else (
  echo Adobe did not confirm the installation.
  echo Check: C:\ProgramData\Adobe\UPI\Log\Upia.log
)

echo.
pause
exit /b %PLUGIN_FOUND%
