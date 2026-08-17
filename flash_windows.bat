@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ESP32 Smart Staircase - Firmware Flasher and Setup Wizard

:: Repository configuration
set "GH_USER=geminibitok-oss"
set "GH_REPO=ESP32-Smart-Staircase-Controller"
set "CURRENT_VER=1.0.13"

:MAIN_MENU
cls
echo ======================================================================
echo    🌟 ESP32 Smart Staircase Controller - Firmware Flasher
echo ======================================================================
echo.
echo Репозиторий: %GH_USER%/%GH_REPO% (Текущая версия: v%CURRENT_VER%)
echo.
echo Выберите действие:
echo.
echo   [1] ⚡ Прошить текущую локальную версию (Автоопределение файлов в папке)
echo   [2] 📁 Выбрать локальный .bin файл на компьютере (Вручную / Выбор файла)
echo   [3] 🌐 Выбрать и скачать версию прошивки из GitHub Releases
echo   [4] 🧹 ПОЛНАЯ ОЧИСТКА ПАМЯТИ ESP32 (Erase Flash - стирает старый зависший WiFiManager)
echo   [5] 📶 Беспроводное OTA-обновление по Wi-Fi (без USB кабеля)
echo   [6] 📶 НАСТРОЙКА ТОЛЬКО WI-FI (SSID и пароль через USB за 5 секунд)
echo   [7] ⚙️  Полный мастер настройки параметров (LED, Пины, Яркость, Ступени)
echo   [8] 📟 Открыть Монитор Serial Порта (Live Логи 115200 бод)
echo   [9] 🚪 Выход
echo.
set "MENU_CHOICE="
set /p MENU_CHOICE="Введите номер пункта (1-9) [По умолчанию 1]: "
if "%MENU_CHOICE%"=="" set MENU_CHOICE=1

if "%MENU_CHOICE%"=="1" goto FLASH_LOCAL_AUTO
if "%MENU_CHOICE%"=="2" goto FLASH_LOCAL_MANUAL
if "%MENU_CHOICE%"=="3" goto GITHUB_RELEASE_PICKER
if "%MENU_CHOICE%"=="4" goto FULL_ERASE_MENU
if "%MENU_CHOICE%"=="5" goto OTA_WIFI_UPDATE
if "%MENU_CHOICE%"=="6" goto USB_WIFI_ONLY
if "%MENU_CHOICE%"=="7" goto USB_SETUP_WIZARD
if "%MENU_CHOICE%"=="8" goto OPEN_SERIAL_TERMINAL
if "%MENU_CHOICE%"=="9" goto EXIT_SCRIPT

echo [!] Неверный ввод. Пожалуйста, введите цифру от 1 до 9.
timeout /t 2 >nul
goto MAIN_MENU

:: -------------------------------------------------------------
:: Mode 1: Auto-detect local binary files and flash
:: -------------------------------------------------------------
:FLASH_LOCAL_AUTO
cls
echo ======================================================================
echo  ⚡ [Режим 1] Автопоиск и прошивка локальных файлов
echo ======================================================================
echo.
call :ENSURE_ESPTOOL

set "FLASH_CMD="
if exist "%~dp0StairsEsp.ino.bootloader.bin" if exist "%~dp0StairsEsp.ino.partitions.bin" if exist "%~dp0StairsEsp.ino.bin" (
    echo [INFO] Найден полный комплект Arduino CLI (Bootloader + Partitions + App)
    set "FLASH_CMD=0x1000 \"%~dp0StairsEsp.ino.bootloader.bin\" 0x8000 \"%~dp0StairsEsp.ino.partitions.bin\" 0x10000 \"%~dp0StairsEsp.ino.bin\""
) else if exist "%~dp0firmware.bin" (
    echo [INFO] Найден файл: firmware.bin
    set "FLASH_CMD=0x10000 \"%~dp0firmware.bin\""
) else if exist "%~dp0firmware_merged.bin" (
    echo [INFO] Найден объединенный файл: firmware_merged.bin
    set "FLASH_CMD=0x0 \"%~dp0firmware_merged.bin\""
) else if exist "%~dp0StairsEsp.ino.bin" (
    echo [INFO] Найден файл: StairsEsp.ino.bin
    set "FLASH_CMD=0x10000 \"%~dp0StairsEsp.ino.bin\""
) else (
    for %%F in ("%~dp0*.bin") do (
        echo [INFO] Найден файл прошивки: %%~nxF
        set "FLASH_CMD=0x10000 \"%%F\""
        goto :FOUND_BIN
    )
)

:FOUND_BIN
if "%FLASH_CMD%"=="" (
    echo [ERROR] В текущей папке не найдено ни одного .bin файла прошивки!
    echo Пожалуйста, поместите firmware.bin рядом с этим скриптом или используйте Режим 2 или 3.
    echo.
    pause
    goto MAIN_MENU
)

echo.
echo [*] Поиск подключенного COM-порта ESP32...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object); if ($ports.Count -eq 0) { [System.IO.File]::WriteAllText('%temp%\esp_port.txt', 'NO_PORT'); exit } $usbPorts = @($ports | Where-Object { $_ -ne 'COM1' }); $portName = if ($usbPorts.Count -gt 0) { $usbPorts[0] } else { $ports[0] }; [System.IO.File]::WriteAllText('%temp%\esp_port.txt', $portName)"
set /p DETECTED_PORT=<"%temp%\esp_port.txt"
del /f /q "%temp%\esp_port.txt" >nul 2>&1

if "%DETECTED_PORT%"=="NO_PORT" (
    echo [!] COM-порт не определен автоматически.
    set /p DETECTED_PORT="Укажите номер COM-порта вручную (например COM3): "
)
if "%DETECTED_PORT%"=="" (
    echo [ERROR] Не удалось определить COM-порт.
    pause
    goto MAIN_MENU
)

echo [OK] Выбран порт: %DETECTED_PORT%
echo.
echo [*] Запуск прошивки ESP32 через esptool на скорости 921600 бод...
%ESPTOOL_PATH% --chip esp32 --port %DETECTED_PORT% --baud 921600 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_CMD%

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo  🎉 [УСПЕХ] Прошивка успешно загружена в ESP32!
    echo ======================================================================
    goto POST_FLASH_MENU
) else (
    echo.
    echo [!] Ошибка прошивки на скорости 921600 бод. Повтор на безопасной скорости 115200...
    %ESPTOOL_PATH% --chip esp32 --port %DETECTED_PORT% --baud 115200 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_CMD%
    if %ERRORLEVEL% equ 0 (
        echo.
        echo ======================================================================
        echo  🎉 [УСПЕХ] Прошивка успешно загружена в ESP32!
        echo ======================================================================
        goto POST_FLASH_MENU
    ) else (
        echo.
        echo [ERROR] Не удалось прошить ESP32. Проверьте подключение кабеля и правильность COM-порта.
        pause
        goto MAIN_MENU
    )
)

:FULL_ERASE_MENU
cls
echo ======================================================================
echo  🧹 [Режим 4] Полная очистка Flash памяти ESP32
echo ======================================================================
echo.
echo Это полностью сотрет старый зависший WiFiManager и поврежденные настройки.
echo.
call :ENSURE_ESPTOOL

echo [*] Поиск подключенного COM-порта ESP32...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object); if ($ports.Count -eq 0) { [System.IO.File]::WriteAllText('%temp%\esp_port.txt', 'NO_PORT'); exit } $usbPorts = @($ports | Where-Object { $_ -ne 'COM1' }); $portName = if ($usbPorts.Count -gt 0) { $usbPorts[0] } else { $ports[0] }; [System.IO.File]::WriteAllText('%temp%\esp_port.txt', $portName)"
set /p DETECTED_PORT=<"%temp%\esp_port.txt"
del /f /q "%temp%\esp_port.txt" >nul 2>&1

if "%DETECTED_PORT%"=="NO_PORT" (
    echo [!] COM-порт не определен автоматически.
    set /p DETECTED_PORT="Укажите номер COM-порта вручную (например COM12): "
)
if "%DETECTED_PORT%"=="" (
    echo [ERROR] Не удалось определить COM-порт.
    pause
    goto MAIN_MENU
)

echo [OK] Порт: %DETECTED_PORT%
echo [*] Полная очистка Flash памяти ESP32...
%ESPTOOL_PATH% --chip esp32 --port %DETECTED_PORT% --baud 921600 erase_flash
echo.
echo [OK] Память полностью очищена! Теперь можно прошить чистую версию (Пункт 1).
pause
goto MAIN_MENU

:ENSURE_ESPTOOL
set "ESPTOOL_PATH=%~dp0tools\esptool.exe"
if exist "%ESPTOOL_PATH%" exit /b 0
if exist "%~dp0esptool.exe" (
    set "ESPTOOL_PATH=%~dp0esptool.exe"
    exit /b 0
)
if not exist "%~dp0tools" mkdir "%~dp0tools"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://raw.githubusercontent.com/espressif/esptool/master/esptool.py', '%~dp0tools\esptool.py')" 2>nul
set "ESPTOOL_PATH=python %~dp0tools\esptool.py"
exit /b 0

:POST_FLASH_MENU
echo.
echo Выберите следующее действие:
echo   [1] 📶 Настроить Wi-Fi прямо сейчас через USB (Рекомендуется)
echo   [2] 📟 Открыть монитор Serial порта (Посмотреть IP)
echo   [3] 🔙 Главное меню
echo.
set /p NEXT_ACTION="Ваш выбор (1-3) [По умолчанию 1]: "
if "%NEXT_ACTION%"=="" set NEXT_ACTION=1
if "%NEXT_ACTION%"=="1" goto USB_WIFI_ONLY
if "%NEXT_ACTION%"=="2" goto OPEN_SERIAL_TERMINAL
goto MAIN_MENU

:USB_WIFI_ONLY
cls
echo ======================================================================
echo  📶 [Режим 6] Быстрая настройка Wi-Fi через USB (за 5 секунд)
echo ======================================================================
echo.
set /p WIFI_SSID="1. Имя домашнего Wi-Fi (SSID): "
set /p WIFI_PASS="2. Пароль от Wi-Fi: "
echo.
echo [*] Запись Wi-Fi в память ESP32...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$port = new-Object System.IO.Ports.SerialPort '%DETECTED_PORT%', 115200, None, 8, one; $port.Open(); Start-Sleep -Milliseconds 500; $port.WriteLine('SET:wifi_ssid=%WIFI_SSID%'); Start-Sleep -Milliseconds 200; $port.WriteLine('SET:wifi_pass=%WIFI_PASS%'); Start-Sleep -Milliseconds 200; $port.WriteLine('SAVE'); Start-Sleep -Milliseconds 500; $port.Close();"
echo [OK] Настройки сохранены! Плата подключается к '%WIFI_SSID%'.
pause
goto MAIN_MENU

:OPEN_SERIAL_TERMINAL
cls
echo [INFO] Подключение к монитору порта %DETECTED_PORT% (115200)... Для выхода нажмите Ctrl+C
powershell -NoProfile -ExecutionPolicy Bypass -Command "$port = new-Object System.IO.Ports.SerialPort '%DETECTED_PORT%', 115200, None, 8, one; $port.Open(); while($true){ if($port.BytesToRead -gt 0){ Write-Host -NoNewline $port.ReadExisting() } Start-Sleep -Milliseconds 50 }"
goto MAIN_MENU

:EXIT_SCRIPT
exit /b 0