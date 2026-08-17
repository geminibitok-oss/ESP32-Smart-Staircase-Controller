@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ESP32 Smart Staircase - Firmware Flasher and Setup Wizard

:: ======================================================================
:: ESP32 Smart Staircase Controller - Firmware Flasher & Setup Wizard
:: ======================================================================

set "GH_USER=geminibitok-oss"
set "GH_REPO=ESP32-Smart-Staircase-Controller"
set "CURRENT_VER=1.0.14"

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
    echo [INFO] Найден полный комплект Arduino CLI
    set FLASH_CMD=0x1000 "%~dp0StairsEsp.ino.bootloader.bin" 0x8000 "%~dp0StairsEsp.ino.partitions.bin" 0x10000 "%~dp0StairsEsp.ino.bin"
    goto :FOUND_BIN
)

if exist "%~dp0firmware_merged.bin" (
    echo [INFO] Найден файл: firmware_merged.bin
    set FLASH_CMD=0x0 "%~dp0firmware_merged.bin"
    goto :FOUND_BIN
)

if exist "%~dp0firmware.bin" (
    echo [INFO] Найден файл: firmware.bin
    set FLASH_CMD=0x10000 "%~dp0firmware.bin"
    goto :FOUND_BIN
)

if exist "%~dp0StairsEsp.ino.bin" (
    echo [INFO] Найден файл: StairsEsp.ino.bin
    set FLASH_CMD=0x10000 "%~dp0StairsEsp.ino.bin"
    goto :FOUND_BIN
)

for %%F in ("%~dp0*.bin") do (
    echo [INFO] Найден файл: %%~nxF
    set FLASH_CMD=0x10000 "%%~fF"
    goto :FOUND_BIN
)

:FOUND_BIN
if "%FLASH_CMD%"=="" (
    echo [ERROR] В текущей папке не найдено ни одного .bin файла прошивки!
    pause
    goto MAIN_MENU
)

call :DETECT_PORT
if "%DETECTED_PORT%"=="" goto MAIN_MENU

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

:: -------------------------------------------------------------
:: Mode 2: Manual .bin file selection
:: -------------------------------------------------------------
:FLASH_LOCAL_MANUAL
cls
echo ======================================================================
echo  📁 [Режим 2] Выбор локального файла прошивки вручную
echo ======================================================================
echo.
call :ENSURE_ESPTOOL

echo Введите полный путь к .bin файлу или перетащите его мышкой в это окно:
set "CUSTOM_BIN="
set /p CUSTOM_BIN="Путь к файлу: "
set CUSTOM_BIN=%CUSTOM_BIN:"=%

if not exist "%CUSTOM_BIN%" (
    echo [ERROR] Указанный файл не существует: "%CUSTOM_BIN%"
    pause
    goto MAIN_MENU
)

echo.
echo Выберите адрес смещения Flash памяти:
echo   [1] 0x10000 (Стандартное приложение / App - РЕКОМЕНДУЕТСЯ)
echo   [2] 0x0     (Полный образ / Full Binary Image)
echo.
set "OFFSET_CHOICE="
set /p OFFSET_CHOICE="Адрес (1 или 2) [По умолчанию 1]: "
if "%OFFSET_CHOICE%"=="2" (
    set FLASH_CMD=0x0 "%CUSTOM_BIN%"
) else (
    set FLASH_CMD=0x10000 "%CUSTOM_BIN%"
)

call :DETECT_PORT
if "%DETECTED_PORT%"=="" goto MAIN_MENU

echo.
echo [*] Запуск прошивки ESP32...
%ESPTOOL_PATH% --chip esp32 --port %DETECTED_PORT% --baud 921600 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_CMD%

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo  🎉 [УСПЕХ] Прошивка успешно загружена в ESP32!
    echo ======================================================================
    goto POST_FLASH_MENU
) else (
    echo [ERROR] Ошибка при прошивке файла.
    pause
    goto MAIN_MENU
)

:: -------------------------------------------------------------
:: Mode 3: Download from GitHub Releases
:: -------------------------------------------------------------
:GITHUB_RELEASE_PICKER
cls
echo ======================================================================
echo  🌐 [Режим 3] Загрузка прошивки из GitHub Releases
echo ======================================================================
echo.
call :ENSURE_ESPTOOL

echo Доступные версии:
echo.
echo   [1] 🌟 v1.0.14 (Рекомендуемая последняя версия: без зависаний WiFiManager)
echo   [2] 📦 v1.0.13 (Стабильная сборка)
echo   [3] 📦 v1.0.4  (Предыдущая стабильная сборка)
echo   [4] 📦 v1.0.3  (Сборка PlatformIO)
echo   [L] 🚀 Скачать LATEST (самый свежий релиз напрямую с GitHub)
echo   [C] ✍️  Ввести свой тег версии вручную (например v1.0.14)
echo   [M] 🔙 Главное меню
echo.
set "REL_CHOICE="
set /p REL_CHOICE="Выберите версию (1-4, L, C, M) [По умолчанию 1]: "
if "%REL_CHOICE%"=="" set REL_CHOICE=1
if /i "%REL_CHOICE%"=="M" goto MAIN_MENU

if /i "%REL_CHOICE%"=="L" (
    set "DOWNLOAD_URL=https://github.com/%GH_USER%/%GH_REPO%/releases/latest/download/firmware.bin"
    set "SELECTED_TAG=latest"
    goto DO_DOWNLOAD
)
if /i "%REL_CHOICE%"=="C" (
    set /p CUSTOM_TAG="Введите тег релиза (например v1.0.14): "
    set "DOWNLOAD_URL=https://github.com/%GH_USER%/%GH_REPO%/releases/download/%CUSTOM_TAG%/firmware.bin"
    set "SELECTED_TAG=%CUSTOM_TAG%"
    goto DO_DOWNLOAD
)
if "%REL_CHOICE%"=="1" (
    set "DOWNLOAD_URL=https://github.com/%GH_USER%/%GH_REPO%/releases/download/v1.0.14/firmware.bin"
    set "SELECTED_TAG=v1.0.14"
    goto DO_DOWNLOAD
)
if "%REL_CHOICE%"=="2" (
    set "DOWNLOAD_URL=https://github.com/%GH_USER%/%GH_REPO%/releases/download/v1.0.13/firmware.bin"
    set "SELECTED_TAG=v1.0.13"
    goto DO_DOWNLOAD
)
if "%REL_CHOICE%"=="3" (
    set "DOWNLOAD_URL=https://github.com/%GH_USER%/%GH_REPO%/releases/download/v1.0.4/firmware.bin"
    set "SELECTED_TAG=v1.0.4"
    goto DO_DOWNLOAD
)
if "%REL_CHOICE%"=="4" (
    set "DOWNLOAD_URL=https://github.com/%GH_USER%/%GH_REPO%/releases/download/v1.0.3/firmware.bin"
    set "SELECTED_TAG=v1.0.3"
    goto DO_DOWNLOAD
)

:DO_DOWNLOAD
echo.
echo [*] Скачивание прошивки (%SELECTED_TAG%) с GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { (New-Object System.Net.WebClient).DownloadFile('%DOWNLOAD_URL%', '%~dp0downloaded_firmware.bin'); Write-Host '[OK] Файл успешно скачан!' } catch { Write-Host ('[ERROR] ' + $_.Exception.Message); exit 1 }"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Не удалось скачать прошивку. Проверьте интернет или имя тега.
    pause
    goto GITHUB_RELEASE_PICKER
)

set FLASH_CMD=0x10000 "%~dp0downloaded_firmware.bin"
call :DETECT_PORT
if "%DETECTED_PORT%"=="" goto MAIN_MENU

echo [*] Запуск прошивки...
%ESPTOOL_PATH% --chip esp32 --port %DETECTED_PORT% --baud 921600 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_CMD%
if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo  🎉 [УСПЕХ] Прошивка %SELECTED_TAG% успешно загружена в ESP32!
    echo ======================================================================
    goto POST_FLASH_MENU
) else (
    echo [ERROR] Ошибка прошивки.
    pause
    goto MAIN_MENU
)

:: -------------------------------------------------------------
:: Mode 4: Full Erase Flash Memory
:: -------------------------------------------------------------
:FULL_ERASE_MENU
cls
echo ======================================================================
echo  🧹 [Режим 4] Полная очистка Flash памяти ESP32
echo ======================================================================
echo.
echo Это полностью сотрет старый зависший WiFiManager и поврежденные настройки.
echo.
call :ENSURE_ESPTOOL
call :DETECT_PORT
if "%DETECTED_PORT%"=="" goto MAIN_MENU

echo [*] Полная очистка Flash памяти ESP32...
%ESPTOOL_PATH% --chip esp32 --port %DETECTED_PORT% --baud 921600 erase_flash
echo.
echo [OK] Память полностью очищена! Теперь можно прошить чистую версию (Пункт 1).
pause
goto MAIN_MENU

:: -------------------------------------------------------------
:: Mode 5: Wireless OTA update over Wi-Fi
:: -------------------------------------------------------------
:OTA_WIFI_UPDATE
cls
echo ======================================================================
echo  📶 [Режим 5] Беспроводное OTA-обновление по Wi-Fi (без USB)
echo ======================================================================
echo.
set "ESP_IP="
set /p ESP_IP="Введите IP адрес ESP32 в локальной сети: "
if "%ESP_IP%"=="" (
    echo [ERROR] IP адрес не указан.
    pause
    goto MAIN_MENU
)

set "OTA_BIN=%~dp0firmware.bin"
if not exist "%OTA_BIN%" set "OTA_BIN=%~dp0StairsEsp.ino.bin"
if not exist "%OTA_BIN%" (
    set /p OTA_BIN="Введите путь к .bin файлу: "
    set OTA_BIN=%OTA_BIN:"=%
)

if not exist "%OTA_BIN%" (
    echo [ERROR] Файл прошивки не найден!
    pause
    goto MAIN_MENU
)

echo [*] Отправка прошивки на http://%ESP_IP%/update ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $wc = New-Object System.Net.WebClient; $bytes = [System.IO.File]::ReadAllBytes('%OTA_BIN%'); $resp = $wc.UploadData('http://%ESP_IP%/update', 'POST', $bytes); Write-Host '🎉 [УСПЕХ] Прошивка передана! Контроллер перезагружается...' } catch { Write-Host ('❌ Ошибка OTA: ' + $_.Exception.Message) }"
echo.
pause
goto MAIN_MENU

:: -------------------------------------------------------------
:: Mode 6: Fast Wi-Fi setup via USB
:: -------------------------------------------------------------
:USB_WIFI_ONLY
cls
echo ======================================================================
echo  📶 [Режим 6] Быстрая настройка Wi-Fi через USB (за 5 секунд)
echo ======================================================================
echo.
set "WIFI_SSID="
set /p WIFI_SSID="1. Имя домашнего Wi-Fi (SSID): "
set "WIFI_PASS="
set /p WIFI_PASS="2. Пароль от Wi-Fi: "
echo.

call :DETECT_PORT
if "%DETECTED_PORT%"=="" goto MAIN_MENU

echo [*] Запись Wi-Fi в память ESP32...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$port = new-Object System.IO.Ports.SerialPort '%DETECTED_PORT%', 115200, None, 8, one; $port.Open(); Start-Sleep -Milliseconds 500; $port.WriteLine('SET:wifi_ssid=%WIFI_SSID%'); Start-Sleep -Milliseconds 200; $port.WriteLine('SET:wifi_pass=%WIFI_PASS%'); Start-Sleep -Milliseconds 200; $port.WriteLine('SAVE'); Start-Sleep -Milliseconds 500; $port.Close();"
echo [OK] Настройки сохранены! Плата подключается к '%WIFI_SSID%'.
echo.
set /p OPEN_MON="Открыть Serial Монитор, чтобы увидеть полученный IP адрес? (Y/N) [Y]: "
if /i "%OPEN_MON%"=="N" goto MAIN_MENU
goto OPEN_SERIAL_TERMINAL

:: -------------------------------------------------------------
:: Mode 7: Full USB Configuration Wizard
:: -------------------------------------------------------------
:USB_SETUP_WIZARD
cls
echo ======================================================================
echo  ⚙️  [Режим 7] Полный мастер настройки параметров через USB
echo ======================================================================
echo.
set /p CFG_WIFI_SSID="1. Имя домашнего Wi-Fi (SSID): "
set /p CFG_WIFI_PASS="2. Пароль от Wi-Fi: "
set /p CFG_STEPS="3. Количество ступеней лестницы (1-32) [16]: "
set /p CFG_LEDS="4. Количество LED диодов на 1 ступень (1-60) [30]: "
set /p CFG_SPEED="5. Скорость шага в мс (20-250) [60]: "
set /p CFG_HOLD="6. Время свечения после прохода в сек (3-60) [15]: "
set /p CFG_BRI="7. Основная яркость (10-255) [220]: "
set /p CFG_PIN_LED="8. GPIO пин ленты WS2812B (Data) [18]: "
set /p CFG_PIN_BOT="9. GPIO пин нижнего датчика [19]: "
set /p CFG_PIN_TOP="10. GPIO пин верхнего датчика [21]: "

call :DETECT_PORT
if "%DETECTED_PORT%"=="" goto MAIN_MENU

echo.
echo [*] Запись всех параметров в память ESP32...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$p = new-Object System.IO.Ports.SerialPort '%DETECTED_PORT%', 115200, None, 8, one; $p.Open(); Start-Sleep -Milliseconds 500;" ^
    "if ('%CFG_WIFI_SSID%' -ne '') { $p.WriteLine('SET:wifi_ssid=%CFG_WIFI_SSID%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_WIFI_PASS%' -ne '') { $p.WriteLine('SET:wifi_pass=%CFG_WIFI_PASS%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_STEPS%' -ne '') { $p.WriteLine('SET:step_count=%CFG_STEPS%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_LEDS%' -ne '') { $p.WriteLine('SET:leds_per_step=%CFG_LEDS%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_SPEED%' -ne '') { $p.WriteLine('SET:step_speed=%CFG_SPEED%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_HOLD%' -ne '') { $p.WriteLine('SET:hold_time=%CFG_HOLD%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_BRI%' -ne '') { $p.WriteLine('SET:brightness=%CFG_BRI%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_PIN_LED%' -ne '') { $p.WriteLine('SET:pin_led=%CFG_PIN_LED%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_PIN_BOT%' -ne '') { $p.WriteLine('SET:pin_sensor_bot=%CFG_PIN_BOT%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_PIN_TOP%' -ne '') { $p.WriteLine('SET:pin_sensor_top=%CFG_PIN_TOP%'); Start-Sleep -Milliseconds 150; }" ^
    "$p.WriteLine('SAVE'); Start-Sleep -Milliseconds 500; $p.Close();"

echo [OK] Все параметры успешно сохранены!
pause
goto MAIN_MENU

:: -------------------------------------------------------------
:: Mode 8: Live Serial Terminal
:: -------------------------------------------------------------
:OPEN_SERIAL_TERMINAL
cls
call :DETECT_PORT
if "%DETECTED_PORT%"=="" goto MAIN_MENU

echo [INFO] Подключение к монитору порта %DETECTED_PORT% (115200 бод)...
echo [INFO] Для выхода в главное меню нажмите Ctrl+C
echo ----------------------------------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -Command "$port = new-Object System.IO.Ports.SerialPort '%DETECTED_PORT%', 115200, None, 8, one; $port.Open(); while($true){ if($port.BytesToRead -gt 0){ Write-Host -NoNewline $port.ReadExisting() } Start-Sleep -Milliseconds 30 }"
goto MAIN_MENU

:: -------------------------------------------------------------
:: Helper: Detect COM Port
:: -------------------------------------------------------------
:DETECT_PORT
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
    exit /b 1
)
echo [OK] Выбран порт: %DETECTED_PORT%
exit /b 0

:: -------------------------------------------------------------
:: Helper: Ensure esptool
:: -------------------------------------------------------------
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

:: -------------------------------------------------------------
:: Post Flash Navigation Menu
:: -------------------------------------------------------------
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

:EXIT_SCRIPT
exit /b 0
