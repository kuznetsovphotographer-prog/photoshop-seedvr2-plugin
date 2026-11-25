@echo off
setlocal DisableDelayedExpansion

set "SEEDVR2_BAT=%~f0"
fltmc >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator permission...
  powershell -NoProfile -Command "try { Start-Process -FilePath $env:SEEDVR2_BAT -Verb RunAs -WorkingDirectory ($env:SystemDrive + '\') -ErrorAction Stop } catch { Write-Error $_; exit 1 }"
  if errorlevel 1 exit /b 1
  exit /b 0
)

set "ADOBE_COMMON=%CommonProgramFiles%"
if defined CommonProgramW6432 set "ADOBE_COMMON=%CommonProgramW6432%"
set "UPIA=%ADOBE_COMMON%\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"

if not exist "%UPIA%" (
  echo Adobe UnifiedPluginInstallerAgent was not found.
  echo Install or repair Adobe Creative Cloud Desktop, then try again.
  echo.
  pause
  exit /b 1
)

echo Removing SeedVR2 Upscaler...
echo.

pushd "%SystemDrive%\" || exit /b 1
"%UPIA%" /remove "SeedVR2 Upscaler"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" "%UPIA%" /list all
popd

if "%RC%"=="0" (
  echo Adobe reports successful removal of SeedVR2 Upscaler.
  echo Restart Photoshop if it was open.
) else (
  echo Adobe removal failed with exit code %RC%.
  echo If this copy was loaded in UXP Developer Tool, unload it there instead.
  echo Check: "%ProgramData%\Adobe\UPI\Log\Upia.log"
  echo Check: "%ProgramData%\Adobe\UPI\Log\EMCL.log"
)

echo.
pause
exit /b %RC%
