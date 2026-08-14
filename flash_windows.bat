@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ESP32 Smart Staircase - Firmware Flasher & Setup Wizard

echo ======================================================================
echo    🌟 ESP32 Smart Staircase Controller - Flasher & Setup Wizard
echo ======================================================================
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
echo  1. Подключите ESP32 к компьютеру через USB-кабель.
echo  2. Если плата не шьется автоматически, зажмите кнопку
echo     BOOT (IO0), нажмите RESET, отпустите BOOT.
echo ======================================================
echo.
echo Нажмите ЛЮБУЮ КЛАВИШУ для начала прошивки...
pause >nul

echo.
echo [*] Прошивка ESP32 через esptool (921600 baud)...
"%~dp0esptool.exe" --chip esp32 --baud 921600 write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_CMD%

if errorlevel 1 (
    echo.
    echo ======================================================
    echo  ❌ [ОШИБКА] Не удалось прошить ESP32!
    echo.
    echo  Рекомендации:
    echo  - Зажмите кнопку BOOT на ESP32 и запустите файл заново.
    echo  - Убедитесь, что USB-кабель передает данные (DATA), а не только зарядку.
    echo  - Закройте мониторы портов (Arduino IDE, VS Code, PuTTY).
    echo ======================================================
    echo.
    pause
    exit /b 1
)

echo.
echo ======================================================================
echo  ✅ [УСПЕХ] Прошивка ESP32 успешно завершена!
echo ======================================================================
echo.

:: 3. Post-Flash Setup Wizard Menu
:POST_FLASH_MENU
echo Выберите способ настройки параметров (Wi-Fi, ступени, скорость, яркость):
echo.
echo   [1] ⚙️  Быстрая настройка через USB прямо сейчас (Консольный мастер)
echo   [2] 🌐  Открыть Web-интерфейс в браузере (Wi-Fi Точка Доступа 192.168.4.1)
echo   [3] 📟  Открыть Монитор Serial Порта (Live Логи 115200)
echo   [4] 🚪  Выход (ESP32 продолжит работу со стандартными настройками)
echo.
set "CHOICE="
set /p CHOICE="Введите номер пункта (1, 2, 3 или 4) [По умолчанию 1]: "
if "%CHOICE%"=="" set CHOICE=1

if "%CHOICE%"=="1" goto USB_SETUP_WIZARD
if "%CHOICE%"=="2" goto BROWSER_AP_GUIDE
if "%CHOICE%"=="3" goto OPEN_SERIAL_TERMINAL
if "%CHOICE%"=="4" goto EXIT_SCRIPT

echo [!] Неверный выбор, попробуйте еще раз.
goto POST_FLASH_MENU

:: -------------------------------------------------------------
:: Mode 1: USB Configuration Wizard (Sends commands over COM port)
:: -------------------------------------------------------------
:USB_SETUP_WIZARD
echo.
echo ======================================================================
echo  ⚙️  Мастер быстрой настройки параметров через USB
echo ======================================================================
echo.
echo Введите параметры вашей системы (или нажмите ENTER, чтобы пропустить):
echo.

set "CFG_WIFI_SSID="
set /p CFG_WIFI_SSID="1. Имя домашнего Wi-Fi (SSID): "

set "CFG_WIFI_PASS="
if not "%CFG_WIFI_SSID%"=="" (
    set /p CFG_WIFI_PASS="   Пароль от Wi-Fi: "
)

set "CFG_STEPS="
set /p CFG_STEPS="2. Количество ступеней лестницы (1-32) [16]: "

set "CFG_LEDS="
set /p CFG_LEDS="3. Количество LED диодов на 1 ступень (1-60) [30]: "

set "CFG_SPEED="
set /p CFG_SPEED="4. Скорость переключения ступеней в мс (20-250) [60]: "

set "CFG_HOLD="
set /p CFG_HOLD="5. Время свечения после прохода в сек (3-60) [15]: "

set "CFG_BRI="
set /p CFG_BRI="6. Основная яркость подсветки (10-255) [220]: "

set "CFG_SB_MODE="
set /p CFG_SB_MODE="7. Ночной дежурный режим (0=Выкл, 1=Края, 2=Все, 3=Дыхание) [1]: "

set "CFG_SB_BRI="
set /p CFG_SB_BRI="8. Яркость ночного дежурного режима (5-100) [25]: "

set "CFG_COLOR="
set /p CFG_COLOR="9. Цвет подсветки R,G,B (например 255,180,80) [255,180,80]: "

echo.
echo [*] Поиск подключенного COM-порта ESP32...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'SilentlyContinue'; $ports = [System.IO.Ports.SerialPort]::GetPortNames(); if ($ports.Count -eq 0) { Write-Host 'NO_PORT'; exit } $portName = $ports[0]; Write-Host $portName" > "%temp%\esp_port.txt"
set /p DETECTED_PORT=<"%temp%\esp_port.txt"
del /f /q "%temp%\esp_port.txt" >nul 2>&1

if "%DETECTED_PORT%"=="NO_PORT" (
    echo [!] COM-порт не определен автоматически.
    set /p DETECTED_PORT="Укажите номер COM-порта вручную (например COM3): "
)

if "%DETECTED_PORT%"=="" (
    echo [ERROR] Не удалось определить COM-порт.
    goto POST_FLASH_MENU
)

echo [OK] Выбран порт: %DETECTED_PORT%
echo [*] Отправка параметров в энергонезависимую память ESP32 (NVS)...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$portName = '%DETECTED_PORT%';" ^
    "try {" ^
    "  $port = New-Object System.IO.Ports.SerialPort $portName, 115200, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One;" ^
    "  $port.DtrEnable = $false;" ^
    "  $port.RtsEnable = $false;" ^
    "  $port.Open();" ^
    "  Start-Sleep -Milliseconds 800;" ^
    "  if ('%CFG_WIFI_SSID%' -ne '') { $port.WriteLine('WIFI=%CFG_WIFI_SSID%,%CFG_WIFI_PASS%'); Start-Sleep -Milliseconds 200; }" ^
    "  if ('%CFG_STEPS%' -ne '') { $port.WriteLine('STEPS=%CFG_STEPS%'); Start-Sleep -Milliseconds 200; }" ^
    "  if ('%CFG_LEDS%' -ne '') { $port.WriteLine('LEDS=%CFG_LEDS%'); Start-Sleep -Milliseconds 200; }" ^
    "  if ('%CFG_SPEED%' -ne '') { $port.WriteLine('SPEED=%CFG_SPEED%'); Start-Sleep -Milliseconds 200; }" ^
    "  if ('%CFG_HOLD%' -ne '') { $port.WriteLine('HOLD=%CFG_HOLD%'); Start-Sleep -Milliseconds 200; }" ^
    "  if ('%CFG_BRI%' -ne '') { $port.WriteLine('BRI=%CFG_BRI%'); Start-Sleep -Milliseconds 200; }" ^
    "  if ('%CFG_SB_MODE%' -ne '' -or '%CFG_SB_BRI%' -ne '') {" ^
    "    $sbM = if ('%CFG_SB_MODE%' -ne '') { '%CFG_SB_MODE%' } else { '1' };" ^
    "    $sbB = if ('%CFG_SB_BRI%' -ne '') { '%CFG_SB_BRI%' } else { '25' };" ^
    "    $port.WriteLine('STANDBY=' + $sbM + ',' + $sbB); Start-Sleep -Milliseconds 200;" ^
    "  }" ^
    "  if ('%CFG_COLOR%' -ne '') { $port.WriteLine('COLOR=%CFG_COLOR%'); Start-Sleep -Milliseconds 200; }" ^
    "  $port.WriteLine('STATUS');" ^
    "  Start-Sleep -Milliseconds 400;" ^
    "  $port.WriteLine('REBOOT');" ^
    "  Start-Sleep -Milliseconds 500;" ^
    "  $port.Close();" ^
    "  Write-Host 'SUCCESS';" ^
    "} catch {" ^
    "  Write-Host ('ERROR: ' + $_.Exception.Message);" ^
    "}" > "%temp%\esp_cfg_result.txt"

set /p CFG_RESULT=<"%temp%\esp_cfg_result.txt"
del /f /q "%temp%\esp_cfg_result.txt" >nul 2>&1

echo.
if "%CFG_RESULT%"=="SUCCESS" (
    echo ======================================================================
    echo  🎉 [ГОТОВО] Все настройки успешно переданы и сохранены в ESP32!
    echo  Контроллер перезагрузился с вашими новыми параметрами!
    echo ======================================================================
) else (
    echo [!] Предупреждение при записи: %CFG_RESULT%
    echo Настройки можно также задать через Web-интерфейс http://192.168.4.1
)

echo.
echo Хотите открыть Live Serial Монитор логов? (Y/N)
set /p OPEN_MON="[Y/N, по умолчанию Y]: "
if /i "%OPEN_MON%"=="N" goto POST_FLASH_MENU
goto OPEN_SERIAL_TERMINAL

:: -------------------------------------------------------------
:: Mode 2: Web Access Point Guide
:: -------------------------------------------------------------
:BROWSER_AP_GUIDE
echo.
echo ======================================================================
echo  🌐 Настройка через Web-интерфейс в браузере
echo ======================================================================
echo.
echo 1. Откройте список сетей Wi-Fi на вашем смартфоне или ноутбуке.
echo 2. Подключитесь к сети контроллера:
echo       📶 Имя сети:   ESP32-Staircase-Setup
echo       🔑 Пароль:     12345678
echo.
echo 3. Откройте в браузере адрес:
echo       🌐 http://192.168.4.1
echo.
echo В открывшемся Web-интерфейсе вы сможете:
echo  - Настроить Wi-Fi с автоматическим сканером сетей
echo  - Указать количество ступеней и диодов
echo  - Настроить скорость, задержку, яркость и цвет палитрой
echo  - Запустить ручной тест движения вверх/вниз
echo ======================================================================
echo.
start http://192.168.4.1 >nul 2>&1
pause
goto POST_FLASH_MENU

:: -------------------------------------------------------------
:: Mode 3: Open Serial Terminal
:: -------------------------------------------------------------
:OPEN_SERIAL_TERMINAL
if exist "%~dp0terminal.bat" (
    call "%~dp0terminal.bat"
) else (
    echo [*] Запуск встроенного Serial Monitor (115200 baud)...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$ports = [System.IO.Ports.SerialPort]::GetPortNames();" ^
        "if ($ports.Count -eq 0) { Write-Host '[ERROR] COM порт не найден.'; return }" ^
        "$p = $ports[0];" ^
        "Write-Host ('[*] Открытие ' + $p + ' на 115200 baud... Нажмите Ctrl+C для выхода.');" ^
        "$sp = New-Object System.IO.Ports.SerialPort $p, 115200;" ^
        "$sp.Open();" ^
        "while ($true) { if ($sp.BytesToRead -gt 0) { [Console]::Write($sp.ReadExisting()) } Start-Sleep -Milliseconds 20 }"
)
goto POST_FLASH_MENU

:EXIT_SCRIPT
echo.
echo Контроллер умной лестницы готов к работе!
echo Спасибо за использование!
echo.
exit /b 0
