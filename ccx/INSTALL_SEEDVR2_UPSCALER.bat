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
  echo "%CCX%"
  echo.
  pause
  exit /b 1
)

echo SeedVR2 Upscaler 0.2.0
echo Close Photoshop and unload any development copy in UXP Developer Tool first.
echo This installs or updates the installed SeedVR2 Upscaler plugin.
echo.
pause

pushd C:\
if errorlevel 1 exit /b 1
"%UPIA%" /install "%CCX%"
set "INSTALL_RESULT=%ERRORLEVEL%"
echo.
"%UPIA%" /list all | findstr /i /c:"SeedVR2 Upscaler" >nul
set "PLUGIN_FOUND=%ERRORLEVEL%"
popd

if not "%INSTALL_RESULT%"=="0" goto install_failed
if not "%PLUGIN_FOUND%"=="0" goto install_failed

echo SeedVR2 Upscaler 0.2.0 package installed successfully.
echo Restart Photoshop, then open Plugins ^> SeedVR2 Upscaler ^> SeedVR2 Upscaler.
echo.
pause
exit /b 0

:install_failed
echo Adobe did not confirm the installation. Installer exit code: %INSTALL_RESULT%
echo Check: C:\ProgramData\Adobe\UPI\Log\Upia.log
echo Check: C:\ProgramData\Adobe\UPI\Log\EMCL.log
echo.
pause
exit /b 1
