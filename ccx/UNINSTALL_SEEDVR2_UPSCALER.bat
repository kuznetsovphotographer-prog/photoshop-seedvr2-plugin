@echo off
setlocal

fltmc >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator permission...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs -WorkingDirectory 'C:\'"
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

echo Removing SeedVR2 Upscaler...
echo.

pushd C:\
"%UPIA%" /remove "SeedVR2 Upscaler"
echo.
"%UPIA%" /list all | findstr /i /c:"SeedVR2 Upscaler" >nul
set "PLUGIN_FOUND=%ERRORLEVEL%"
popd

if "%PLUGIN_FOUND%"=="0" (
  echo Adobe still reports SeedVR2 Upscaler as installed.
  echo Check: C:\ProgramData\Adobe\UPI\Log\Upia.log
  echo Check: C:\ProgramData\Adobe\UPI\Log\EMCL.log
) else (
  echo SeedVR2 Upscaler is removed.
  echo Restart Photoshop if it was open.
)

echo.
pause
exit /b %PLUGIN_FOUND%
