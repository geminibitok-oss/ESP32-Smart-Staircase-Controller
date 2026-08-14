@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ESP32 Smart Staircase - Firmware Flasher

echo ======================================================
echo    ESP32 Smart Staircase Controller - Firmware Flasher
echo ======================================================
echo.

:: 1. Check or Auto-Download esptool.exe
if exist "%~dp0esptool.exe" goto ESPTOOL_OK

echo [*] esptool.exe not found in this folder.
echo [*] Downloading official esptool.exe for Windows from GitHub...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://github.com/espressif/esptool/releases/download/v4.7.0/esptool-v4.7.0-win64.zip', '%~dp0esptool.zip')"

if exist "%~dp0esptool.zip" (
    echo [*] Unpacking esptool.exe...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%~dp0esptool.zip' -DestinationPath '%~dp0esptool_tmp' -Force"
    if exist "%~dp0esptool_tmp\esptool-win64\esptool.exe" (
        copy /y "%~dp0esptool_tmp\esptool-win64\esptool.exe" "%~dp0esptool.exe" >nul
    ) else (
        for /r "%~dp0esptool_tmp" %%F in (esptool.exe) do copy /y "%%F" "%~dp0esptool.exe" >nul
    )
    rd /s /q "%~dp0esptool_tmp" >nul 2>&1
    del /f /q "%~dp0esptool.zip" >nul 2>&1
)

if not exist "%~dp0esptool.exe" (
    echo [ERROR] Failed to auto-download esptool.exe!
    echo Please download esptool.exe manually from https://github.com/espressif/esptool/releases
    echo and place it into this directory.
    echo.
    pause
    exit /b 1
)

:ESPTOOL_OK
echo [OK] esptool.exe is ready.
echo.

:: 2. Detect firmware binaries
set "FLASH_CMD="

if exist "%~dp0StairsEsp.ino.bootloader.bin" if exist "%~dp0StairsEsp.ino.partitions.bin" if exist "%~dp0StairsEsp.ino.bin" (
    echo [INFO] Arduino CLI package detected (StairsEsp.ino.*)
    set FLASH_CMD=0x1000 "%~dp0StairsEsp.ino.bootloader.bin" 0x8000 "%~dp0StairsEsp.ino.partitions.bin" 0x10000 "%~dp0StairsEsp.ino.bin"
    goto BIN_FOUND
)

if exist "%~dp0bootloader.bin" if exist "%~dp0partitions.bin" if exist "%~dp0firmware.bin" (
    echo [INFO] Full package detected (bootloader + partitions + firmware)
    set FLASH_CMD=0x1000 "%~dp0bootloader.bin" 0x8000 "%~dp0partitions.bin" 0x10000 "%~dp0firmware.bin"
    goto BIN_FOUND
)

if exist "%~dp0firmware.bin" (
    echo [INFO] Standard firmware.bin detected (flashing at offset 0x10000)
    set FLASH_CMD=0x10000 "%~dp0firmware.bin"
    goto BIN_FOUND
)

if exist "%~dp0StairsEsp.ino.bin" (
    echo [INFO] StairsEsp.ino.bin detected (flashing at offset 0x10000)
    set FLASH_CMD=0x10000 "%~dp0StairsEsp.ino.bin"
    goto BIN_FOUND
)

for %%F in ("%~dp0stairs_*.bin") do (
    echo [INFO] Versioned binary detected: %%~nxF
    set FLASH_CMD=0x10000 "%%~fF"
    goto BIN_FOUND
)

echo [ERROR] Firmware .bin files not found in %~dp0!
echo Please compile or download firmware binaries into this folder first.
echo.
pause
exit /b 1

:BIN_FOUND
echo.
echo ======================================================
echo  1. Connect your ESP32 board to PC via USB cable.
echo  2. If the chip fails to connect, hold the BOOT button,
echo     press RESET, release BOOT and try again.
echo ======================================================
echo.
echo Press ANY KEY to begin flashing...
pause >nul

echo.
echo [*] Flashing ESP32 with esptool...
"%~dp0esptool.exe" --chip esp32 --baud 921600 write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_CMD%

if errorlevel 1 (
    echo.
    echo ======================================================
    echo  [ERROR] Flash failed!
    echo.
    echo  Troubleshooting:
    echo  - Hold BOOT button on ESP32, press RESET, release BOOT and rerun.
    echo  - Ensure USB data cable is used (not charge-only cable).
    echo  - Close any open Serial Monitors (VS Code, Arduino IDE, PuTTY).
    echo ======================================================
) else (
    echo.
    echo ======================================================
    echo  [SUCCESS] ESP32 flashed successfully!
    echo  The controller will reboot and start managing your stairs.
    echo ======================================================
)

echo.
pause
