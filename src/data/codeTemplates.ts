import { StaircaseConfig } from '../types';

export interface CodeFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export function generateProjectFiles(config: StaircaseConfig): CodeFile[] {
  const totalLeds = config.stepCount * config.ledsPerStep;

  // 1. platformio.ini
  const platformioIni = `; PlatformIO Project Configuration for ESP32 Smart Staircase
; Auto-build and OTA ready

[env:esp32dev]
platform = espressif32@^6.5.0
board = esp32dev
framework = arduino
monitor_speed = 115200
board_build.partitions = min_spiffs.csv  ; Provides 1.9MB app partition for OTA

build_flags = 
    -D CORE_DEBUG_LEVEL=3
    -D FIRMWARE_VERSION=\\"${config.firmwareVersion}\\"
    -D BOARD_NAME=\\"ESP32_Staircase_Controller\\"

lib_deps = 
    fastled/FastLED @ ^3.6.0
    bblanchon/ArduinoJson @ ^7.0.4
    arduino-libraries/NTPClient @ ^3.2.1
    https://github.com/me-no-dev/ESPAsyncWebServer.git
    https://github.com/me-no-dev/AsyncTCP.git
`;

  // 2. flash_windows.bat (Windows 1-Click Flasher with Local File Picker & GitHub Releases Downloader)
  const flashWindowsBat = `@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ESP32 Smart Staircase - Firmware Flasher & Setup Wizard

:MAIN_MENU
cls
echo ======================================================================
echo    🌟 ESP32 Smart Staircase Controller - Firmware Flasher & Manager
echo ======================================================================
echo.
echo Репозиторий: ${config.githubUsername || 'USER'}/${config.githubRepo || 'REPO'} (Текущая конфигурация: v${config.firmwareVersion || '1.0.4'})
echo.
echo Выберите действие:
echo.
echo   [1] ⚡ Прошить текущую локальную версию (Автоопределение файлов в папке)
echo   [2] 📁 Выбрать локальный .bin файл на компьютере (Вручную / Drag-and-Drop)
echo   [3] 🌐 Выбрать и скачать версию прошивки из GitHub Releases
echo   [4] 📶 Беспроводное OTA-обновление по Wi-Fi (без USB кабеля)
echo   [5] 📶 НАСТРОЙКА ТОЛЬКО WI-FI (SSID и пароль через USB за 5 секунд)
echo   [6] ⚙️  Полный мастер настройки параметров (LED, Пины, Яркость, Ступени)
echo   [7] 📟 Открыть Монитор Serial Порта (Live Логи 115200 бод)
echo   [8] 🚪 Выход
echo.
set "MENU_CHOICE="
set /p MENU_CHOICE="Введите номер пункта (1-8) [По умолчанию 1]: "
if "%MENU_CHOICE%"=="" set MENU_CHOICE=1

if "%MENU_CHOICE%"=="1" goto FLASH_LOCAL_AUTO
if "%MENU_CHOICE%"=="2" goto FLASH_LOCAL_MANUAL
if "%MENU_CHOICE%"=="3" goto GITHUB_RELEASE_PICKER
if "%MENU_CHOICE%"=="4" goto OTA_WIFI_UPDATE
if "%MENU_CHOICE%"=="5" goto USB_WIFI_ONLY
if "%MENU_CHOICE%"=="6" goto USB_SETUP_WIZARD
if "%MENU_CHOICE%"=="7" goto OPEN_SERIAL_TERMINAL
if "%MENU_CHOICE%"=="8" goto EXIT_SCRIPT

echo [!] Неверный ввод. Пожалуйста, введите цифру от 1 до 8.
timeout /t 2 >nul
goto MAIN_MENU

:: ======================================================================
:: 1. Auto-flash local firmware files found in current directory
:: ======================================================================
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
    set FLASH_CMD=0x1000 "%~dp0StairsEsp.ino.bootloader.bin" 0x8000 "%~dp0StairsEsp.ino.partitions.bin" 0x10000 "%~dp0StairsEsp.ino.bin"
    goto EXECUTE_FLASH
)

if exist "%~dp0bootloader.bin" if exist "%~dp0partitions.bin" if exist "%~dp0firmware.bin" (
    echo [INFO] Найден полный комплект сборки (Bootloader + Partitions + Firmware)
    set FLASH_CMD=0x1000 "%~dp0bootloader.bin" 0x8000 "%~dp0partitions.bin" 0x10000 "%~dp0firmware.bin"
    goto EXECUTE_FLASH
)

if exist "%~dp0firmware.bin" (
    echo [INFO] Найден файл: firmware.bin (запись по адресу 0x10000)
    set FLASH_CMD=0x10000 "%~dp0firmware.bin"
    goto EXECUTE_FLASH
)

if exist "%~dp0StairsEsp.ino.bin" (
    echo [INFO] Найден файл: StairsEsp.ino.bin (запись по адресу 0x10000)
    set FLASH_CMD=0x10000 "%~dp0StairsEsp.ino.bin"
    goto EXECUTE_FLASH
)

for %%F in ("%~dp0stairs_*.bin") do (
    echo [INFO] Найден файл с версией: %%~nxF (запись по адресу 0x10000)
    set FLASH_CMD=0x10000 "%%~fF"
    goto EXECUTE_FLASH
)

echo [!] Локальные .bin файлы прошивки не найдены в папке скрипта!
echo Хотите выбрать файл вручную или скачать с GitHub?
echo.
echo   [1] Выбрать локальный файл с диска
echo   [2] Скачать с GitHub Releases
echo   [3] Вернуться в главное меню
echo.
set "FB_CHOICE="
set /p FB_CHOICE="Ваш выбор (1-3): "
if "%FB_CHOICE%"=="1" goto FLASH_LOCAL_MANUAL
if "%FB_CHOICE%"=="2" goto GITHUB_RELEASE_PICKER
goto MAIN_MENU

:: ======================================================================
:: 2. Choose local .bin file manually or via Drag-and-Drop
:: ======================================================================
:FLASH_LOCAL_MANUAL
cls
echo ======================================================================
echo  📁 [Режим 2] Выбор локального файла прошивки на компьютере
echo ======================================================================
echo.

call :ENSURE_ESPTOOL

echo Найденные .bin файлы в текущей папке:
echo ----------------------------------------------------
set /a BIN_COUNT=0
for %%F in ("%~dp0*.bin") do (
    set /a BIN_COUNT+=1
    echo   [!BIN_COUNT!] %%~nxF
)
echo ----------------------------------------------------
echo.
echo Укажите номер файла из списка выше, ИЛИ:
echo Перетащите мышкой (Drag and Drop) любой .bin файл в это окно и нажмите ENTER.
echo.
set "CUSTOM_BIN="
set /p CUSTOM_BIN="Путь к файлу или номер: "

if "%CUSTOM_BIN%"=="" (
    echo [!] Файл не выбран. Возврат в меню...
    timeout /t 2 >nul
    goto MAIN_MENU
)

:: Remove surrounding quotes if user drag-and-dropped
set CUSTOM_BIN=%CUSTOM_BIN:"=%

:: Check if user typed a number from the list
set /a USER_NUM=%CUSTOM_BIN% 2>nul
if %USER_NUM% GTR 0 (
    set /a CURRENT_INDEX=0
    for %%F in ("%~dp0*.bin") do (
        set /a CURRENT_INDEX+=1
        if !CURRENT_INDEX! EQU %USER_NUM% set "CUSTOM_BIN=%%~fF"
    )
)

if not exist "%CUSTOM_BIN%" (
    echo [ERROR] Указанный файл не найден: "%CUSTOM_BIN%"
    echo Проверьте путь и попробуйте снова.
    pause
    goto FLASH_LOCAL_MANUAL
)

echo.
echo [OK] Выбран файл: "%CUSTOM_BIN%"
echo.
echo Выберите адрес смещения Flash памяти:
echo   [1] 0x10000 (Стандартное приложение / App Partition - РЕКОМЕНДУЕТСЯ)
echo   [2] 0x0     (Полный образ / Full Binary Image)
echo.
set "OFFSET_CHOICE="
set /p OFFSET_CHOICE="Адрес (1 или 2) [По умолчанию 1]: "
if "%OFFSET_CHOICE%"=="2" (
    set FLASH_CMD=0x0 "%CUSTOM_BIN%"
) else (
    set FLASH_CMD=0x10000 "%CUSTOM_BIN%"
)
goto EXECUTE_FLASH

:: ======================================================================
:: 3. Interactive GitHub Releases Version Picker & Downloader
:: ======================================================================
:GITHUB_RELEASE_PICKER
cls
echo ======================================================================
echo  🌐 [Режим 3] Выбор и загрузка прошивки из GitHub Releases
echo ======================================================================
echo.
echo Репозиторий: ${config.githubUsername || 'USER'}/${config.githubRepo || 'REPO'}
echo.
echo Доступные версии:
echo.
echo   [1] 🌟 v1.0.4 (Последний релиз: эффекты розжига, расчет Борисов, фиксы)
echo   [2] 📦 v1.0.3 (Стабильная сборка PlatformIO)
echo   [3] 📦 v1.0.2 (Астрономический расчет заката/рассвета)
echo   [4] 📦 v1.0.0 (Базовая версия)
echo   [L] 🚀 Скачать LATEST (самый свежий релиз напрямую с GitHub)
echo   [C] ✍️  Ввести свой тег версии вручную (например v1.0.5)
echo   [M] 🔙 Главное меню
echo.
set "GH_VER_CHOICE="
set /p GH_VER_CHOICE="Выберите версию (1, 2, 3, 4, L, C, M) [По умолчанию 1]: "
if "%GH_VER_CHOICE%"=="" set GH_VER_CHOICE=1

if /i "%GH_VER_CHOICE%"=="M" goto MAIN_MENU
if /i "%GH_VER_CHOICE%"=="L" goto DOWNLOAD_LATEST_GITHUB
if /i "%GH_VER_CHOICE%"=="C" goto CUSTOM_TAG_INPUT

set "TARGET_TAG=v1.0.4"
if "%GH_VER_CHOICE%"=="1" set "TARGET_TAG=v1.0.4"
if "%GH_VER_CHOICE%"=="2" set "TARGET_TAG=v1.0.3"
if "%GH_VER_CHOICE%"=="3" set "TARGET_TAG=v1.0.2"
if "%GH_VER_CHOICE%"=="4" set "TARGET_TAG=v1.0.0"

goto DOWNLOAD_AND_FLASH_TAG

:CUSTOM_TAG_INPUT
echo.
set "TARGET_TAG="
set /p TARGET_TAG="Введите тег релиза (например v1.0.5): "
if "%TARGET_TAG%"=="" goto GITHUB_RELEASE_PICKER
goto DOWNLOAD_AND_FLASH_TAG

:DOWNLOAD_LATEST_GITHUB
echo.
echo [*] Запрос информации о последнем релизе с GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
    "$user = '${config.githubUsername || 'USER'}';" ^
    "$repo = '${config.githubRepo || 'REPO'}';" ^
    "$url = \"https://github.com/$user/$repo/releases/latest/download/firmware.bin\";" ^
    "$outFile = '%~dp0downloaded_latest_firmware.bin';" ^
    "Write-Host \"[*] Скачивание последнего firmware.bin...\";" ^
    "try {" ^
    "  (New-Object System.Net.WebClient).DownloadFile($url, $outFile);" ^
    "  Write-Host '[OK] Файл успешно скачан!';" ^
    "  [System.IO.File]::WriteAllText('%temp%\\gh_dl_res.txt', 'SUCCESS');" ^
    "} catch {" ^
    "  Write-Host ('[!] Ошибка скачивания: ' + $_.Exception.Message);" ^
    "  [System.IO.File]::WriteAllText('%temp%\\gh_dl_res.txt', 'FAIL');" ^
    "}"

set /p DL_RES=<"%temp%\\gh_dl_res.txt"
del /f /q "%temp%\\gh_dl_res.txt" >nul 2>&1

if "%DL_RES%"=="SUCCESS" (
    set FLASH_CMD=0x10000 "%~dp0downloaded_latest_firmware.bin"
    goto EXECUTE_FLASH
) else (
    echo.
    echo [ERROR] Не удалось скачать latest релиз с GitHub.
    echo Проверьте интернет-соединение и доступность репозитория.
    pause
    goto GITHUB_RELEASE_PICKER
)

:DOWNLOAD_AND_FLASH_TAG
echo.
echo [*] Скачивание прошивки версии %TARGET_TAG% с GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
    "$user = '${config.githubUsername || 'USER'}';" ^
    "$repo = '${config.githubRepo || 'REPO'}';" ^
    "$tag = '%TARGET_TAG%';" ^
    "$url = \"https://github.com/$user/$repo/releases/download/$tag/firmware.bin\";" ^
    "$outFile = \"%~dp0downloaded_$tag.bin\";" ^
    "Write-Host \"[*] URL: $url\";" ^
    "try {" ^
    "  (New-Object System.Net.WebClient).DownloadFile($url, $outFile);" ^
    "  Write-Host '[OK] Прошивка $tag успешно скачана!';" ^
    "  [System.IO.File]::WriteAllText('%temp%\\gh_dl_res.txt', 'SUCCESS');" ^
    "} catch {" ^
    "  Write-Host ('[!] Ошибка скачивания: ' + $_.Exception.Message);" ^
    "  [System.IO.File]::WriteAllText('%temp%\\gh_dl_res.txt', 'FAIL');" ^
    "}"

set /p DL_RES=<"%temp%\\gh_dl_res.txt"
del /f /q "%temp%\\gh_dl_res.txt" >nul 2>&1

if "%DL_RES%"=="SUCCESS" (
    set FLASH_CMD=0x10000 "%~dp0downloaded_%TARGET_TAG%.bin"
    goto EXECUTE_FLASH
) else (
    echo.
    echo [ERROR] Не удалось скачать релиз %TARGET_TAG% с GitHub.
    pause
    goto GITHUB_RELEASE_PICKER
)

:: ======================================================================
:: 4. Wireless OTA update over Wi-Fi
:: ======================================================================
:OTA_WIFI_UPDATE
cls
echo ======================================================================
echo  📶 [Режим 4] Беспроводное OTA-обновление прошивки по Wi-Fi
echo ======================================================================
echo.
echo Данный режим позволяет обновить ESP32 по локальной сети без USB-кабеля.
echo.
set "ESP_IP="
set /p ESP_IP="Введите IP адрес ESP32 в локальной сети [192.168.4.1]: "
if "%ESP_IP%"=="" set ESP_IP=192.168.4.1

echo.
echo Выберите файл прошивки для отправки:
set "OTA_BIN="
if exist "%~dp0firmware.bin" set "OTA_BIN=%~dp0firmware.bin"
if exist "%~dp0StairsEsp.ino.bin" set "OTA_BIN=%~dp0StairsEsp.ino.bin"

if not "%OTA_BIN%"=="" (
    echo Найден файл по умолчанию: %OTA_BIN%
    set /p USE_DEF="Использовать его? (Y/N) [Y]: "
    if /i "%USE_DEF%"=="N" set "OTA_BIN="
)

if "%OTA_BIN%"=="" (
    set /p OTA_BIN="Введите путь к .bin файлу или перетащите файл мышкой: "
)
set OTA_BIN=%OTA_BIN:"=%

if not exist "%OTA_BIN%" (
    echo [ERROR] Файл прошивки не найден!
    pause
    goto MAIN_MENU
)

echo.
echo [*] Отправка прошивки на http://%ESP_IP%/update ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try {" ^
    "  $url = 'http://%ESP_IP%/update';" ^
    "  $file = '%OTA_BIN%';" ^
    "  Write-Host '[*] Загрузка файла ' $file ' на ' $url '...';" ^
    "  $wc = New-Object System.Net.WebClient;" ^
    "  $bytes = [System.IO.File]::ReadAllBytes($file);" ^
    "  $resp = $wc.UploadData($url, 'POST', $bytes);" ^
    "  Write-Host '✅ [УСПЕХ] Прошивка успешно передана! ESP32 перезагружается...';" ^
    "} catch {" ^
    "  Write-Host ('❌ [ОШИБКА] Не удалось обновить по Wi-Fi: ' + $_.Exception.Message);" ^
    "}"

echo.
pause
goto MAIN_MENU

:: ======================================================================
:: Flash Execution Engine via esptool.exe
:: ======================================================================
:EXECUTE_FLASH
call :ENSURE_ESPTOOL

echo.
echo ======================================================
echo  1. Подключите ESP32 к компьютеру через USB-кабель.
echo  2. Если плата не шьется автоматически, зажмите кнопку
echo     BOOT (IO0), нажмите RESET, затем отпустите BOOT.
echo ======================================================
echo.
echo Нажмите ЛЮБУЮ КЛАВИШУ для запуска прошивки...
pause >nul

echo.
echo [*] Прошивка ESP32 через esptool (921600 baud)...
"%~dp0esptool.exe" --chip esp32 --baud 921600 write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_CMD%

if errorlevel 1 (
    echo.
    echo [*] Повторная попытка на безопасной скорости 115200 baud...
    "%~dp0esptool.exe" --chip esp32 --baud 115200 write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_CMD%
)

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
    goto MAIN_MENU
)

echo.
echo ======================================================================
echo  ✅ [УСПЕХ] Прошивка ESP32 успешно завершена!
echo ======================================================================
echo.

:: 3. Post-Flash Setup Wizard Menu
:POST_FLASH_MENU
echo Выберите следующее действие:
echo.
echo   [1] ⚙️  Быстрая настройка через USB прямо сейчас (Консольный мастер)
echo   [2] 🌐  Открыть Web-интерфейс в браузере (Wi-Fi Точка Доступа 192.168.4.1)
echo   [3] 📟  Открыть Монитор Serial Порта (Live Логи 115200)
echo   [4] 🔙  Главное меню прошивальщика
echo   [5] 🚪  Выход
echo.
set "POST_CHOICE="
set /p POST_CHOICE="Введите номер пункта (1-5) [По умолчанию 1]: "
if "%POST_CHOICE%"=="" set POST_CHOICE=1

if "%POST_CHOICE%"=="1" goto USB_SETUP_WIZARD
if "%POST_CHOICE%"=="2" goto BROWSER_AP_GUIDE
if "%POST_CHOICE%"=="3" goto OPEN_SERIAL_TERMINAL
if "%POST_CHOICE%"=="4" goto MAIN_MENU
if "%POST_CHOICE%"=="5" goto EXIT_SCRIPT

echo [!] Неверный выбор.
goto POST_FLASH_MENU

:: -------------------------------------------------------------
:: Helper: Ensure esptool.exe is downloaded and available
:: -------------------------------------------------------------
:ENSURE_ESPTOOL
if exist "%~dp0esptool.exe" exit /b 0

echo [*] esptool.exe не найден в папке.
echo [*] Загрузка официального esptool.exe для Windows с GitHub...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://github.com/espressif/esptool/releases/download/v4.7.0/esptool-v4.7.0-win64.zip', '%~dp0esptool.zip')"

if exist "%~dp0esptool.zip" (
    echo [*] Распаковка esptool.exe...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%~dp0esptool.zip' -DestinationPath '%~dp0esptool_tmp' -Force"
    if exist "%~dp0esptool_tmp\\esptool-win64\\esptool.exe" (
        copy /y "%~dp0esptool_tmp\\esptool-win64\\esptool.exe" "%~dp0esptool.exe" >nul
    ) else (
        for /r "%~dp0esptool_tmp" %%F in (esptool.exe) do copy /y "%%F" "%~dp0esptool.exe" >nul
    )
    rd /s /q "%~dp0esptool_tmp" >nul 2>&1
    del /f /q "%~dp0esptool.zip" >nul 2>&1
)

if not exist "%~dp0esptool.exe" (
    echo [ERROR] Не удалось автоматически скачать esptool.exe!
    echo Скачайте esptool.exe вручную с https://github.com/espressif/esptool/releases
    pause
    exit /b 1
)
echo [OK] esptool.exe готов к работе.
exit /b 0

:: -------------------------------------------------------------
:: Mode 5: Dedicated Wi-Fi Only Setup (Fast 5-second setup)
:: -------------------------------------------------------------
:USB_WIFI_ONLY
cls
echo ======================================================================
echo  📶 [Режим 5] Настройка только Wi-Fi через USB
echo ======================================================================
echo.
echo Введите данные вашей домашней сети Wi-Fi (2.4 GHz):
echo.

set "CFG_WIFI_SSID="
set /p CFG_WIFI_SSID="1. Имя домашнего Wi-Fi (SSID): "

if "%CFG_WIFI_SSID%"=="" (
    echo [!] Имя сети не может быть пустым. Возврат в меню...
    timeout /t 2 >nul
    goto MAIN_MENU
)

set "CFG_WIFI_PASS="
set /p CFG_WIFI_PASS="2. Пароль от Wi-Fi: "

echo.
echo [*] Поиск подключенного COM-порта ESP32...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object); if ($ports.Count -eq 0) { [System.IO.File]::WriteAllText('%temp%\\esp_port.txt', 'NO_PORT'); exit } $usbPorts = @($ports | Where-Object { $_ -ne 'COM1' }); $portName = if ($usbPorts.Count -gt 0) { $usbPorts[0] } else { $ports[0] }; [System.IO.File]::WriteAllText('%temp%\\esp_port.txt', $portName)"
set /p DETECTED_PORT=<"%temp%\\esp_port.txt"
del /f /q "%temp%\\esp_port.txt" >nul 2>&1

if "%DETECTED_PORT%"=="NO_PORT" (
    echo [!] COM-порт не определен автоматически.
    set /p DETECTED_PORT="Укажите номер COM-порта вручную (например COM3): "
)

if "%DETECTED_PORT%"=="" (
    echo [ERROR] Не удалось определить COM-порт.
    goto MAIN_MENU
)

echo [OK] Выбран порт: %DETECTED_PORT%
echo [*] Отправка Wi-Fi настроек в NVS память ESP32...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$portName = '%DETECTED_PORT%';" ^
    "try {" ^
    "  $port = New-Object System.IO.Ports.SerialPort($portName, 115200);" ^
    "  $port.DtrEnable = $false;" ^
    "  $port.RtsEnable = $false;" ^
    "  $port.Open();" ^
    "  Start-Sleep -Milliseconds 800;" ^
    "  $port.WriteLine('WIFI=%CFG_WIFI_SSID%,%CFG_WIFI_PASS%');" ^
    "  Start-Sleep -Milliseconds 400;" ^
    "  $port.WriteLine('STATUS');" ^
    "  Start-Sleep -Milliseconds 400;" ^
    "  $port.WriteLine('REBOOT');" ^
    "  Start-Sleep -Milliseconds 600;" ^
    "  $port.Close();" ^
    "  [System.IO.File]::WriteAllText('%temp%\\esp_cfg_result.txt', 'SUCCESS');" ^
    "} catch {" ^
    "  [System.IO.File]::WriteAllText('%temp%\\esp_cfg_result.txt', ('ERROR: ' + $_.Exception.Message));" ^
    "}"

set /p CFG_RESULT=<"%temp%\\esp_cfg_result.txt"
del /f /q "%temp%\\esp_cfg_result.txt" >nul 2>&1

echo.
if "%CFG_RESULT%"=="SUCCESS" (
    echo ======================================================================
    echo  🎉 [УСПЕХ] Wi-Fi SSID '%CFG_WIFI_SSID%' успешно сохранен в ESP32!
    echo  Контроллер перезагружается и подключается к роутеру...
    echo ======================================================================
) else (
    echo [!] Ошибка связи с портом: %CFG_RESULT%
)

echo.
echo Открыть Serial Монитор, чтобы увидеть полученный IP адрес? (Y/N)
set "OPEN_MON="
set /p OPEN_MON="[Y/N, по умолчанию Y]: "
if /i "%OPEN_MON%"=="N" goto MAIN_MENU
goto OPEN_SERIAL_TERMINAL

:: -------------------------------------------------------------
:: Mode 6: Full USB Configuration Wizard (Sends commands over COM port)
:: -------------------------------------------------------------
:USB_SETUP_WIZARD
echo.
echo ======================================================================
echo  ⚙️  Мастер быстрой настройки параметров через USB
echo ======================================================================
echo.
echo Введите параметры вашей системы (или нажмите ENTER, чтобы оставить по умолчанию):
echo.

set "CFG_WIFI_SSID="
set /p CFG_WIFI_SSID="1. Имя домашнего Wi-Fi (SSID): "

set "CFG_WIFI_PASS="
if not "%CFG_WIFI_SSID%"=="" (
    set /p CFG_WIFI_PASS="   Пароль от Wi-Fi: "
)

set "CFG_STEPS="
set /p CFG_STEPS="2. Количество ступеней лестницы (1-32) [${config.stepCount}]: "

set "CFG_LEDS="
set /p CFG_LEDS="3. Количество LED диодов на 1 ступень (1-60) [${config.ledsPerStep}]: "

set "CFG_SPEED="
set /p CFG_SPEED="4. Скорость переключения ступеней в мс (20-250) [${config.stepSpeedMs}]: "

set "CFG_HOLD="
set /p CFG_HOLD="5. Время свечения после прохода в сек (3-60) [${config.holdTimeSec}]: "

set "CFG_BRI="
set /p CFG_BRI="6. Основная яркость подсветки (10-255) [${config.activeBrightness}]: "

set "CFG_SB_MODE="
set /p CFG_SB_MODE="7. Ночной дежурный режим (0=Выкл, 1=Края, 2=Все, 3=Дыхание) [${config.standbyMode === 'edge_steps' ? '1' : config.standbyMode === 'all_dim' ? '2' : config.standbyMode === 'breathing' ? '3' : '0'}]: "

set "CFG_SB_BRI="
set /p CFG_SB_BRI="8. Яркость ночного дежурного режима (5-100) [${config.standbyBrightness}]: "

set "CFG_COLOR="
set /p CFG_COLOR="9. Цвет подсветки R,G,B (например 255,180,80) [255,180,80]: "

echo.
echo [*] Поиск подключенного COM-порта ESP32...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object); if ($ports.Count -eq 0) { [System.IO.File]::WriteAllText('%temp%\\esp_port.txt', 'NO_PORT'); exit } $usbPorts = @($ports | Where-Object { $_ -ne 'COM1' }); $portName = if ($usbPorts.Count -gt 0) { $usbPorts[0] } else { $ports[0] }; [System.IO.File]::WriteAllText('%temp%\\esp_port.txt', $portName)"
set /p DETECTED_PORT=<"%temp%\\esp_port.txt"
del /f /q "%temp%\\esp_port.txt" >nul 2>&1

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
    "  $port = New-Object System.IO.Ports.SerialPort($portName, 115200);" ^
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
    "  [System.IO.File]::WriteAllText('%temp%\\esp_cfg_result.txt', 'SUCCESS');" ^
    "} catch {" ^
    "  [System.IO.File]::WriteAllText('%temp%\\esp_cfg_result.txt', ('ERROR: ' + $_.Exception.Message));" ^
    "}"

set /p CFG_RESULT=<"%temp%\\esp_cfg_result.txt"
del /f /q "%temp%\\esp_cfg_result.txt" >nul 2>&1

echo.
if "%CFG_RESULT%"=="SUCCESS" (
    echo ======================================================================
    echo  🎉 [ГОТОВО] Все настройки успешно переданы и сохранены в ESP32!
    echo  Контроллер перезагрузился с новыми параметрами!
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
:: Mode: Web Access Point Guide
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
echo ======================================================================
echo.
start http://192.168.4.1 >nul 2>&1
pause
goto POST_FLASH_MENU

:: -------------------------------------------------------------
:: Mode: Open Serial Terminal
:: -------------------------------------------------------------
:OPEN_SERIAL_TERMINAL
cls
echo ======================================================================
echo  📟 Live Serial Monitor (115200 baud)
echo ======================================================================
echo.
echo [*] Ожидание стабилизации порта ESP32 после перезагрузки...
timeout /t 2 >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object);" ^
    "if ($ports.Count -eq 0) { Write-Host '[ERROR] COM порт не найден. Подключите ESP32 по USB.' -ForegroundColor Red; Start-Sleep -Seconds 3; return }" ^
    "$usbPorts = @($ports | Where-Object { $_ -ne 'COM1' });" ^
    "$p = if ($usbPorts.Count -gt 0) { $usbPorts[0] } else { $ports[0] };" ^
    "Write-Host ('[*] Открытие порта ' + $p + ' (115200 бод)...') -ForegroundColor Green;" ^
    "Write-Host '[*] Для выхода в главное меню нажмите Ctrl+C' -ForegroundColor Yellow;" ^
    "Write-Host '----------------------------------------------------------------------' -ForegroundColor Gray;" ^
    "try {" ^
    "  $sp = New-Object System.IO.Ports.SerialPort($p, 115200);" ^
    "  $sp.DtrEnable = $true;" ^
    "  $sp.RtsEnable = $false;" ^
    "  $sp.Open();" ^
    "  while ($sp.IsOpen) {" ^
    "    if ($sp.BytesToRead -gt 0) {" ^
    "      [Console]::Write($sp.ReadExisting());" ^
    "    }" ^
    "    Start-Sleep -Milliseconds 15;" ^
    "  }" ^
    "} catch {" ^
    "  Write-Host ('[!] Ошибка чтения порта: ' + $_.Exception.Message) -ForegroundColor Red;" ^
    "}"

echo.
echo ======================================================================
echo Монитор порта завершил работу.
echo ======================================================================
pause
goto MAIN_MENU

:EXIT_SCRIPT
echo.
echo Контроллер умной лестницы готов к работе!
echo.
exit /b 0
`;

  // 2b. terminal.bat (Windows Serial Monitor)
  const terminalBat = `@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ESP32 Smart Staircase - Serial Monitor ^& Console (115200)

echo ======================================================================
echo    📟 ESP32 Smart Staircase - Монитор Serial Порта и Консоль
echo ======================================================================
echo.

:: 1. Auto-Scan COM Ports with PowerShell
echo [*] Поиск доступных COM-портов...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$rawPorts = [System.IO.Ports.SerialPort]::GetPortNames();" ^
    "if (-not $rawPorts -or $rawPorts.Length -eq 0) { [System.IO.File]::WriteAllText('%temp%\\esp_ports.txt', 'NO_PORTS'); exit }" ^
    "$ports = @($rawPorts | Sort-Object);" ^
    "$usbPorts = @($ports | Where-Object { $_ -ne 'COM1' });" ^
    "$def = if ($usbPorts.Count -gt 0) { $usbPorts[0] } else { $ports[0] };" ^
    "$i = 1;" ^
    "foreach ($p in $ports) {" ^
    "  $rec = if ($p -eq $def) { ' (Рекомендуется)' } else { '' };" ^
    "  Write-Host ('  [' + $i + '] ' + $p + $rec);" ^
    "  $i++;" ^
    "}" ^
    "[System.IO.File]::WriteAllText('%temp%\\esp_ports.txt', ($def + '|' + ($ports -join ',')));"

if exist "%temp%\\esp_ports.txt" (
    set /p PORTS_INFO=<"%temp%\\esp_ports.txt"
    del /f /q "%temp%\\esp_ports.txt" >nul 2>&1
)

if "%PORTS_INFO%"=="NO_PORTS" (
    echo.
    echo ❌ [ОШИБКА] Ни одного COM-порта не обнаружено!
    echo Убедитесь, что ESP32 подключена по USB-кабелю и установлены драйверы CH340 / CP2102.
    echo.
    pause
    exit /b 1
)

for /f "tokens=1,2 delims=|" %%a in ("%PORTS_INFO%") do (
    set "DEFAULT_PORT=%%a"
    set "ALL_PORTS=%%b"
)

if "%DEFAULT_PORT%"=="" set DEFAULT_PORT=COM8

echo.
echo Нажмите ENTER для выбора [%DEFAULT_PORT%] или введите номер/имя порта:
set "USER_INPUT="
set /p USER_INPUT="Выбор [%DEFAULT_PORT%]: "

set "CHOSEN_PORT=%DEFAULT_PORT%"
if not "%USER_INPUT%"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$in = '%USER_INPUT%'.Trim();" ^
        "$all = @('%ALL_PORTS%'.Split(','));" ^
        "if ($in -match '^\\d+$') {" ^
        "  $idx = [int]$in - 1;" ^
        "  if ($idx -ge 0 -and $idx -lt $all.Count) { $res = $all[$idx] } else { $res = ('COM' + $in) }" ^
        "} else {" ^
        "  if (-not $in.ToUpper().StartsWith('COM')) { $res = 'COM' + $in } else { $res = $in.ToUpper() }" ^
        "}" ^
        "[System.IO.File]::WriteAllText('%temp%\\esp_sel.txt', $res);"
    set /p CHOSEN_PORT=<"%temp%\\esp_sel.txt"
    del /f /q "%temp%\\esp_sel.txt" >nul 2>&1
)

echo.
echo ======================================================================
echo  🔌 Подключение к %CHOSEN_PORT% (115200 baud)...
echo  💡 Чтобы отправить команду, просто введите её и нажмите ENTER.
echo     STATUS           - Узнать текущий IP-адрес и состояние
echo     WIFI=SSID,PASS   - Настроить домашний Wi-Fi
echo     STEPS=16         - Изменить число ступеней
echo     REBOOT           - Перезагрузить контроллер
echo  🛑 Для выхода нажмите Ctrl+C
echo ======================================================================
echo.

:: 2. Robust Serial Monitor & Command Sender via PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$portName = '%CHOSEN_PORT%';" ^
    "try {" ^
    "  $port = New-Object System.IO.Ports.SerialPort($portName, 115200);" ^
    "  $port.DtrEnable = $false;" ^
    "  $port.RtsEnable = $false;" ^
    "  $port.ReadTimeout = 50;" ^
    "  $port.WriteTimeout = 500;" ^
    "  $port.Open();" ^
    "  Write-Host ('✅ Успешно подключено к ' + $portName + '! Лог контроллера:') -ForegroundColor Green;" ^
    "  Write-Host '----------------------------------------------------------------------' -ForegroundColor DarkGray;" ^
    "  $port.WriteLine('STATUS');" ^
    "  $run = $true;" ^
    "  while ($run) {" ^
    "    try {" ^
    "      $line = $port.ReadLine();" ^
    "      if ($line) { Write-Host $line }" ^
    "    } catch [TimeoutException] {}" ^
    "    catch {" ^
    "      Write-Host ('[ОШИБКА ЧТЕНИЯ] ' + $_.Exception.Message) -ForegroundColor Red;" ^
    "      break;" ^
    "    }" ^
    "    if ([Console]::KeyAvailable) {" ^
    "      $k = [Console]::ReadKey($true);" ^
    "      if ($k.Key -eq [ConsoleKey]::Escape) { break }" ^
    "      Write-Host -NoNewline ('\\n[Ввод команды]: ' + $k.KeyChar);" ^
    "      $cmd = $k.KeyChar + [Console]::ReadLine();" ^
    "      if ($cmd.Trim().Length -gt 0) {" ^
    "        $port.WriteLine($cmd.Trim());" ^
    "        Write-Host ('>>> Отправлено: ' + $cmd.Trim()) -ForegroundColor Cyan;" ^
    "      }" ^
    "    }" ^
    "    Start-Sleep -Milliseconds 15;" ^
    "  }" ^
    "} catch {" ^
    "  Write-Host ('❌ Не удалось открыть ' + $portName + ': ' + $_.Exception.Message) -ForegroundColor Red;" ^
    "  Write-Host 'Совет: Если порт занят, закройте Arduino IDE, VS Code или esptool.' -ForegroundColor Yellow;" ^
    "} finally {" ^
    "  if ($port -and $port.IsOpen) { $port.Close() }" ^
    "}"

echo.
echo Монитор порта закрыт.
pause
`;

  // 3. .github/workflows/build_and_release.yml (Arduino CLI + Auto-Versioning + Release)
  const githubActionsWorkflow = `name: Build and Release ESP32 Firmware

on:
  push:
    branches:
      - main
      - master
    paths:
      - 'src/**'
      - 'StairsEsp/**'
      - 'include/**'
      - 'platformio.ini'
      - 'version.json'
      - 'flash_windows.bat'
      - 'flasher.bat'
      - 'terminal.bat'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Arduino CLI
        uses: arduino/setup-arduino-cli@v2

      - name: Install ESP32 Core
        run: |
          arduino-cli config init
          arduino-cli config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
          arduino-cli core update-index
          arduino-cli core install esp32:esp32@2.0.17

      - name: Install Arduino Libraries
        run: |
          arduino-cli lib install FastLED@3.6.0
          arduino-cli lib install ArduinoJson@7.0.4
          arduino-cli lib install NTPClient@3.2.1
          mkdir -p ~/Arduino/libraries/
          git clone https://github.com/me-no-dev/ESPAsyncWebServer.git ~/Arduino/libraries/ESPAsyncWebServer
          git clone https://github.com/me-no-dev/AsyncTCP.git ~/Arduino/libraries/AsyncTCP
          if [ -d "libraries" ]; then cp -r libraries/* ~/Arduino/libraries/; fi

      - name: Determine Next Version
        id: versioning
        run: |
          BUILD_NUM="\${{ github.run_number }}"
          TAG_NAME="v1.0.\${BUILD_NUM}"
          echo "CURRENT_TAG=\${TAG_NAME}" >> $GITHUB_ENV
          echo "BUILD_NUMBER=\${BUILD_NUM}" >> $GITHUB_ENV
          echo "VERSION=1.0.\${BUILD_NUM}" >> $GITHUB_ENV

          mkdir -p StairsEsp
          echo "#pragma once" > StairsEsp/version.h
          echo "#define FIRMWARE_VERSION \"1.0.\${BUILD_NUM}\"" >> StairsEsp/version.h
          echo "#define BUILD_TIMESTAMP __DATE__ \" \" __TIME__" >> StairsEsp/version.h
          if [ -d "src" ]; then cp StairsEsp/version.h src/version.h 2>/dev/null || true; fi

      - name: Compile Sketch with Arduino CLI
        run: |
          mkdir -p build_output
          if [ -d "src" ]; then
            cp src/*.h StairsEsp/ 2>/dev/null || true
          fi
          if [ ! -f "StairsEsp/StairsEsp.ino" ] && [ -f "src/main.cpp" ]; then
            mkdir -p StairsEsp
            cp src/main.cpp StairsEsp/StairsEsp.ino
          fi
          arduino-cli compile --fqbn esp32:esp32:esp32 StairsEsp/StairsEsp.ino --output-dir build_output

      - name: Package Flasher and Download esptool
        run: |
          cp build_output/StairsEsp.ino.bin build_output/firmware.bin 2>/dev/null || true
          cp build_output/StairsEsp.ino.bin "build_output/stairs_\${CURRENT_TAG}.bin" 2>/dev/null || true

          mkdir -p temp_zip
          curl -sL -o esptool_win.zip https://github.com/espressif/esptool/releases/download/v4.7.0/esptool-v4.7.0-win64.zip
          unzip -q esptool_win.zip -d temp_zip
          find temp_zip -name "esptool.exe" -exec cp {} build_output/esptool.exe \\;
          rm -rf temp_zip esptool_win.zip

          cp flash_windows.bat build_output/flash_windows.bat 2>/dev/null || cp flasher.bat build_output/flash_windows.bat 2>/dev/null || true
          cp terminal.bat build_output/terminal.bat 2>/dev/null || true
          sed -i 's/$/\\r/' build_output/flash_windows.bat 2>/dev/null || true
          sed -i 's/$/\\r/' build_output/terminal.bat 2>/dev/null || true

          echo "{" > build_output/version.json
          echo "  \"version\": \"\${VERSION}\"," >> build_output/version.json
          echo "  \"build\": \${BUILD_NUMBER}," >> build_output/version.json
          echo "  \"release_date\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\"," >> build_output/version.json
          echo "  \"bin_url\": \"https://github.com/\${{ github.repository }}/releases/download/\${CURRENT_TAG}/firmware.bin\"," >> build_output/version.json
          echo "  \"changelog\": \"Automated build from commit \${{ github.sha }}\"" >> build_output/version.json
          echo "}" >> build_output/version.json

          # Формируем готовый ZIP-архив релиза
          cd build_output
          zip -r "../esp32_stairs_flasher_\${CURRENT_TAG}.zip" *
          cd ..
          cp "esp32_stairs_flasher_\${CURRENT_TAG}.zip" build_output/

      - name: Generate Release Notes and Changelog
        id: changelog
        run: |
          mkdir -p build_output
          
          # Get commit info
          COMMIT_MSG=$(git log -1 --pretty=format:"%B")
          COMMIT_AUTHOR=$(git log -1 --pretty=format:"%an")
          COMMIT_HASH=$(git log -1 --pretty=format:"%h")
          
          PREV_TAG=$(git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo "")
          
          echo "### 🚀 Релиз прошивки ESP32 \`\${CURRENT_TAG}\`" > build_output/release_notes.md
          echo "" >> build_output/release_notes.md
          echo "- **Версия:** \`\${CURRENT_TAG}\`" >> build_output/release_notes.md
          echo "- **Номер сборки:** \`#\${BUILD_NUMBER}\`" >> build_output/release_notes.md
          echo "- **Автор коммита:** **\${COMMIT_AUTHOR}** ([\`\${COMMIT_HASH}\`](https://github.com/\${{ github.repository }}/commit/\${{ github.sha }}))" >> build_output/release_notes.md
          echo "" >> build_output/release_notes.md
          echo "---" >> build_output/release_notes.md
          echo "### 📝 Что нового в этом обновлении:" >> build_output/release_notes.md
          echo "" >> build_output/release_notes.md
          echo "\`\`\`" >> build_output/release_notes.md
          echo "\${COMMIT_MSG}" >> build_output/release_notes.md
          echo "\`\`\`" >> build_output/release_notes.md
          echo "" >> build_output/release_notes.md
          
          if [ -n "$PREV_TAG" ]; then
            echo "#### 📋 Список изменений с версии \`\${PREV_TAG}\`:" >> build_output/release_notes.md
            git log --pretty=format:"- %s ([\`%h\`](https://github.com/\${{ github.repository }}/commit/%H))" \${PREV_TAG}..HEAD >> build_output/release_notes.md
            echo "" >> build_output/release_notes.md
          fi
          
          if [ -f "CHANGELOG.md" ]; then
            echo "" >> build_output/release_notes.md
            echo "---" >> build_output/release_notes.md
            echo "### 📄 Заметки из CHANGELOG.md:" >> build_output/release_notes.md
            cat CHANGELOG.md >> build_output/release_notes.md
            echo "" >> build_output/release_notes.md
          fi
          
          echo "" >> build_output/release_notes.md
          echo "---" >> build_output/release_notes.md
          echo "### ⚡ Как прошить контроллер:" >> build_output/release_notes.md
          echo "1. Скачайте архив **\`esp32_stairs_flasher_\${CURRENT_TAG}.zip\`** ниже из блока Assets." >> build_output/release_notes.md
          echo "2. Распакуйте архив в любую папку." >> build_output/release_notes.md
          echo "3. Подключите ESP32 по USB и запустите **\`flash_windows.bat\`**." >> build_output/release_notes.md
          echo "4. Скрипт прошьёт плату и запустит удобный мастер настройки прямо в терминале!" >> build_output/release_notes.md
          echo "" >> build_output/release_notes.md
          echo "### 📟 Монитор порта:" >> build_output/release_notes.md
          echo "Для просмотра логов и IP-адреса устройства запустите **\`terminal.bat\`**." >> build_output/release_notes.md

      - name: Upload Artifact
        uses: actions/upload-artifact@v4
        with:
          name: esp32-firmware-\${{ env.CURRENT_TAG }}
          path: build_output/

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
        with:
          tag_name: \${{ env.CURRENT_TAG }}
          name: "Smart Staircase Firmware \${{ env.CURRENT_TAG }}"
          body_path: build_output/release_notes.md
          generate_release_notes: true
          draft: false
          prerelease: false
          files: |
            build_output/esp32_stairs_flasher_\${{ env.CURRENT_TAG }}.zip
            build_output/firmware.bin
            build_output/stairs_\${{ env.CURRENT_TAG }}.bin
            build_output/StairsEsp.ino.bin
            build_output/StairsEsp.ino.bootloader.bin
            build_output/StairsEsp.ino.partitions.bin
            build_output/esptool.exe
            build_output/flash_windows.bat
            build_output/terminal.bat
            build_output/version.json
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

  // 3b. version.h
  const versionH = `/**
 * Firmware Version Header
 * Automatically updated by CI/CD Pipeline
 */
#pragma once

#define FIRMWARE_VERSION "${config.firmwareVersion || '1.0.0'}"
#define BUILD_TIMESTAMP __DATE__ " " __TIME__
`;

  // 3c. StairsEsp/StairsEsp.ino (Arduino IDE Main Sketch)
  const stairsEspIno = `/**
 * Smart Staircase Controller - Arduino IDE Sketch
 * ESP32 + WS2812B Addressable LED Strips + PIR / Radar Sensors + Solar Math + GitHub OTA
 */
#include <Arduino.h>
#include "config.h"
#include "version.h"
#include "solar_scheduler.h"
#include "led_controller.h"
#include "ota_manager.h"
#include "web_server.h"

// Hardware Sensors & Flags
volatile bool g_bottomTriggered = false;
volatile bool g_topTriggered = false;
unsigned long g_lastBottomTriggerTime = 0;
unsigned long g_lastTopTriggerTime = 0;

void IRAM_ATTR onBottomSensorISR() {
  g_bottomTriggered = true;
}

void IRAM_ATTR onTopSensorISR() {
  g_topTriggered = true;
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\\n==============================================");
  Serial.println("  ESP32 Smart Staircase Controller Initiated  ");
  Serial.printf("  Firmware: %s | Built: %s\\n", FIRMWARE_VERSION, BUILD_TIMESTAMP);
  Serial.println("==============================================\\n");

  // Setup Motion Sensor Pins with Internal Pull-Down
  pinMode(PIN_BOTTOM_PIR, INPUT_PULLDOWN);
  pinMode(PIN_TOP_PIR, INPUT_PULLDOWN);
  if (PIN_LDR_SENSOR > 0) {
    pinMode(PIN_LDR_SENSOR, INPUT);
  }

  attachInterrupt(digitalPinToInterrupt(PIN_BOTTOM_PIR), onBottomSensorISR, RISING);
  attachInterrupt(digitalPinToInterrupt(PIN_TOP_PIR), onTopSensorISR, RISING);

  // Initialize Subsystems
  LedController::init();
  SolarScheduler::init();
  WebServerManager::init();
  OtaManager::init();

  Serial.println("[OK] System initialized successfully.");
}

void loop() {
  unsigned long currentMillis = millis();

  // 1. Check Sensor Triggers with Debounce (500ms)
  if (g_bottomTriggered) {
    g_bottomTriggered = false;
    if (currentMillis - g_lastBottomTriggerTime > 500) {
      g_lastBottomTriggerTime = currentMillis;
      Serial.println("[SENSOR] Bottom sensor triggered -> Walking UP");
      if (SolarScheduler::isLightingAllowed()) {
        LedController::triggerUpward();
      } else {
        Serial.println("[SOLAR] Daylight detected: lighting wave suppressed.");
      }
    }
  }

  if (g_topTriggered) {
    g_topTriggered = false;
    if (currentMillis - g_lastTopTriggerTime > 500) {
      g_lastTopTriggerTime = currentMillis;
      Serial.println("[SENSOR] Top sensor triggered -> Walking DOWN");
      if (SolarScheduler::isLightingAllowed()) {
        LedController::triggerDownward();
      } else {
        Serial.println("[SOLAR] Daylight detected: lighting wave suppressed.");
      }
    }
  }

  // 2. Periodic Subsystems Update
  SolarScheduler::update();
  LedController::update();
  OtaManager::update();

  delay(5);
}
`;

  // 3. src/config.h
  const configH = `/**
 * Smart Staircase Controller Configuration
 * Generated for ESP32 + WS2812B Pixel Strip
 */
#pragma once
#include <Arduino.h>

// ================= PHYSICAL CONFIGURATION =================
#define NUM_STEPS          ${config.stepCount}        // Total number of stairs/steps
#define LEDS_PER_STEP      ${config.ledsPerStep}        // Number of WS2812B LEDs per step
#define TOTAL_LEDS         (NUM_STEPS * LEDS_PER_STEP)

// GPIO Pins (ESP32 DevKit V1)
#define PIN_LED_DATA       ${config.ledPin}       // Output to WS2812B Data In
#define PIN_BOTTOM_PIR     ${config.bottomSensorPin}       // Bottom Motion Sensor (PIR/Radar)
#define PIN_TOP_PIR        ${config.topSensorPin}       // Top Motion Sensor (PIR/Radar)
#define PIN_LDR_SENSOR     ${config.ldrSensorPin}       // Optional Analog Ambient Light Sensor

// ================= ANIMATION & LIGHTING =================
#define STEP_ANIM_SPEED_MS ${config.stepSpeedMs}       // Delay between lighting consecutive steps (ms)
#define STEP_FADE_SPEED_MS ${config.fadeSpeedMs}       // Smooth fade transition speed (ms)
#define HOLD_TIME_SECONDS  ${config.holdTimeSec}        // Time staircase stays lit after motion stops (s)
#define ACTIVE_BRIGHTNESS  ${config.activeBrightness}       // Maximum brightness when walking (0-255)
#define STANDBY_BRIGHTNESS ${config.standbyBrightness}        // Night standby glow brightness (0-255)

// Standby Mode: 0 = Off, 1 = First & Last Step Only, 2 = All Steps Dim, 3 = Soft Breathing
#define STANDBY_MODE_TYPE  ${config.standbyMode === 'off' ? 0 : config.standbyMode === 'edge_steps' ? 1 : config.standbyMode === 'all_dim' ? 2 : 3}

// Visual Lighting Effect: 0=Wave, 1=Smooth Fade, 2=Curtain Fill, 3=Center Spread, 4=Meteor Chase, 5=Firefly Sparkle, 6=Rainbow Flow
#define LIGHTING_EFFECT_MODE ${
  config.effectMode === 'smooth_fade_all' ? 1 :
  config.effectMode === 'curtain_fill' ? 2 :
  config.effectMode === 'center_spread' ? 3 :
  config.effectMode === 'meteor_chase' ? 4 :
  config.effectMode === 'firefly_sparkle' ? 5 :
  config.effectMode === 'rainbow_flow' ? 6 : 0
}

// ================= SOLAR & GEOLOCATION =================
#define DEFAULT_LATITUDE   ${config.latitude}f    // Latitude for Sunset/Sunrise calculation
#define DEFAULT_LONGITUDE  ${config.longitude}f    // Longitude
#define TIMEZONE_OFFSET_H  ${config.timezoneOffsetHours}        // UTC Offset in hours (e.g. +3 for MSK)
#define SUNSET_OFFSET_MIN  ${config.sunsetOffsetMinutes}       // Start lighting 30 min before sunset
#define SUNRISE_OFFSET_MIN ${config.sunriseOffsetMinutes}         // Stop lighting at sunrise

#define NTP_SERVER_NAME    "${config.ntpServer || 'pool.ntp.org'}"

// ================= WI-FI & GITHUB OTA =================
#define DEFAULT_WIFI_SSID  "${config.wifiSsid || 'MyHomeWiFi'}"
#define DEFAULT_WIFI_PASS  "${config.wifiPassword || 'SuperSecretPassword'}"
#define AP_SSID_NAME       "${config.apSsid || 'ESP32-Staircase-Setup'}"
#define AP_PASSWORD_NAME   "${config.apPassword || '12345678'}"

// GitHub Auto-OTA Repository
#define GITHUB_USER        "${config.githubUsername || 'geminibitok-oss'}"
#define GITHUB_REPO        "${config.githubRepo || 'ESP32-Smart-Staircase-Controller'}"
#define GITHUB_BRANCH      "${config.githubBranch || 'main'}"
#define OTA_CHECK_MINUTES  ${config.otaCheckIntervalMinutes}       // Check GitHub for new releases every X min

#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION   "${config.firmwareVersion}"
#endif
`;

  // 4. src/solar_scheduler.h
  const solarSchedulerH = `/**
 * Solar & Astronomical Calculation Engine
 * Accurately calculates Sunset and Sunrise without external API dependencies.
 * Uses exact solar declination and equation of time.
 */
#pragma once
#include <Arduino.h>
#include <time.h>
#include <WiFi.h>
#include "config.h"

class SolarScheduler {
public:
    int sunriseMinuteOfDay = 360;  // Default 06:00
    int sunsetMinuteOfDay = 1200;  // Default 20:00
    bool timeSynchronized = false;
    
    void begin() {
        // Configure standard SNTP
        configTime(TIMEZONE_OFFSET_H * 3600, 0, NTP_SERVER_NAME, "time.nist.gov", "time.google.com");
        Serial.println("[SOLAR] Initializing NTP synchronization...");
    }

    void updateTime() {
        struct tm timeinfo;
        if (!getLocalTime(&timeinfo, 2000)) {
            Serial.println("[SOLAR] Waiting for NTP time sync...");
            return;
        }
        timeSynchronized = true;

        // Calculate astronomical sunrise and sunset for current day of year
        int dayOfYear = timeinfo.tm_yday; // 0 - 365
        calculateSunTimes(DEFAULT_LATITUDE, DEFAULT_LONGITUDE, dayOfYear, TIMEZONE_OFFSET_H);
    }

    /**
     * Checks if current time is within active illumination window:
     * Starts (Sunset + SUNSET_OFFSET_MIN) -> Ends (Sunrise + SUNRISE_OFFSET_MIN)
     */
    bool isNightTimeActive() {
        if (!timeSynchronized) {
            // Fallback if Wi-Fi/NTP is unavailable: activate based on LDR if available, or default active
            return true;
        }

        struct tm timeinfo;
        if (!getLocalTime(&timeinfo, 500)) return true;

        int currentMin = timeinfo.tm_hour * 60 + timeinfo.tm_min;

        int turnOnMinute = sunsetMinuteOfDay + SUNSET_OFFSET_MIN;   // Sunset - 30 minutes
        int turnOffMinute = sunriseMinuteOfDay + SUNRISE_OFFSET_MIN; // Sunrise

        // Wrap around midnight logic (e.g. Turn on at 18:30 (1110), Turn off at 06:00 (360))
        if (turnOnMinute > turnOffMinute) {
            return (currentMin >= turnOnMinute || currentMin < turnOffMinute);
        } else {
            return (currentMin >= turnOnMinute && currentMin < turnOffMinute);
        }
    }

    String getFormattedCurrentTime() {
        struct tm timeinfo;
        if (!getLocalTime(&timeinfo, 200)) return "00:00:00 (NTP Pending)";
        char buf[32];
        strftime(buf, sizeof(buf), "%H:%M:%S (%d.%m.%Y)", &timeinfo);
        return String(buf);
    }

    String getFormattedSunset() {
        int h = sunsetMinuteOfDay / 60;
        int m = sunsetMinuteOfDay % 60;
        char buf[16];
        snprintf(buf, sizeof(buf), "%02d:%02d", h, m);
        return String(buf);
    }

    String getFormattedSunrise() {
        int h = sunriseMinuteOfDay / 60;
        int m = sunriseMinuteOfDay % 60;
        char buf[16];
        snprintf(buf, sizeof(buf), "%02d:%02d", h, m);
        return String(buf);
    }

private:
    void calculateSunTimes(float lat, float lon, int dayOfYear, int tzOffset) {
        // High precision astronomical NOAA algorithm
        float gamma = 2.0f * PI / 365.0f * (dayOfYear - 1);
        
        // Equation of time (in minutes)
        float eqtime = 229.18f * (0.000075f + 0.001868f * cos(gamma) - 0.032077f * sin(gamma) 
                       - 0.014615f * cos(2 * gamma) - 0.040849f * sin(2 * gamma));
        
        // Solar declination angle (radians)
        float decl = 0.006918f - 0.399912f * cos(gamma) + 0.070257f * sin(gamma) 
                     - 0.006758f * cos(2 * gamma) + 0.000907f * sin(2 * gamma);

        float latRad = lat * DEG_TO_RAD;
        float zenith = 90.833f * DEG_TO_RAD; // Standard atmospheric refraction zenith

        float cosHourAngle = (cos(zenith) / (cos(latRad) * cos(decl))) - (tan(latRad) * tan(decl));

        if (cosHourAngle > 1.0f) {
            // Polar night (sun never rises)
            sunriseMinuteOfDay = 0;
            sunsetMinuteOfDay = 0;
            return;
        }
        if (cosHourAngle < -1.0f) {
            // Midnight sun (sun never sets)
            sunriseMinuteOfDay = 0;
            sunsetMinuteOfDay = 1440;
            return;
        }

        float hourAngle = acos(cosHourAngle) * RAD_TO_DEG; // degrees
        
        // Solar noon in minutes (UTC)
        float solarNoonUtc = 720.0f - (4.0f * lon) - eqtime;

        // Sunrise and Sunset in minutes (Local Time)
        sunriseMinuteOfDay = (int)(solarNoonUtc - (hourAngle * 4.0f) + (tzOffset * 60));
        sunsetMinuteOfDay  = (int)(solarNoonUtc + (hourAngle * 4.0f) + (tzOffset * 60));

        // Normalize within 0-1440 min
        if (sunriseMinuteOfDay < 0) sunriseMinuteOfDay += 1440;
        if (sunsetMinuteOfDay < 0) sunsetMinuteOfDay += 1440;

        Serial.printf("[SOLAR] Calculated for Day %d -> Sunrise: %02d:%02d, Sunset: %02d:%02d (Active Window: %02d:%02d to %02d:%02d)\\n",
                      dayOfYear, 
                      sunriseMinuteOfDay / 60, sunriseMinuteOfDay % 60,
                      sunsetMinuteOfDay / 60, sunsetMinuteOfDay % 60,
                      (sunsetMinuteOfDay + SUNSET_OFFSET_MIN) / 60, (sunsetMinuteOfDay + SUNSET_OFFSET_MIN) % 60,
                      sunriseMinuteOfDay / 60, sunriseMinuteOfDay % 60);
    }
};
`;

  // 5. src/led_controller.h
  const ledControllerH = `/**
 * WS2812B Addressable LED Staircase Animation Engine
 * Smooth step-by-step ripples, direction sensing, crossfades, and standby night light.
 */
#pragma once
#include <FastLED.h>
#include "config.h"

enum Direction {
    DIR_NONE,
    DIR_UP,     // Moving Bottom -> Top
    DIR_DOWN    // Moving Top -> Bottom
};

enum StairState {
    STATE_IDLE_DAY,       // Daylight - LEDs completely off
    STATE_STANDBY_NIGHT,  // Nighttime - subtle low glow or edge markers
    STATE_ANIMATING_IN,   // Step-by-step turning ON in trigger direction
    STATE_FULL_ACTIVE,    // Fully lit while dwell timer counts down
    STATE_ANIMATING_OUT,  // Step-by-step turning OFF in walk direction
    STATE_OTA_BUSY        // Flashing blue progress during firmware update
};

class StairLedController {
public:
    CRGB leds[TOTAL_LEDS];
    StairState currentState = STATE_IDLE_DAY;
    Direction currentDirection = DIR_NONE;
    
    CRGB primaryColor = CRGB(255, 180, 80); // Warm cozy incandescent amber
    uint8_t currentStepProgress = 0;
    unsigned long lastStepTime = 0;
    unsigned long motionHoldTimer = 0;

    void begin() {
        FastLED.addLeds<WS2812B, PIN_LED_DATA, GRB>(leds, TOTAL_LEDS).setCorrection(TypicalLEDStrip);
        FastLED.setBrightness(ACTIVE_BRIGHTNESS);
        FastLED.clear(true);
        Serial.println("[LEDS] FastLED initialized for " + String(NUM_STEPS) + " steps (" + String(TOTAL_LEDS) + " total LEDs)");
    }

    void setColor(uint8_t r, uint8_t g, uint8_t b) {
        primaryColor = CRGB(r, g, b);
    }

    /**
     * Trigger from Bottom Sensor (Walking UP)
     */
    void triggerBottom() {
        if (currentState == STATE_FULL_ACTIVE || currentState == STATE_ANIMATING_IN) {
            // Extend hold timer if already active
            motionHoldTimer = millis();
            return;
        }
        Serial.println("[MOTION] Bottom sensor triggered -> Lighting UP");
        currentDirection = DIR_UP;
        currentStepProgress = 0;
        currentState = STATE_ANIMATING_IN;
        lastStepTime = millis();
        motionHoldTimer = millis();
    }

    /**
     * Trigger from Top Sensor (Walking DOWN)
     */
    void triggerTop() {
        if (currentState == STATE_FULL_ACTIVE || currentState == STATE_ANIMATING_IN) {
            // Extend hold timer
            motionHoldTimer = millis();
            return;
        }
        Serial.println("[MOTION] Top sensor triggered -> Lighting DOWN");
        currentDirection = DIR_DOWN;
        currentStepProgress = 0;
        currentState = STATE_ANIMATING_IN;
        lastStepTime = millis();
        motionHoldTimer = millis();
    }

    /**
     * Main animation tick - call repeatedly in loop()
     */
    void update(bool isSolarNightActive) {
        unsigned long now = millis();

        switch (currentState) {
            case STATE_IDLE_DAY:
                if (isSolarNightActive) {
                    currentState = STATE_STANDBY_NIGHT;
                }
                FastLED.clear();
                FastLED.show();
                break;

            case STATE_STANDBY_NIGHT:
                if (!isSolarNightActive) {
                    currentState = STATE_IDLE_DAY;
                    FastLED.clear();
                    FastLED.show();
                    break;
                }
                renderStandbyGlow();
                FastLED.show();
                break;

            case STATE_ANIMATING_IN:
                if (now - lastStepTime >= STEP_ANIM_SPEED_MS) {
                    lastStepTime = now;
                    
                    int stepToLight = (currentDirection == DIR_UP) 
                        ? currentStepProgress 
                        : (NUM_STEPS - 1 - currentStepProgress);

                    lightUpStep(stepToLight, primaryColor, ACTIVE_BRIGHTNESS);
                    FastLED.show();

                    currentStepProgress++;
                    if (currentStepProgress >= NUM_STEPS) {
                        currentState = STATE_FULL_ACTIVE;
                        motionHoldTimer = now;
                    }
                }
                break;

            case STATE_FULL_ACTIVE:
                // Keep fully lit for HOLD_TIME_SECONDS
                if (now - motionHoldTimer >= (HOLD_TIME_SECONDS * 1000UL)) {
                    Serial.println("[STAIRS] Hold time expired -> Starting fade out");
                    currentState = STATE_ANIMATING_OUT;
                    currentStepProgress = 0;
                    lastStepTime = now;
                }
                break;

            case STATE_ANIMATING_OUT:
                if (now - lastStepTime >= STEP_ANIM_SPEED_MS) {
                    lastStepTime = now;

                    int stepToDim = (currentDirection == DIR_UP) 
                        ? currentStepProgress 
                        : (NUM_STEPS - 1 - currentStepProgress);

                    // Dim step off or back to standby
                    clearStep(stepToDim);
                    FastLED.show();

                    currentStepProgress++;
                    if (currentStepProgress >= NUM_STEPS) {
                        currentState = isSolarNightActive ? STATE_STANDBY_NIGHT : STATE_IDLE_DAY;
                        currentDirection = DIR_NONE;
                    }
                }
                break;

            case STATE_OTA_BUSY:
                // OTA Animation: pulse or step progress
                renderOtaAnimation();
                FastLED.show();
                break;
        }
    }

    void setOtaMode(bool active) {
        if (active) {
            currentState = STATE_OTA_BUSY;
        } else {
            currentState = STATE_IDLE_DAY;
            FastLED.clear(true);
        }
    }

    void resetOtaMode() {
        currentState = STATE_IDLE_DAY;
        FastLED.clear(true);
    }

    void showOtaFlashingEffect() {
        currentState = STATE_OTA_BUSY;
        renderOtaAnimation();
        FastLED.show();
    }

private:
    void lightUpStep(int stepIndex, CRGB color, uint8_t brightness) {
        if (stepIndex < 0 || stepIndex >= NUM_STEPS) return;
        int startIdx = stepIndex * LEDS_PER_STEP;
        for (int i = 0; i < LEDS_PER_STEP; i++) {
            leds[startIdx + i] = color;
        }
    }

    void clearStep(int stepIndex) {
        if (stepIndex < 0 || stepIndex >= NUM_STEPS) return;
        int startIdx = stepIndex * LEDS_PER_STEP;
        for (int i = 0; i < LEDS_PER_STEP; i++) {
            leds[startIdx + i] = CRGB::Black;
        }
    }

    void renderStandbyGlow() {
        FastLED.clear();
#if STANDBY_MODE_TYPE == 1
        // First and Last step subtle glow
        lightUpStep(0, primaryColor, STANDBY_BRIGHTNESS);
        lightUpStep(NUM_STEPS - 1, primaryColor, STANDBY_BRIGHTNESS);
#elif STANDBY_MODE_TYPE == 2
        // All steps dim glow
        for (int s = 0; s < NUM_STEPS; s++) {
            lightUpStep(s, primaryColor, STANDBY_BRIGHTNESS);
        }
#elif STANDBY_MODE_TYPE == 3
        // Soft breathing pulse
        uint8_t breath = beatsin8(15, STANDBY_BRIGHTNESS / 3, STANDBY_BRIGHTNESS);
        for (int s = 0; s < NUM_STEPS; s++) {
            lightUpStep(s, primaryColor, breath);
        }
#endif
    }

    void renderOtaAnimation() {
        static uint8_t hue = 140; // Cyan-Blue
        uint8_t beat = beatsin8(40, 50, 255);
        for (int i = 0; i < TOTAL_LEDS; i++) {
            leds[i] = CHSV(hue + (i * 2), 220, beat);
        }
    }
};
`;

  // 6. src/ota_manager.h
  const otaManagerH = `/**
 * GitHub Releases Auto-OTA Manager
 * Periodically queries GitHub repository for version.json and downloads firmware.bin
 * Supports TLS / SSL redirects directly from GitHub Release Assets.
 */
#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include "config.h"

class OtaManager {
public:
    unsigned long lastCheckTime = 0;
    bool isUpdating = false;
    uint8_t progressPercent = 0;
    String statusMessage = "idle";
    String lastError = "";
    bool autoOtaEnabled = true;

    static bool isRemoteNewer(const String& remoteVer, int remoteBuild, const String& localVer, int localBuild) {
        if (remoteVer.length() == 0) return false;

        int rMajor = 0, rMinor = 0, rPatch = 0;
        int lMajor = 0, lMinor = 0, lPatch = 0;

        sscanf(remoteVer.c_str(), "%d.%d.%d", &rMajor, &rMinor, &rPatch);
        sscanf(localVer.c_str(), "%d.%d.%d", &lMajor, &lMinor, &lPatch);

        if (rMajor > lMajor) return true;
        if (rMajor < lMajor) return false;

        if (rMinor > lMinor) return true;
        if (rMinor < lMinor) return false;

        if (rPatch > lPatch) return true;
        if (rPatch < lPatch) return false;

        if (remoteBuild > localBuild) return true;

        return false;
    }

    void begin() {
        Serial.println("[OTA] GitHub Auto-OTA Manager initialized.");
        Serial.printf("[OTA] Target Repository: %s/%s on branch '%s'\\n", GITHUB_USER, GITHUB_REPO, GITHUB_BRANCH);
        Serial.printf("[OTA] Current Firmware Version: %s (Build #%d)\\n", FIRMWARE_VERSION, FIRMWARE_BUILD);
    }

    String getOtaStatusJson() {
        JsonDocument doc;
        doc["is_updating"] = isUpdating;
        doc["progress"] = progressPercent;
        doc["status"] = statusMessage;
        doc["error"] = lastError;
        doc["current_version"] = FIRMWARE_VERSION;
        doc["auto_ota"] = autoOtaEnabled;
        String out;
        serializeJson(doc, out);
        return out;
    }

    bool triggerCustomUpdate(String binUrl, void (*onStartUpdate)() = nullptr, void (*onUpdateFailed)(String err) = nullptr, void (*onUpdateSuccess)() = nullptr) {
        if (isUpdating) {
            Serial.println("[OTA] Update already in progress.");
            return false;
        }
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("[OTA] WiFi not connected. Cannot download firmware.");
            lastError = "WiFi not connected";
            return false;
        }
        Serial.println("[OTA] 🚀 Manual OTA Triggered for URL: " + binUrl);
        return performOtaUpdate(binUrl, onStartUpdate, onUpdateFailed, onUpdateSuccess);
    }

    void handle(void (*onStartUpdate)() = nullptr, void (*onUpdateFailed)(String err) = nullptr, void (*onUpdateSuccess)() = nullptr) {
        if (!autoOtaEnabled || WiFi.status() != WL_CONNECTED || isUpdating) return;

        unsigned long now = millis();
        if (lastCheckTime == 0 || (now - lastCheckTime >= (OTA_CHECK_MINUTES * 60 * 1000UL))) {
            lastCheckTime = now;
            checkForUpdate(onStartUpdate, onUpdateFailed, onUpdateSuccess);
        }
    }

    void checkForUpdate(void (*onStartUpdate)() = nullptr, void (*onUpdateFailed)(String err) = nullptr, void (*onUpdateSuccess)() = nullptr) {
        Serial.println("[OTA] Checking GitHub for new firmware version...");

        WiFiClientSecure client;
        client.setInsecure();

        HTTPClient http;
        String url = "https://raw.githubusercontent.com/" + String(GITHUB_USER) + "/" + String(GITHUB_REPO) + "/" + String(GITHUB_BRANCH) + "/version.json";
        
        http.begin(client, url);
        http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
        http.setTimeout(10000);

        int httpCode = http.GET();
        if (httpCode == HTTP_CODE_OK) {
            String payload = http.getString();
            Serial.println("[OTA] Received version manifest: " + payload);

            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, payload);

            if (!error) {
                String remoteVersion = doc["version"].as<String>();
                int remoteBuild = doc["build"].as<int>();
                String binUrl = doc["bin_url"].as<String>();

                Serial.printf("[OTA] Local: %s (Build #%d) | Remote: %s (Build #%d)\\n", FIRMWARE_VERSION, FIRMWARE_BUILD, remoteVersion.c_str(), remoteBuild);

                if (isRemoteNewer(remoteVersion, remoteBuild, FIRMWARE_VERSION, FIRMWARE_BUILD) && binUrl.length() > 0) {
                    Serial.println("[OTA] ⚡ NEW FIRMWARE DETECTED! Initiating over-the-air flash...");
                    performOtaUpdate(binUrl, onStartUpdate, onUpdateFailed, onUpdateSuccess);
                } else {
                    Serial.println("[OTA] Firmware is up to date. No update needed.");
                }
            } else {
                Serial.println("[OTA] Failed to parse version.json: " + String(error.c_str()));
            }
        } else {
            Serial.printf("[OTA] HTTP check failed, error: %s (code: %d)\\n", http.errorToString(httpCode).c_str(), httpCode);
        }
        http.end();
    }

private:
    bool performOtaUpdate(String binUrl, void (*onStartUpdate)() = nullptr, void (*onUpdateFailed)(String err) = nullptr, void (*onUpdateSuccess)() = nullptr) {
        if (onStartUpdate) onStartUpdate();
        isUpdating = true;
        progressPercent = 10;
        statusMessage = "downloading";
        lastError = "";

        WiFiClientSecure secureClient;
        secureClient.setInsecure();

        httpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
        httpUpdate.rebootOnUpdate(true);

        progressPercent = 30;
        statusMessage = "flashing";
        Serial.println("[OTA] Downloading binary from: " + binUrl);
        t_httpUpdate_return ret = httpUpdate.update(secureClient, binUrl);

        switch (ret) {
            case HTTP_UPDATE_FAILED:
                lastError = httpUpdate.getLastErrorString();
                statusMessage = "failed";
                progressPercent = 0;
                Serial.printf("[OTA] Update FAILED! Error (%d): %s\\n", httpUpdate.getLastError(), lastError.c_str());
                isUpdating = false;
                if (onUpdateFailed) onUpdateFailed(lastError);
                return false;
            case HTTP_UPDATE_NO_UPDATES:
                statusMessage = "no_updates";
                progressPercent = 100;
                Serial.println("[OTA] No updates available.");
                isUpdating = false;
                if (onUpdateFailed) onUpdateFailed("No updates available");
                return false;
            case HTTP_UPDATE_OK:
                statusMessage = "success";
                progressPercent = 100;
                Serial.println("[OTA] UPDATE SUCCESSFUL! Rebooting ESP32 into new firmware...");
                if (onUpdateSuccess) onUpdateSuccess();
                return true;
        }
        isUpdating = false;
        if (onUpdateFailed) onUpdateFailed("Unknown error");
        return false;
    }
};
`;

  // 7. src/web_server.h
  const webServerH = `/**
 * Embedded Web Configuration Interface & REST API with full WiFi & parameter management
 */
#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <Update.h>
#include <Preferences.h>
#include "config.h"

static const char INDEX_HTML[] PROGMEM = R"rawliteral(<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <title>ESP32 Smart Staircase Controller</title>
    <style>
        :root {
            --bg: #0b0f19;
            --surface: #111827;
            --card: #1f2937;
            --card-hover: #374151;
            --border: #374151;
            --accent: #3b82f6;
            --accent-glow: rgba(59, 130, 246, 0.4);
            --amber: #f59e0b;
            --emerald: #10b981;
            --purple: #8b5cf6;
            --text-main: #f9fafb;
            --text-muted: #9ca3af;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: var(--bg);
            color: var(--text-main);
            padding: 12px;
            display: flex;
            justify-content: center;
            min-height: 100vh;
        }
        .container {
            width: 100%;
            max-width: 640px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 18px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        /* Header */
        .app-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border);
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .brand-icon {
            font-size: 24px;
            background: #1e1b4b;
            border: 1px solid #4338ca;
            border-radius: 12px;
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .brand-title {
            font-size: 16px;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: -0.3px;
        }
        .brand-sub {
            font-size: 11px;
            color: var(--text-muted);
        }
        .badge-ver {
            background: #1e293b;
            border: 1px solid #38bdf8;
            color: #38bdf8;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            font-family: monospace;
        }

        /* Top Metrics Bar */
        .metric-row {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        .metric-card {
            background: #131d2e;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .metric-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .metric-val { font-size: 13px; font-weight: 700; color: #38bdf8; }

        /* Tabs Bar */
        .tabs-bar {
            display: flex;
            gap: 6px;
            background: #0d131f;
            padding: 4px;
            border-radius: 14px;
            overflow-x: auto;
            scrollbar-width: none;
        }
        .tabs-bar::-webkit-scrollbar { display: none; }
        .tab-btn {
            flex: 1;
            padding: 9px 12px;
            border: none;
            background: transparent;
            color: var(--text-muted);
            border-radius: 10px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.2s;
        }
        .tab-btn.active {
            background: var(--accent);
            color: #ffffff;
            box-shadow: 0 4px 12px var(--accent-glow);
        }

        .tab-panel { display: none; }
        .tab-panel.active { display: block; animation: fadeTab 0.25s ease-in-out; }
        @keyframes fadeTab { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

        /* Section Headings */
        .sec-title {
            font-size: 14px;
            font-weight: 700;
            color: #e2e8f0;
            margin: 14px 0 8px 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        /* 3D Interactive Stair Simulator */
        .sim-container {
            background: #0a0e17;
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            position: relative;
            overflow: hidden;
        }
        .sim-staircase {
            display: flex;
            flex-direction: column-reverse;
            gap: 4px;
            width: 100%;
            max-width: 320px;
            perspective: 800px;
            margin: 8px 0;
        }
        .sim-step {
            height: 14px;
            border-radius: 4px;
            background: #1f2937;
            border: 1px solid #374151;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 8px;
            font-size: 9px;
            font-family: monospace;
            color: #6b7280;
        }
        .sim-step.active {
            background: #ffb450;
            border-color: #fde047;
            box-shadow: 0 0 16px rgba(255, 180, 80, 0.8), 0 0 30px rgba(255, 180, 80, 0.4);
            color: #1f2937;
            font-weight: bold;
        }
        .sim-step.standby {
            background: #78350f;
            border-color: #b45309;
            box-shadow: 0 0 6px rgba(245, 158, 11, 0.3);
            color: #fef3c7;
        }

        /* Trigger Action Buttons */
        .trigger-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 12px;
        }
        .btn-trigger {
            padding: 12px;
            border: none;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            transition: transform 0.1s, box-shadow 0.2s;
        }
        .btn-trigger:active { transform: scale(0.97); }
        .btn-trigger-up {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: #ffffff;
            box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
        }
        .btn-trigger-down {
            background: linear-gradient(135deg, #d97706, #b45309);
            color: #ffffff;
            box-shadow: 0 6px 16px rgba(217, 119, 6, 0.3);
        }

        /* Palette Swatches */
        .color-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 12px;
        }
        .color-pill {
            padding: 8px 6px;
            border: 2px solid transparent;
            border-radius: 10px;
            background: #111827;
            color: #e5e7eb;
            font-size: 11px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .color-pill:hover { border-color: #4b5563; }
        .color-pill.active { border-color: #38bdf8; background: #1e293b; }
        .color-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            flex-shrink: 0;
            box-shadow: 0 0 6px rgba(0,0,0,0.5);
        }

        /* Forms & Inputs */
        .form-group {
            margin-bottom: 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .form-row-split {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        .form-label {
            font-size: 12px;
            color: var(--text-muted);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .form-label span { color: #38bdf8; font-weight: 700; font-family: monospace; }
        input[type="text"], input[type="password"], input[type="number"], select {
            width: 100%;
            padding: 10px 12px;
            background: #0f172a;
            border: 1px solid var(--border);
            border-radius: 10px;
            color: #f9fafb;
            font-size: 13px;
            outline: none;
            transition: border-color 0.2s;
        }
        input:focus, select:focus { border-color: #38bdf8; }
        input[type="range"] {
            width: 100%;
            accent-color: #3b82f6;
            cursor: pointer;
        }
        input[type="color"] {
            width: 100%;
            height: 40px;
            border-radius: 10px;
            border: 1px solid var(--border);
            background: #0f172a;
            cursor: pointer;
            padding: 4px;
        }

        /* Action Buttons */
        .btn-action {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: opacity 0.2s, transform 0.1s;
        }
        .btn-action:hover { opacity: 0.95; }
        .btn-action:active { transform: scale(0.98); }
        .btn-emerald { background: linear-gradient(135deg, #059669, #10b981); color: #fff; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3); }
        .btn-indigo { background: linear-gradient(135deg, #4f46e5, #6366f1); color: #fff; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3); }
        .btn-rose { background: linear-gradient(135deg, #dc2626, #ef4444); color: #fff; }

        /* Live Sensor Pills */
        .sensor-status-box {
            background: #0a0e17;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 12px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 12px;
        }
        .sensor-pill {
            background: #111827;
            border: 1px solid #374151;
            padding: 8px 10px;
            border-radius: 8px;
            font-size: 11px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .sensor-pill strong { font-size: 12px; }

        /* Card Guides */
        .guide-banner {
            background: #1e1b4b;
            border: 1px solid #4338ca;
            border-radius: 12px;
            padding: 12px;
            font-size: 12px;
            line-height: 1.5;
            color: #c7d2fe;
            margin-bottom: 12px;
        }
        .guide-banner strong { color: #facc15; }

        /* OTA Modal */
        #otaModal {
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(11, 15, 25, 0.94);
            z-index: 10000;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .modal-box {
            background: #1f2937;
            border: 1px solid #6366f1;
            border-radius: 20px;
            padding: 24px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px rgba(0,0,0,0.8);
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="app-header">
            <div class="brand">
                <div class="brand-icon">🪜</div>
                <div>
                    <div class="brand-title">Умная Лестница ESP32</div>
                    <div class="brand-sub">WS2812B & Radar Motion Hub</div>
                </div>
            </div>
            <div class="badge-ver">v1.0.14</div>
        </div>

        <!-- Telemetry Summary -->
        <div class="metric-row">
            <div class="metric-card">
                <span class="metric-label">Ступени / Всего LED</span>
                <span class="metric-val" id="dispSteps">16 / 480 шт</span>
            </div>
            <div class="metric-card">
                <span class="metric-label">Сеть / IP адрес</span>
                <span class="metric-val" id="dispIp">192.168.4.1 (AP)</span>
            </div>
            <div class="metric-card">
                <span class="metric-label">Пины (Лента / Датчики)</span>
                <span class="metric-val" id="dispPins">GPIO 4 / 22, 23</span>
            </div>
            <div class="metric-card">
                <span class="metric-label">Астро-режим</span>
                <span class="metric-val" id="dispAstroStatus">Загрузка...</span>
            </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="tabs-bar">
            <button class="tab-btn active" onclick="switchTab('tab-control', this)">🎮 Управление</button>
            <button class="tab-btn" onclick="switchTab('tab-stairs', this)">🪜 Настройки</button>
            <button class="tab-btn" onclick="switchTab('tab-pins', this)">🔌 Пины GPIO</button>
            <button class="tab-btn" onclick="switchTab('tab-wifi', this)">📶 Wi-Fi</button>
            <button class="tab-btn" onclick="switchTab('tab-solar', this)">☀️ Солнце</button>
            <button class="tab-btn" onclick="switchTab('tab-ota', this)">⚡ OTA Прошивка</button>
        </div>

        <!-- TAB 1: Live Control & Simulator -->
        <div id="tab-control" class="tab-panel active">
            <div class="sec-title">🪜 Интерактивный 3D-Симулятор Лестницы</div>
            <div class="sim-container">
                <div class="sim-staircase" id="staircaseVisual">
                    <!-- Dynamic Steps Generated by JS -->
                </div>
                <div style="display:flex; justify-content:space-between; width:100%; font-size:11px; color:#9ca3af;">
                    <span>📍 Нижний датчик (GPIO 22)</span>
                    <span>📍 Верхний датчик (GPIO 23)</span>
                </div>
            </div>

            <div class="sec-title">🚶 Ручной триггер датчиков движения</div>
            <div class="trigger-grid">
                <button class="btn-trigger btn-trigger-up" onclick="triggerStairs('up')">
                    <span style="font-size:18px;">⬆️</span>
                    <span>Снизу Вверх</span>
                    <small style="opacity:0.8; font-size:10px;">Вход снизу</small>
                </button>
                <button class="btn-trigger btn-trigger-down" onclick="triggerStairs('down')">
                    <span style="font-size:18px;">⬇️</span>
                    <span>Сверху Вниз</span>
                    <small style="opacity:0.8; font-size:10px;">Вход сверху</small>
                </button>
            </div>

            <div class="sec-title">🎨 Палитра оттенков и пресеты</div>
            <div class="color-grid">
                <div class="color-pill active" onclick="applyColorPreset('#ffb450', this)"><div class="color-dot" style="background:#ffb450;"></div>2700K Уют</div>
                <div class="color-pill" onclick="applyColorPreset('#ff8a1e', this)"><div class="color-dot" style="background:#ff8a1e;"></div>2200K Янтарь</div>
                <div class="color-pill" onclick="applyColorPreset('#ffffff', this)"><div class="color-dot" style="background:#ffffff;"></div>4000K Белый</div>
                <div class="color-pill" onclick="applyColorPreset('#00f0ff', this)"><div class="color-dot" style="background:#00f0ff;"></div>Ледяной</div>
                <div class="color-pill" onclick="applyColorPreset('#a855f7', this)"><div class="color-dot" style="background:#a855f7;"></div>Неон</div>
                <div class="color-pill" onclick="applyColorPreset('#10b981', this)"><div class="color-dot" style="background:#10b981;"></div>Изумруд</div>
                <div class="color-pill" onclick="applyColorPreset('#3b82f6', this)"><div class="color-dot" style="background:#3b82f6;"></div>Океан</div>
                <div class="color-pill" onclick="applyColorPreset('#ec4899', this)"><div class="color-dot" style="background:#ec4899;"></div>Сакура</div>
            </div>

            <div class="form-group">
                <div class="form-label">
                    <span>Свой RGB цвет:</span>
                    <span id="lblHexVal">#ffb450</span>
                </div>
                <input type="color" id="colorPicker" value="#ffb450" onchange="applyCustomColor(this.value)">
            </div>

            <div class="form-group">
                <div class="form-label">
                    <label>Яркость при движении (Active Brightness):</label>
                    <span id="lblActBri">220</span>
                </div>
                <input type="range" id="inpActBri" min="10" max="255" value="220" oninput="document.getElementById('lblActBri').innerText=this.value">
            </div>

            <button class="btn-action btn-emerald" onclick="saveQuickParams()">💾 Применить параметры подсветки</button>
        </div>

        <!-- TAB 2: Staircase Settings -->
        <div id="tab-stairs" class="tab-panel">
            <div class="sec-title">🪜 Размеры и тайминги подсветки</div>
            <div class="form-row-split">
                <div class="form-group">
                    <label class="form-label">Количество ступеней:</label>
                    <input type="number" id="inpNumSteps" min="1" max="32" value="16">
                </div>
                <div class="form-group">
                    <label class="form-label">Диодов на ступень:</label>
                    <input type="number" id="inpLedsStep" min="1" max="60" value="30">
                </div>
            </div>

            <div class="form-group">
                <div class="form-label">
                    <label>Скорость шага волны (шаг):</label>
                    <span id="lblSpeed">60 мс</span>
                </div>
                <input type="range" id="inpSpeed" min="20" max="250" value="60" oninput="document.getElementById('lblSpeed').innerText=this.value+' мс'">
            </div>

            <div class="form-group">
                <div class="form-label">
                    <label>Время свечения после прохода (Hold):</label>
                    <span id="lblHold">15 с</span>
                </div>
                <input type="range" id="inpHold" min="3" max="60" value="15" oninput="document.getElementById('lblHold').innerText=this.value+' с'">
            </div>

            <div class="sec-title">🌙 Дежурная ночная подсветка (Standby)</div>
            <div class="form-group">
                <label class="form-label">Режим дежурной подсветки:</label>
                <select id="selSbMode">
                    <option value="0" selected>0 — Полностью выключено</option>
                    <option value="1" >1 — Первая и последняя ступени</option>
                    <option value="2" >2 — Все ступени на минимуме</option>
                    <option value="3" >3 — Плавное дыхание</option>
                </select>
            </div>

            <div class="form-group">
                <div class="form-label">
                    <label>Дежурная яркость (5-100):</label>
                    <span id="lblSbBri">20</span>
                </div>
                <input type="range" id="inpSbBri" min="5" max="100" value="20" oninput="document.getElementById('lblSbBri').innerText=this.value">
            </div>

            <button class="btn-action btn-emerald" onclick="saveAllStairsSettings()">💾 Сохранить параметры ступеней</button>
        </div>

        <!-- TAB 3: GPIO Pins & Sensor Hardware -->
        <div id="tab-pins" class="tab-panel">
            <div class="sec-title">🔌 Назначение выводов ESP32 (GPIO)</div>
            <div class="guide-banner">
                Текущее назначение: <strong>LED = GPIO 4</strong>, <strong>Нижний датчик = GPIO 22</strong>, <strong>Верхний датчик = GPIO 23</strong>.
            </div>

            <div class="form-group">
                <label class="form-label">🔴 Сигнал светодиодной ленты WS2812B (Data Out):</label>
                <select id="selPinLed">
                    <option value="4" selected>GPIO 4 (Рекомендуется)</option>
                    <option value="18" >GPIO 18</option>
                    <option value="19" >GPIO 19</option>
                    <option value="21" >GPIO 21</option>
                    <option value="22" >GPIO 22</option>
                    <option value="23" >GPIO 23</option>
                    <option value="16" >GPIO 16</option>
                    <option value="17" >GPIO 17</option>
                    <option value="25" >GPIO 25</option>
                    <option value="26" >GPIO 26</option>
                    <option value="27" >GPIO 27</option>
                </select>
            </div>

            <div class="form-row-split">
                <div class="form-group">
                    <label class="form-label">🟢 Нижний датчик (PIR):</label>
                    <select id="selPinBot">
                        <option value="22" selected>GPIO 22 (Установлен)</option>
                        <option value="19" >GPIO 19</option>
                        <option value="23" >GPIO 23</option>
                        <option value="21" >GPIO 21</option>
                        <option value="34" >GPIO 34</option>
                        <option value="35" >GPIO 35</option>
                        <option value="36" >GPIO 36</option>
                        <option value="39" >GPIO 39</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">🔵 Верхний датчик (PIR):</label>
                    <select id="selPinTop">
                        <option value="23" selected>GPIO 23 (Установлен)</option>
                        <option value="21" >GPIO 21</option>
                        <option value="22" >GPIO 22</option>
                        <option value="19" >GPIO 19</option>
                        <option value="35" >GPIO 35</option>
                        <option value="34" >GPIO 34</option>
                        <option value="36" >GPIO 36</option>
                        <option value="39" >GPIO 39</option>
                    </select>
                </div>
            </div>

            <div class="sec-title">⚙️ Логика и подтяжка входов</div>
            <div class="form-group">
                <label class="form-label">Полярность датчиков (Trigger Level):</label>
                <select id="selSensorHigh">
                    <option value="1" selected>Active HIGH (3.3V при движении — PIR HC-SR501, RCWL-0516, Радар 24G)</option>
                    <option value="0" >Active LOW (GND при движении — Оптические датчики NPN, кнопки)</option>
                </select>
            </div>

            <div class="form-group">
                <label class="form-label">Внутренняя подтяжка резисторов (Pull mode):</label>
                <select id="selPullMode">
                    <option value="0" selected>INPUT_PULLDOWN (К земле — рекомендуется для PIR)</option>
                    <option value="1" >INPUT_PULLUP (К 3.3V — для кнопок и NPN сенсоров)</option>
                    <option value="2" >INPUT (Без подтяжки)</option>
                </select>
            </div>

            <div class="sec-title">📡 Live-состояние датчиков в реальном времени</div>
            <div class="sensor-status-box">
                <div class="sensor-pill" id="pillBot">
                    <span>Нижний вход (GPIO 22):</span>
                    <strong id="liveBotText" style="color:#9ca3af;">⚪ Покой (LOW)</strong>
                </div>
                <div class="sensor-pill" id="pillTop">
                    <span>Верхний вход (GPIO 23):</span>
                    <strong id="liveTopText" style="color:#9ca3af;">⚪ Покой (LOW)</strong>
                </div>
            </div>

            <button class="btn-action btn-emerald" onclick="savePinsConfig()">💾 Сохранить конфигурацию пинов и перезагрузить</button>
        </div>

        <!-- TAB 4: Wi-Fi Settings -->
        <div id="tab-wifi" class="tab-panel">
            <div class="sec-title">📶 Подключение к домашней сети Wi-Fi</div>
            <div class="guide-banner">
                Контроллер подключается к вашей домашней сети. Если сеть недоступна, создаётся точка доступа <strong>ESP32-Staircase-Setup</strong> (пароль 12345678).
            </div>

            <div class="form-group">
                <div class="form-label">
                    <label>Имя сети (SSID):</label>
                    <button type="button" onclick="scanWifiNetworks()" style="background:#374151; color:#38bdf8; border:none; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer;">🔍 Сканировать эфир</button>
                </div>
                <input type="text" id="wifiSsid" placeholder="SSID вашей сети" value="">
                <select id="wifiListDropdown" style="display:none; margin-top:6px;" onchange="document.getElementById('wifiSsid').value=this.value"></select>
            </div>

            <div class="form-group">
                <label class="form-label">Пароль от Wi-Fi:</label>
                <input type="password" id="wifiPass" placeholder="Введите пароль">
            </div>

            <button class="btn-action btn-indigo" onclick="saveWifiCredentials()">💾 Подключиться к Wi-Fi и перезагрузить ESP32</button>
        </div>

        <!-- TAB 5: Solar & Location -->
        <div id="tab-solar" class="tab-panel">
            <div class="sec-title">☀️ Астрономический расчет заката и восхода</div>
            <div class="guide-banner">
                📍 <strong>Город:</strong> г. Борисов, Беларусь (54.23° N, 28.50° E)<br>
                ⏰ <strong>Часовой пояс:</strong> UTC+3 (Minsk / Moscow)<br>
                🌅 <strong>Включение:</strong> За 30 минут до наступления заката<br>
                🌇 <strong>Отключение:</strong> На рассвете<br>
                🌐 <strong>Синхронизация времени:</strong> NTP Сервер pool.ntp.org
            </div>
            <div class="metric-card" style="margin-bottom:12px;">
                <span class="metric-label">Текущее расчетное состояние:</span>
                <span class="metric-val" id="dispSolarFull" style="font-size:14px;">🌙 Ночной режим АКТИВЕН</span>
            </div>
        </div>

        <!-- TAB 6: GitHub Auto-OTA & Flashing -->
        <div id="tab-ota" class="tab-panel">
            <!-- Modal -->
            <div id="otaModal">
                <div class="modal-box">
                    <h3 style="color:#a5b4fc; font-size:18px; margin-bottom:8px;">⚡ Прошивка ESP32 по воздуху</h3>
                    <p id="otaModalDesc" style="font-size:12px; color:#cbd5e1; margin-bottom:16px;">Загрузка firmware.bin с GitHub и запись во Flash-память...</p>
                    <div style="background:#0f172a; border-radius:10px; overflow:hidden; height:16px; margin-bottom:12px; border:1px solid #374151;">
                        <div id="otaProgressBar" style="width:15%; height:100%; background:linear-gradient(90deg, #6366f1, #38bdf8); transition:width 0.3s ease;"></div>
                    </div>
                    <div id="otaPercentText" style="font-size:12px; font-weight:700; color:#38bdf8; font-family:monospace;">Скачивание... 15%</div>
                    <small style="color:#9ca3af; font-size:11px; margin-top:10px; display:block;">Не отключайте питание устройства!</small>
                </div>
            </div>

            <div class="sec-title">🌐 Автообновление с GitHub Releases</div>
            <div class="guide-banner" style="background:#1e1b4b; border-color:#4f46e5;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><strong>Репозиторий:</strong> <span>geminibitok-oss/ESP32-Smart-Staircase-Controller</span></div>
                    <button type="button" onclick="loadGitHubReleases()" style="background:#4338ca; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:11px; cursor:pointer;">🔄 Обновить</button>
                </div>
                <div style="margin-top:6px; font-size:11px;">
                    Выбирайте любую версию релиза и нажимайте <strong>«Установить»</strong>. ESP32 скачает прошивку и обновится в 1 клик!
                </div>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
                <label class="form-label">Автоматическая фоновая проверка релизов GitHub:</label>
                <select id="selAutoOta" onchange="toggleAutoOta(this.value)">
                    <option value="1" selected>Включено (Проверка каждые 120 минут)</option>
                    <option value="0" >Выключено (Только ручная проверка)</option>
                </select>
            </div>

            <div id="githubReleasesContainer" style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
                <div style="text-align:center; padding:15px; font-size:12px; color:#9ca3af;">⏳ Запрос версий с GitHub Releases...</div>
            </div>

            <div class="sec-title">📁 Загрузка .bin файла с компьютера</div>
            <form method="POST" action="/update" enctype="multipart/form-data" style="margin-bottom:14px;">
                <input type="file" name="update" accept=".bin" required style="margin-bottom:8px;">
                <button type="submit" class="btn-action btn-indigo">🚀 Загрузить локальный .bin файл</button>
            </form>

            <div class="sec-title">🔄 Перезагрузка микроконтроллера</div>
            <button onclick="restartEsp()" class="btn-action btn-rose">🔄 Перезагрузить ESP32</button>
        </div>
    </div>

    <script>
        const CURRENT_VERSION = "1.0.14";
        const GH_USER = "geminibitok-oss";
        const GH_REPO = "ESP32-Smart-Staircase-Controller";
        let totalConfigSteps = 16;
        let currentStepColor = "#ffb450";

        function switchTab(tabId, btn) {
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            const target = document.getElementById(tabId);
            if (target) target.classList.add('active');
            if (btn) btn.classList.add('active');

            if (tabId === 'tab-ota') loadGitHubReleases();
        }

        // Build 3D Visualizer Steps
        function buildVisualizer(stepsCount) {
            const container = document.getElementById('staircaseVisual');
            if (!container) return;
            container.innerHTML = '';
            for (let i = 1; i <= stepsCount; i++) {
                const step = document.createElement('div');
                step.className = 'sim-step';
                step.id = 'vstep-' + i;
                step.innerHTML = '<span>Ступень ' + i + '</span><span>' + (i === 1 ? '▼ Низ' : (i === stepsCount ? '▲ Верх' : '')) + '</span>';
                container.appendChild(step);
            }
        }
        buildVisualizer(totalConfigSteps);

        function triggerStairs(dir) {
            // Animate on visualizer immediately
            const steps = document.querySelectorAll('.sim-step');
            const speed = parseInt(document.getElementById('inpSpeed').value) || 80;
            
            const stepList = Array.from(steps);
            if (dir === 'down') stepList.reverse();

            stepList.forEach((st, idx) => {
                setTimeout(() => {
                    st.classList.add('active');
                    st.style.background = currentStepColor;
                }, idx * speed);
            });

            const holdMs = (parseInt(document.getElementById('inpHold').value) || 8) * 1000;
            setTimeout(() => {
                stepList.forEach((st, idx) => {
                    setTimeout(() => {
                        st.classList.remove('active');
                        st.style.background = '';
                    }, idx * (speed * 0.8));
                });
            }, holdMs + (stepList.length * speed));

            fetch('/api/trigger', { method: 'POST', body: new URLSearchParams({ dir }) });
        }

        function applyColorPreset(hex, el) {
            document.querySelectorAll('.color-pill').forEach(p => p.classList.remove('active'));
            if (el) el.classList.add('active');
            currentStepColor = hex;
            document.getElementById('colorPicker').value = hex;
            document.getElementById('lblHexVal').innerText = hex;
            sendColor(hex);
        }

        function applyCustomColor(hex) {
            document.querySelectorAll('.color-pill').forEach(p => p.classList.remove('active'));
            currentStepColor = hex;
            document.getElementById('lblHexVal').innerText = hex;
            sendColor(hex);
        }

        function sendColor(hex) {
            const r = parseInt(hex.substr(1,2), 16);
            const g = parseInt(hex.substr(3,2), 16);
            const b = parseInt(hex.substr(5,2), 16);
            fetch('/api/color', { method: 'POST', body: new URLSearchParams({ r, g, b }) });
        }

        function saveQuickParams() {
            const act_bright = document.getElementById('inpActBri').value;
            fetch('/api/save_config', { method: 'POST', body: new URLSearchParams({ act_bright }) })
                .then(() => alert('✅ Яркость сохранена в Flash-память!'));
        }

        function saveAllStairsSettings() {
            const num_steps = document.getElementById('inpNumSteps').value;
            const leds_step = document.getElementById('inpLedsStep').value;
            const anim_speed = document.getElementById('inpSpeed').value;
            const hold_time = document.getElementById('inpHold').value;
            const act_bright = document.getElementById('inpActBri').value;
            const sb_bright = document.getElementById('inpSbBri').value;
            const sb_mode = document.getElementById('selSbMode').value;

            totalConfigSteps = parseInt(num_steps);
            buildVisualizer(totalConfigSteps);

            fetch('/api/save_config', {
                method: 'POST',
                body: new URLSearchParams({ num_steps, leds_step, anim_speed, hold_time, act_bright, sb_bright, sb_mode, reboot: '0' })
            }).then(() => alert('✅ Параметры лестницы успешно сохранены!'));
        }

        function savePinsConfig() {
            const pin_led = document.getElementById('selPinLed').value;
            const pin_bot = document.getElementById('selPinBot').value;
            const pin_top = document.getElementById('selPinTop').value;
            const sensor_high = document.getElementById('selSensorHigh').value;
            const pull_mode = document.getElementById('selPullMode').value;

            if (pin_led === pin_bot || pin_led === pin_top || pin_bot === pin_top) {
                alert('⚠️ Ошибка: Выбраны одинаковые GPIO пины для разных устройств!');
                return;
            }

            if (!confirm('Сохранить пины (LED: GPIO ' + pin_led + ', Датчики: ' + pin_bot + ', ' + pin_top + ') и перезагрузить ESP32?')) return;

            fetch('/api/save_config', {
                method: 'POST',
                body: new URLSearchParams({ pin_led, pin_bot, pin_top, sensor_high, pull_mode, reboot: '1' })
            }).then(() => {
                alert('✅ Конфигурация сохранена! Перезагрузка...');
                setTimeout(() => window.location.reload(), 4000);
            });
        }

        function saveWifiCredentials() {
            const ssid = document.getElementById('wifiSsid').value;
            const pass = document.getElementById('wifiPass').value;
            if (!confirm('Сохранить Wi-Fi (' + ssid + ') и перезагрузить ESP32?')) return;
            fetch('/api/save_config', { method: 'POST', body: new URLSearchParams({ ssid, pass, reboot: '1' }) })
                .then(() => {
                    alert('✅ Настройки сохранены! ESP32 перезагружается для подключения к ' + ssid + '...');
                    setTimeout(() => window.location.reload(), 5000);
                });
        }

        function toggleAutoOta(val) {
            fetch('/api/save_config', { method: 'POST', body: new URLSearchParams({ auto_ota: val }) })
                .then(() => alert(val == '1' ? '✅ Автоматическая проверка OTA включена.' : '✅ Авто-OTA отключено.'));
        }

        function scanWifiNetworks() {
            const dropdown = document.getElementById('wifiListDropdown');
            dropdown.style.display = 'block';
            dropdown.innerHTML = '<option>⏳ Сканирование радиоэфира...</option>';
            fetch('/api/scan_wifi').then(r => r.json()).then(d => {
                if (d.networks && d.networks.length) {
                    dropdown.innerHTML = '<option value="">-- Выберите найденную сеть --</option>' +
                        d.networks.map(n => '<option value="' + n.ssid + '">' + n.ssid + ' (' + n.rssi + ' dBm)</option>').join('');
                } else {
                    dropdown.innerHTML = '<option>Сети не обнаружены</option>';
                }
            });
        }

        function loadGitHubReleases() {
            const c = document.getElementById('githubReleasesContainer');
            if (!c) return;
            c.innerHTML = '<div style="text-align:center; padding:15px; font-size:12px; color:#9ca3af;">⏳ Запрос версий с GitHub API...</div>';

            const defaultList = [
                { tag_name: "v1.0.9", name: "Smart Staircase Firmware v1.0.9", published_at: "2026-08-17", body: "Актуальная версия с поддержкой датчиков на GPIO 22/23, защитой от 404 и семантическим OTA." },
                { tag_name: "v1.0.4", name: "Smart Staircase Firmware v1.0.4", published_at: "2026-08-14", body: "Выбор версий с GitHub прямо в Web-интерфейсе, таймер для Борисова." },
                { tag_name: "v1.0.0", name: "Initial Release v1.0.0", published_at: "2026-08-01", body: "Базовая сборка для WS2812B." }
            ];

            fetch('https://api.github.com/repos/' + GH_USER + '/' + GH_REPO + '/releases')
                .then(r => r.json())
                .then(list => renderReleases(Array.isArray(list) && list.length ? list : defaultList))
                .catch(() => renderReleases(defaultList));
        }

        function renderReleases(list) {
            const c = document.getElementById('githubReleasesContainer');
            if (!c) return;
            let html = '';
            list.forEach((rel, idx) => {
                const tag = rel.tag_name || 'v1.0.9';
                const clean = tag.replace(/^v/, '');
                const isCur = (clean === CURRENT_VERSION || tag === CURRENT_VERSION);
                const isLat = (idx === 0);
                const binAsset = (rel.assets || []).find(a => a.name.endsWith('.bin'));
                const binUrl = binAsset ? binAsset.browser_download_url : ('https://github.com/' + GH_USER + '/' + GH_REPO + '/releases/download/' + tag + '/firmware.bin');

                html += '<div style="background:#0f172a; border:1px solid ' + (isCur ? '#10b981' : (isLat ? '#8b5cf6' : '#374151')) + '; border-radius:14px; padding:12px;">';
                html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
                html += '<div style="display:flex; align-items:center; gap:6px;">';
                html += '<strong style="font-family:monospace; font-size:14px; color:#f8fafc;">' + tag + '</strong>';
                if (isCur) html += '<span style="background:#065f46; color:#a7f3d0; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700;">⭐ Текущая</span>';
                if (isLat) html += '<span style="background:#4c1d95; color:#ddd6fe; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700;">🚀 Latest</span>';
                html += '</div>';
                html += '<span style="font-size:11px; color:#6b7280;">' + (rel.published_at ? rel.published_at.substring(0, 10) : '') + '</span>';
                html += '</div>';

                if (rel.body) html += '<div style="font-size:11px; color:#cbd5e1; margin:6px 0; background:#1e293b; padding:6px 8px; border-radius:6px;">' + rel.body + '</div>';

                if (isCur) {
                    html += '<button type="button" class="btn-action" style="background:#059669; font-size:12px; padding:8px; cursor:default;" disabled>✅ Установлена</button>';
                } else {
                    html += '<button type="button" onclick="installGithubOta(\\'' + tag + '\\', \\'' + binUrl + '\\')" class="btn-action btn-indigo" style="font-size:12px; padding:8px;">⚡ Установить ' + tag + ' по воздуху</button>';
                }
                html += '</div>';
            });
            c.innerHTML = html;
        }

        function installGithubOta(tag, url) {
            if (!confirm('Прошить ESP32 версией ' + tag + ' по воздуху?')) return;
            const modal = document.getElementById('otaModal');
            const pBar = document.getElementById('otaProgressBar');
            const pText = document.getElementById('otaPercentText');
            if (modal) modal.style.display = 'flex';

            fetch('/api/ota_install_github', { method: 'POST', body: new URLSearchParams({ version: tag, url }) })
                .then(() => {
                    let ticks = 0;
                    const timer = setInterval(() => {
                        ticks++;
                        fetch('/api/ota_status').then(r => r.json()).then(st => {
                            if (st.progress) {
                                pBar.style.width = st.progress + '%';
                                pText.innerText = 'Прогресс: ' + st.progress + '% (' + st.status + ')';
                            }
                            if (st.status === 'success' || st.progress >= 100) {
                                clearInterval(timer);
                                pBar.style.width = '100%';
                                pText.innerText = '✅ Успешно! Перезагрузка...';
                                setTimeout(() => window.location.reload(), 4500);
                            }
                        }).catch(() => {
                            if (ticks > 4) {
                                clearInterval(timer);
                                pBar.style.width = '100%';
                                pText.innerText = '🔄 Перезагрузка...';
                                setTimeout(() => window.location.reload(), 4000);
                            }
                        });
                    }, 1500);
                });
        }

        function updateTelemetry() {
            fetch('/api/status').then(r => r.json()).then(d => {
                if (d.steps) {
                    document.getElementById('dispSteps').innerText = d.steps + ' / ' + (d.total_leds || d.steps*20) + ' шт';
                }
                if (d.ip) document.getElementById('dispIp').innerText = d.ip;
                if (d.pin_led !== undefined) {
                    document.getElementById('dispPins').innerText = 'GPIO ' + d.pin_led + ' / ' + d.pin_bot + ', ' + d.pin_top;
                }
                const astro = document.getElementById('dispAstroStatus');
                if (astro) astro.innerText = d.is_night_active ? '🌙 Ночь (Готова)' : '☀️ День (Ожидание)';
                const solarFull = document.getElementById('dispSolarFull');
                if (solarFull) solarFull.innerText = d.is_night_active ? '🌙 Ночной режим АКТИВЕН (Закат: ' + (d.sunset || '19:40') + ')' : '☀️ Дневной режим (Рассвет: ' + (d.sunrise || '05:30') + ')';

                const botTxt = document.getElementById('liveBotText');
                if (botTxt && d.bottom_motion !== undefined) {
                    botTxt.innerHTML = d.bottom_motion ? '<span style="color:#10b981;">🟢 ДВИЖЕНИЕ (Сработал)</span>' : '<span style="color:#9ca3af;">⚪ Покой (LOW=' + d.bottom_raw + ')</span>';
                }
                const topTxt = document.getElementById('liveTopText');
                if (topTxt && d.top_motion !== undefined) {
                    topTxt.innerHTML = d.top_motion ? '<span style="color:#10b981;">🟢 ДВИЖЕНИЕ (Сработал)</span>' : '<span style="color:#9ca3af;">⚪ Покой (LOW=' + d.top_raw + ')</span>';
                }
            }).catch(()=>{});
        }
        setInterval(updateTelemetry, 1500);
        updateTelemetry();

        function restartEsp() {
            if (confirm('Перезагрузить контроллер ESP32?')) {
                fetch('/api/restart', { method: 'POST' }).then(() => alert('ESP32 перезагружается...'));
            }
        }
    </script>
</body>
</html>
)rawliteral";

class StairWebServer {
public:
    AsyncWebServer server;
    Preferences prefs;

    StairWebServer() : server(80) {}

    void begin(void (*onColorChange)(uint8_t r, uint8_t g, uint8_t b),
               void (*onTrigger)(bool isBottom),
               String (*getStatusJson)(),
               void (*onConfigChange)(),
               bool (*onTriggerOta)(String binUrl) = nullptr,
               String (*getOtaStatus)() = nullptr) {

        prefs.begin("stairs_cfg", false);

        server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
            AsyncWebServerResponse *response = request->beginResponse_P(200, "text/html; charset=utf-8", (const uint8_t*)INDEX_HTML, sizeof(INDEX_HTML) - 1);
            response->addHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            response->addHeader("Access-Control-Allow-Origin", "*");
            request->send(response);
        });

        server.on("/api/status", HTTP_GET, [getStatusJson](AsyncWebServerRequest *request) {
            request->send(200, "application/json", getStatusJson());
        });

        server.on("/api/ota_status", HTTP_GET, [getOtaStatus](AsyncWebServerRequest *request) {
            if (getOtaStatus) {
                request->send(200, "application/json", getOtaStatus());
            } else {
                request->send(200, "application/json", "{\\"is_updating\\":false,\\"progress\\":0,\\"status\\":\\"idle\\"}");
            }
        });

        // Trigger Direct OTA from GitHub URL
        server.on("/api/ota_install_github", HTTP_POST, [onTriggerOta](AsyncWebServerRequest *request) {
            if (!onTriggerOta) {
                request->send(500, "application/json", "{\\"error\\":\\"OTA engine unavailable\\"}");
                return;
            }
            String binUrl = "";
            if (request->hasParam("url", true)) {
                binUrl = request->getParam("url", true)->value();
            } else if (request->hasParam("version", true)) {
                String ver = request->getParam("version", true)->value();
                binUrl = "https://github.com/" + String(GITHUB_USER) + "/" + String(GITHUB_REPO) + "/releases/download/" + ver + "/firmware.bin";
            }
            if (binUrl.length() == 0) {
                request->send(400, "application/json", "{\\"error\\":\\"Missing binary URL or version\\"}");
                return;
            }

            request->send(200, "application/json", "{\\"status\\":\\"started\\",\\"bin_url\\":\\"" + binUrl + "\\"}");
            
            // Execute flash in background or after response
            delay(200);
            onTriggerOta(binUrl);
        });

        // Scan available WiFi networks
        server.on("/api/scan_wifi", HTTP_GET, [](AsyncWebServerRequest *request) {
            int n = WiFi.scanComplete();
            if (n == -2) {
                WiFi.scanNetworks(true);
                request->send(200, "application/json", "{\\"status\\":\\"scanning\\"}");
            } else if (n) {
                String json = "{\\"status\\":\\"done\\",\\"networks\\":[";
                for (int i = 0; i < n; ++i) {
                    if (i) json += ",";
                    json += "{\\"ssid\\":\\"" + WiFi.SSID(i) + "\\",\\"rssi\\":" + String(WiFi.RSSI(i)) + "}";
                }
                json += "]}";
                WiFi.scanDelete();
                WiFi.scanNetworks(true);
                request->send(200, "application/json", json);
            } else {
                WiFi.scanNetworks(true);
                request->send(200, "application/json", "{\\"status\\":\\"scanning\\"}");
            }
        });

        server.on("/api/trigger", HTTP_POST, [onTrigger](AsyncWebServerRequest *request) {
            if (request->hasParam("dir", true)) {
                String dir = request->getParam("dir", true)->value();
                if (dir == "up") onTrigger(true);
                else onTrigger(false);
            }
            request->send(200, "application/json", "{\\"status\\":\\"triggered\\"}");
        });

        server.on("/api/color", HTTP_POST, [onColorChange, this](AsyncWebServerRequest *request) {
            if (request->hasParam("r", true) && request->hasParam("g", true) && request->hasParam("b", true)) {
                int r = request->getParam("r", true)->value().toInt();
                int g = request->getParam("g", true)->value().toInt();
                int b = request->getParam("b", true)->value().toInt();
                prefs.putUChar("col_r", (uint8_t)r);
                prefs.putUChar("col_g", (uint8_t)g);
                prefs.putUChar("col_b", (uint8_t)b);
                onColorChange(r, g, b);
            }
            request->send(200, "application/json", "{\\"status\\":\\"ok\\"}");
        });

        // Save Wi-Fi Credentials & Parameters
        server.on("/api/save_config", HTTP_POST, [this, onConfigChange](AsyncWebServerRequest *request) {
            if (request->hasParam("ssid", true)) {
                String ssid = request->getParam("ssid", true)->value();
                String pass = request->hasParam("pass", true) ? request->getParam("pass", true)->value() : "";
                prefs.putString("wifi_ssid", ssid);
                prefs.putString("wifi_pass", pass);
            }

            if (request->hasParam("num_steps", true)) {
                prefs.putUChar("num_steps", (uint8_t)request->getParam("num_steps", true)->value().toInt());
            }
            if (request->hasParam("leds_step", true)) {
                prefs.putUChar("leds_step", (uint8_t)request->getParam("leds_step", true)->value().toInt());
            }
            if (request->hasParam("anim_speed", true)) {
                prefs.putUInt("anim_spd", request->getParam("anim_speed", true)->value().toInt());
            }
            if (request->hasParam("hold_time", true)) {
                prefs.putUInt("hold_sec", request->getParam("hold_time", true)->value().toInt());
            }
            if (request->hasParam("act_bright", true)) {
                prefs.putUChar("act_bri", (uint8_t)request->getParam("act_bright", true)->value().toInt());
            }
            if (request->hasParam("sb_bright", true)) {
                prefs.putUChar("sb_bri", (uint8_t)request->getParam("sb_bright", true)->value().toInt());
            }
            if (request->hasParam("sb_mode", true)) {
                prefs.putUChar("sb_mode", (uint8_t)request->getParam("sb_mode", true)->value().toInt());
            }

            // GPIO Pins Configuration
            if (request->hasParam("pin_led", true)) {
                prefs.putUChar("pin_led", (uint8_t)request->getParam("pin_led", true)->value().toInt());
            }
            if (request->hasParam("pin_bot", true)) {
                prefs.putUChar("pin_bot", (uint8_t)request->getParam("pin_bot", true)->value().toInt());
            }
            if (request->hasParam("pin_top", true)) {
                prefs.putUChar("pin_top", (uint8_t)request->getParam("pin_top", true)->value().toInt());
            }
            if (request->hasParam("pin_ldr", true)) {
                prefs.putUChar("pin_ldr", (uint8_t)request->getParam("pin_ldr", true)->value().toInt());
            }
            if (request->hasParam("sensor_high", true)) {
                prefs.putUChar("sensor_high", (uint8_t)request->getParam("sensor_high", true)->value().toInt());
            }
            if (request->hasParam("pull_mode", true)) {
                prefs.putUChar("pull_mode", (uint8_t)request->getParam("pull_mode", true)->value().toInt());
            }
            if (request->hasParam("auto_ota", true)) {
                prefs.putUChar("auto_ota", (uint8_t)request->getParam("auto_ota", true)->value().toInt());
            }

            if (onConfigChange) onConfigChange();

            bool reboot = request->hasParam("reboot", true) && request->getParam("reboot", true)->value() == "1";
            request->send(200, "application/json", "{\\"status\\":\\"saved\\",\\"rebooting\\":" + String(reboot ? "true" : "false") + "}");
            
            if (reboot) {
                delay(1000);
                ESP.restart();
            }
        });

        server.on("/api/restart", HTTP_POST, [](AsyncWebServerRequest *request) {
            request->send(200, "application/json", "{\\"status\\":\\"restarting\\"}");
            delay(1000);
            ESP.restart();
        });

        server.on("/update", HTTP_GET, [](AsyncWebServerRequest *request) {
            String html = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>OTA Upload</title>"
                          "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                          "<style>body{font-family:sans-serif;background:#0f172a;color:#fff;padding:20px;text-align:center;}"
                          ".card{background:#1e293b;padding:30px;border-radius:12px;display:inline-block;max-width:400px;width:100%;}"
                          "input{margin:15px 0;width:100%;padding:10px;border-radius:6px;box-sizing:border-box;}"
                          ".btn{background:#3b82f6;color:#fff;border:none;cursor:pointer;font-weight:bold;}</style></head><body>"
                          "<div class='card'><h2>⚡ ESP32 Firmware Flash</h2>"
                          "<form method='POST' action='/update' enctype='multipart/form-data'>"
                          "<input type='file' name='update' accept='.bin'><br>"
                          "<input type='submit' class='btn' value='Загрузить и прошить (.bin)'>"
                          "</form><br><a href='/' style='color:#38bdf8'>← Назад в панель</a></div></body></html>";
            request->send(200, "text/html", html);
        });

        server.on("/update", HTTP_POST, [](AsyncWebServerRequest *request) {
            bool shouldReboot = !Update.hasError();
            AsyncWebServerResponse *response = request->beginResponse(200, "text/plain", shouldReboot ? "OK - Перезагрузка..." : "FAIL");
            response->addHeader("Connection", "close");
            request->send(response);
            if (shouldReboot) {
                delay(1000);
                ESP.restart();
            }
        }, [](AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final) {
            if (!index) {
                Serial.printf("[MANUAL_OTA] Start update: %s\\n", filename.c_str());
                if (!Update.begin(UPDATE_SIZE_UNKNOWN)) {
                    Update.printError(Serial);
                }
            }
            if (Update.write(data, len) != len) {
                Update.printError(Serial);
            }
            if (final) {
                if (Update.end(true)) {
                    Serial.printf("[MANUAL_OTA] Success: %u B\\n", index + len);
                } else {
                    Update.printError(Serial);
                }
            }
        });

        server.begin();
        Serial.println("[HTTP] Full Web Server listening on port 80");
    }


};
`;

  // 8. src/main.cpp
  const mainCpp = `/**
 * ==============================================================================
 * ESP32 Smart Staircase Controller
 * WS2812B Addressable LED Strip + Dual PIR Motion Sensors + Astronomical Solar Schedule + GitHub CI/CD Auto-OTA
 * ==============================================================================
 */
#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>

#include "config.h"
#include "solar_scheduler.h"
#include "led_controller.h"
#include "ota_manager.h"
#include "web_server.h"

// Subsystem singletons
SolarScheduler solarEngine;
StairLedController ledEngine;
OtaManager otaEngine;
StairWebServer webEngine;

// Sensor debounce variables
bool lastBottomState = LOW;
bool lastTopState = LOW;
unsigned long lastSolarCheck = 0;

void onStartOta() {
    Serial.println("[SYSTEM] OTA starting -> Switching LEDs to update mode");
    ledEngine.setOtaMode(true);
}

void onColorChanged(uint8_t r, uint8_t g, uint8_t b) {
    Serial.printf("[SYSTEM] New Color Set: R=%d G=%d B=%d\\n", r, g, b);
    ledEngine.setColor(r, g, b);
}

void onManualTrigger(bool isBottom) {
    if (isBottom) ledEngine.triggerBottom();
    else ledEngine.triggerTop();
}

bool onTriggerGithubOta(String binUrl) {
    Serial.println("[SYSTEM] Web triggered GitHub OTA download: " + binUrl);
    return otaEngine.triggerCustomUpdate(binUrl, onStartOta);
}

String getOtaStatus() {
    return otaEngine.getOtaStatusJson();
}

String getSystemStatusJson() {
    JsonDocument doc;
    doc["version"] = FIRMWARE_VERSION;
    doc["steps"] = NUM_STEPS;
    doc["leds"] = TOTAL_LEDS;
    doc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
    doc["ip"] = WiFi.localIP().toString();
    doc["time"] = solarEngine.getFormattedCurrentTime();
    doc["sunrise"] = solarEngine.getFormattedSunrise();
    doc["sunset"] = solarEngine.getFormattedSunset();
    doc["is_night_active"] = solarEngine.isNightTimeActive();
    doc["stair_state"] = (int)ledEngine.currentState;

    String output;
    serializeJson(doc, output);
    return output;
}

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\\n========================================================");
    Serial.println("   ESP32 SMART STAIRCASE CONTROLLER (v" FIRMWARE_VERSION ")");
    Serial.println("========================================================");

    // Initialize Pins
    pinMode(PIN_BOTTOM_PIR, INPUT_PULLDOWN);
    pinMode(PIN_TOP_PIR, INPUT_PULLDOWN);

    // Initialize LED Controller
    ledEngine.begin();

    // Connect to Wi-Fi with fallback to AP
    WiFi.mode(WIFI_AP_STA);
    WiFi.begin(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASS);
    
    Serial.print("[WIFI] Connecting to " DEFAULT_WIFI_SSID);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\\n[WIFI] Connected! IP Address: %s\\n", WiFi.localIP().toString().c_str());
        // Initialize Solar & NTP
        solarEngine.begin();
        solarEngine.updateTime();
        // Initialize OTA Manager
        otaEngine.begin();
    } else {
        Serial.printf("\\n[WIFI] Failed to connect to '%s'. Starting AP Mode: %s\\n", DEFAULT_WIFI_SSID, AP_SSID_NAME);
        WiFi.softAP(AP_SSID_NAME, AP_PASSWORD_NAME);
        Serial.printf("[WIFI] AP Started. Connect to '%s' (Password: %s) -> Open http://192.168.4.1\\n", AP_SSID_NAME, AP_PASSWORD_NAME);
    }

    // Start Web Server with OTA support
    webEngine.begin(onColorChanged, onManualTrigger, getSystemStatusJson, onTriggerGithubOta, getOtaStatus);

    Serial.println("[SYSTEM] Ready! Waiting for sensor triggers...");
}

void loop() {
    // 1. Read Motion Sensors
    bool bottomMotion = digitalRead(PIN_BOTTOM_PIR);
    bool topMotion = digitalRead(PIN_TOP_PIR);

    // Check if night lighting is enabled (Sunset - 30m to Sunrise)
    bool isSolarActive = solarEngine.isNightTimeActive();

    // Bottom sensor triggered (rising edge)
    if (bottomMotion && !lastBottomState) {
        ledEngine.triggerBottom();
    }
    lastBottomState = bottomMotion;

    // Top sensor triggered (rising edge)
    if (topMotion && !lastTopState) {
        ledEngine.triggerTop();
    }
    lastTopState = topMotion;

    // 2. Update LED Animations
    ledEngine.update(isSolarActive);

    // 3. Periodic Solar & NTP refresh (every 60 seconds)
    unsigned long now = millis();
    if (now - lastSolarCheck >= 60000UL) {
        lastSolarCheck = now;
        solarEngine.updateTime();
    }

    // 4. Background GitHub Auto-OTA Handler
    otaEngine.handle(onStartOta);

    delay(10);
}
`;

  // 9. version.json
  const versionJson = `{
  "version": "${config.firmwareVersion}",
  "build": 1,
  "release_date": "${new Date().toISOString()}",
  "bin_url": "https://github.com/${config.githubUsername || 'USER'}/${config.githubRepo || 'REPO'}/releases/download/v${config.firmwareVersion}/firmware.bin",
  "changelog": "Initial ESP32 Smart Staircase Release with WS2812B, Solar Schedule & GitHub OTA"
}`;

  // 10. README.md
  const readmeMd = `# 🌟 ESP32 Smart Staircase Controller (Умная подсветка лестницы)

Комплексный проект умной пошаговой подсветки лестницы на микроконтроллере **ESP32** с адресной светодиодной лентой **WS2812B**, датчиками движения сверху и снизу, расчетом заката/рассвета по интернету и автоматическими **OTA-обновлениями через GitHub Actions**.

---

## 📋 Основные возможности

1. **Адресная лента WS2812B/WS2811:**
   - Пошаговое плавное зажигание ступеней по направлению движения:
     - Снизу вверх при срабатывании нижнего датчика.
     - Сверху вниз при срабатывании верхнего датчика.
   - Плавное затухание по завершению таймера задержки.
   - Дежурная подсветка (ночник): мягкое свечение крайних ступеней или всех ступеней на минимальной яркости.

2. **Астрономическое расписание (Закат / Рассвет):**
   - Синхронизация точного времени по NTP (\`pool.ntp.org\`).
   - Встроенный расчет солнечного заката и рассвета по координатам (Широта: \`${config.latitude}\`, Долгота: \`${config.longitude}\`).
   - Подсветка активируется **за 30 минут до заката** и выключается **после рассвета**.

3. **GitHub Actions CI/CD & Автоматическая сборка:**
   - При любом \`git push\` в репозиторий GitHub автоматически компилирует прошивку в облаке с помощью PlatformIO.
   - Автоматически инкрементирует номер версии (например \`v1.0.1\`, \`v1.0.2\`).
   - Создает GitHub Release и прикрепляет файл прошивки \`firmware.bin\` и манифест \`version.json\`.

4. **Автоматическое OTA-обновление по Wi-Fi:**
   - ESP32 периодически опрашивает ваш GitHub-репозиторий.
   - При появлении новой сборки автоматически скачивает \`firmware.bin\` и безопасно прошивается "по воздуху".
   - Визуальная индикация процесса обновления на светодиодах.

5. **Встроенный Web-интерфейс:**
   - Локальная страница управления \`http://<IP_ESP32>\` или в режиме точки доступа \`http://192.168.4.1\`.
   - Ручное переключение цветов, тестирование датчиков, ручная прошивка через браузер (\`/update\`).

---

## 🛠 Схема подключения (Hardware Wiring)

| Компонент | Пин ESP32 | Примечание |
|---|---|---|
| **WS2812B Data In** | **GPIO ${config.ledPin}** | Рекомендуется резистор 330–470 Ом в разрыв сигнального провода |
| **Нижний датчик (PIR / Radar)** | **GPIO ${config.bottomSensorPin}** | Выход \`OUT\` датчика движения (HC-SR501 / RCWL-0516) |
| **Верхний датчик (PIR / Radar)** | **GPIO ${config.topSensorPin}** | Выход \`OUT\` датчика движения |
| **Питание 5V** | **5V / VIN** | Блок питания 5V (расчет: ~60мА на 1 LED при белом цвете) |
| **GND** | **GND** | Общая земля для ESP32, ленты и датчиков |

> ⚠️ **Важно:** На линии питания светодиодной ленты рекомендуется установить электролитический конденсатор 1000 мкФ 6.3V/10V параллельно питанию (+ и GND) для сглаживания бросков тока.

---

## 🚀 Прошивка ESP32 и Быстрый старт

### Вариант 1: Загрузка через Google AI Studio прямо на GitHub
1. **Экспорт в GitHub:**
   - В Google AI Studio откройте меню проекта / настройки (**Settings**) и нажмите **Export to GitHub** (или скачайте ZIP-архив).
   - В репозитории GitHub перейдите в **Settings** -> **Actions** -> **General** -> **Workflow permissions**, выберите **Read and write permissions** и сохраните.
2. **Автоматическая сборка:**
   - GitHub Actions автоматически скомпилирует скетч с помощью \`arduino-cli\` и создаст официальный Release со всеми бинарниками и скриптом прошивки!

---

### Вариант 2: Прошивка и обновление на Windows (flash_windows.bat)
1. **Запуск скрипта flash_windows.bat:**
   - Подключите ESP32 к компьютеру по USB и дважды кликните по **\`flash_windows.bat\`**.
   - Скрипт предоставит интерактивное меню:
     - **[1] ⚡ Автопоиск и прошивка локальных файлов** (StairsEsp.ino.bin, firmware.bin).
     - **[2] 📁 Выбор любого локального .bin файла** на компьютере (вручную или Drag-and-Drop).
     - **[3] 🌐 Выбор и скачивание версий с GitHub Releases** (v1.0.4, v1.0.3, v1.0.2, latest или ввод тега).
     - **[4] 📶 Беспроводное OTA-обновление по Wi-Fi** (отправка .bin прямо на IP платы).
     - **[5] ⚙️ Консольный мастер настройки параметров** (Wi-Fi, ступени, LED, скорость, цвета).
     - **[6] 📟 Serial Monitor** (115200 бод).
2. **Автоматическая подготовка:**
   - Скрипт **\`flash_windows.bat\`** автоматически скачивает официальный \`esptool.exe\` из репозитория Espressif при первом запуске, если его нет в папке!

---

### Вариант 3: Ручная загрузка в репозиторий через Git
\`\`\`bash
git init
git add .
git commit -m "Initial commit for Smart Staircase"
git remote add origin https://github.com/${config.githubUsername || 'YOUR_USERNAME'}/${config.githubRepo || 'esp32-stairs-lighting'}.git
git branch -M main
git push -u origin main
\`\`\`

---

## ⚙️ Текущая конфигурация

- **Количество ступеней:** ${config.stepCount} шт.
- **Диодов на ступень:** ${config.ledsPerStep} шт. (Всего: ${totalLeds} LED)
- **Координаты солнца:** ${config.latitude}°N, ${config.longitude}°E (Часовой пояс: UTC${config.timezoneOffsetHours >= 0 ? '+' : ''}${config.timezoneOffsetHours})
- **Срабатывание:** За ${Math.abs(config.sunsetOffsetMinutes)} мин до заката -> До рассвета
`;

  return [
    {
      name: 'flash_windows.bat',
      path: 'flash_windows.bat',
      language: 'bat',
      description: 'Windows 1-Click flasher script with automatic esptool.exe downloader',
      content: flashWindowsBat,
    },
    {
      name: 'terminal.bat',
      path: 'terminal.bat',
      language: 'bat',
      description: 'Windows Serial Monitor console (115200 baud) for live debugging',
      content: terminalBat,
    },
    {
      name: 'build_and_release.yml',
      path: '.github/workflows/build_and_release.yml',
      language: 'yaml',
      description: 'GitHub Actions CI/CD with Arduino CLI, auto-versioning and release packaging',
      content: githubActionsWorkflow,
    },
    {
      name: 'StairsEsp.ino',
      path: 'StairsEsp/StairsEsp.ino',
      language: 'cpp',
      description: 'Arduino IDE & Arduino CLI main sketch entry point',
      content: stairsEspIno,
    },
    {
      name: 'version.h',
      path: 'StairsEsp/version.h',
      language: 'cpp',
      description: 'Dynamic firmware version header managed by GitHub Actions',
      content: versionH,
    },
    {
      name: 'platformio.ini',
      path: 'platformio.ini',
      language: 'ini',
      description: 'PlatformIO build configuration with FastLED, ArduinoJson & partitions',
      content: platformioIni,
    },
    {
      name: 'config.h',
      path: 'src/config.h',
      language: 'cpp',
      description: 'Pin definitions, step counts, solar parameters, and Wi-Fi constants',
      content: configH,
    },
    {
      name: 'solar_scheduler.h',
      path: 'src/solar_scheduler.h',
      language: 'cpp',
      description: 'Astronomical sunrise/sunset math & NTP synchronization engine',
      content: solarSchedulerH,
    },
    {
      name: 'led_controller.h',
      path: 'src/led_controller.h',
      language: 'cpp',
      description: 'WS2812B step-by-step wave animations, crossfades & standby mode',
      content: ledControllerH,
    },
    {
      name: 'ota_manager.h',
      path: 'src/ota_manager.h',
      language: 'cpp',
      description: 'GitHub Releases auto-OTA update client over Wi-Fi',
      content: otaManagerH,
    },
    {
      name: 'web_server.h',
      path: 'src/web_server.h',
      language: 'cpp',
      description: 'Embedded Web UI & manual .bin firmware flash endpoint',
      content: webServerH,
    },
    {
      name: 'main.cpp',
      path: 'src/main.cpp',
      language: 'cpp',
      description: 'Main ESP32 application entry point & FreeRTOS loop',
      content: mainCpp,
    },
    {
      name: 'version.json',
      path: 'version.json',
      language: 'json',
      description: 'Firmware version manifest queried by ESP32 OTA',
      content: versionJson,
    },
    {
      name: 'README.md',
      path: 'README.md',
      language: 'markdown',
      description: 'Complete Russian and English wiring, flashing & AI Studio / GitHub setup',
      content: readmeMd,
    },
  ];
}
