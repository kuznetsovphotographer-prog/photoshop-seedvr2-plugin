@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
set "SEEDVR2_COMFYUI_DIR="
set "SEEDVR2_DATA=%LOCALAPPDATA%\SeedVR2Upscaler"
if exist "%SEEDVR2_DATA%\comfyui-path.txt" set /p "SEEDVR2_COMFYUI_DIR="<"%SEEDVR2_DATA%\comfyui-path.txt"
if not defined SEEDVR2_COMFYUI_DIR goto missing
set "PYW=%SEEDVR2_COMFYUI_DIR%\venv\Scripts\pythonw.exe"
if not exist "%PYW%" goto missing
start "" /b "%PYW%" "%~dp0start-comfy.py"
exit /b %errorlevel%

:missing
if not exist "%SEEDVR2_DATA%" mkdir "%SEEDVR2_DATA%"
>>"%SEEDVR2_DATA%\comfy-launch.log" echo SeedVR2: Set the ComfyUI folder in %%LOCALAPPDATA%%\SeedVR2Upscaler\comfyui-path.txt.
exit /b 1
