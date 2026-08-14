@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ESP32 Smart Staircase - Firmware Flasher & Setup Wizard

:: Repository configuration
set "GH_USER=geminibitok-oss"
set "GH_REPO=ESP32-Smart-Staircase-Controller"
set "CURRENT_VER=1.0.4"

:MAIN_MENU
cls
echo ======================================================================
echo    🌟 ESP32 Smart Staircase Controller - Firmware Flasher & Manager
echo ======================================================================
echo.
echo Репозиторий: %GH_USER%/%GH_REPO% (Текущая версия: v%CURRENT_VER%)
echo.
echo Выберите действие:
echo.
echo   [1] ⚡ Прошить текущую локальную версию (Автоопределение файлов в папке)
echo   [2] 📁 Выбрать локальный .bin файл на компьютере (Вручную / Drag-and-Drop)
echo   [3] 🌐 Выбрать и скачать версию прошивки из GitHub Releases
echo   [4] 📶 Беспроводное OTA-обновление по Wi-Fi (без USB кабеля)
echo   [5] ⚙️  Мастер настройки параметров лестницы через USB (Wi-Fi, LED, Пины)
echo   [6] 📟 Открыть Монитор Serial Порта (Live Логи 115200 бод)
echo   [7] 🚪 Выход
echo.
set "MENU_CHOICE="
set /p MENU_CHOICE="Введите номер пункта (1-7) [По умолчанию 1]: "
if "%MENU_CHOICE%"=="" set MENU_CHOICE=1

if "%MENU_CHOICE%"=="1" goto FLASH_LOCAL_AUTO
if "%MENU_CHOICE%"=="2" goto FLASH_LOCAL_MANUAL
if "%MENU_CHOICE%"=="3" goto GITHUB_RELEASE_PICKER
if "%MENU_CHOICE%"=="4" goto OTA_WIFI_UPDATE
if "%MENU_CHOICE%"=="5" goto USB_SETUP_WIZARD
if "%MENU_CHOICE%"=="6" goto OPEN_SERIAL_TERMINAL
if "%MENU_CHOICE%"=="7" goto EXIT_SCRIPT

echo [!] Неверный ввод. Пожалуйста, введите цифру от 1 до 7.
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
echo Репозиторий: %GH_USER%/%GH_REPO%
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
    "$user = '%GH_USER%';" ^
    "$repo = '%GH_REPO%';" ^
    "$url = \"https://github.com/$user/$repo/releases/latest/download/firmware.bin\";" ^
    "$outFile = '%~dp0downloaded_latest_firmware.bin';" ^
    "Write-Host \"[*] Скачивание последнего firmware.bin...\";" ^
    "try {" ^
    "  (New-Object System.Net.WebClient).DownloadFile($url, $outFile);" ^
    "  Write-Host '[OK] Файл успешно скачан!';" ^
    "  [System.IO.File]::WriteAllText('%temp%\gh_dl_res.txt', 'SUCCESS');" ^
    "} catch {" ^
    "  Write-Host ('[!] Ошибка скачивания: ' + $_.Exception.Message);" ^
    "  [System.IO.File]::WriteAllText('%temp%\gh_dl_res.txt', 'FAIL');" ^
    "}"

set /p DL_RES=<"%temp%\gh_dl_res.txt"
del /f /q "%temp%\gh_dl_res.txt" >nul 2>&1

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
    "$user = '%GH_USER%';" ^
    "$repo = '%GH_REPO%';" ^
    "$tag = '%TARGET_TAG%';" ^
    "$url = \"https://github.com/$user/$repo/releases/download/$tag/firmware.bin\";" ^
    "$outFile = \"%~dp0downloaded_$tag.bin\";" ^
    "Write-Host \"[*] URL: $url\";" ^
    "try {" ^
    "  (New-Object System.Net.WebClient).DownloadFile($url, $outFile);" ^
    "  Write-Host '[OK] Прошивка $tag успешно скачана!';" ^
    "  [System.IO.File]::WriteAllText('%temp%\gh_dl_res.txt', 'SUCCESS');" ^
    "} catch {" ^
    "  Write-Host ('[!] Ошибка скачивания: ' + $_.Exception.Message);" ^
    "  [System.IO.File]::WriteAllText('%temp%\gh_dl_res.txt', 'FAIL');" ^
    "}"

set /p DL_RES=<"%temp%\gh_dl_res.txt"
del /f /q "%temp%\gh_dl_res.txt" >nul 2>&1

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
    if exist "%~dp0esptool_tmp\esptool-win64\esptool.exe" (
        copy /y "%~dp0esptool_tmp\esptool-win64\esptool.exe" "%~dp0esptool.exe" >nul
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
:: Mode 5: USB Configuration Wizard (Sends commands over COM port)
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
echo Настройка пинов GPIO (нажмите ENTER для стандартных пинов):
set "CFG_PIN_LED="
set /p CFG_PIN_LED="10. GPIO пин ленты WS2812B (Data) [18]: "

set "CFG_PIN_BOT="
set /p CFG_PIN_BOT="11. GPIO пин нижнего датчика движения [19]: "

set "CFG_PIN_TOP="
set /p CFG_PIN_TOP="12. GPIO пин верхнего датчика движения [21]: "

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
    "  if ('%CFG_PIN_LED%' -ne '' -or '%CFG_PIN_BOT%' -ne '' -or '%CFG_PIN_TOP%' -ne '') {" ^
    "    $pL = if ('%CFG_PIN_LED%' -ne '') { '%CFG_PIN_LED%' } else { '18' };" ^
    "    $pB = if ('%CFG_PIN_BOT%' -ne '') { '%CFG_PIN_BOT%' } else { '19' };" ^
    "    $pT = if ('%CFG_PIN_TOP%' -ne '') { '%CFG_PIN_TOP%' } else { '21' };" ^
    "    $port.WriteLine('PINS=' + $pL + ',' + $pB + ',' + $pT); Start-Sleep -Milliseconds 200;" ^
    "  }" ^
    "  $port.WriteLine('STATUS');" ^
    "  Start-Sleep -Milliseconds 400;" ^
    "  $port.WriteLine('REBOOT');" ^
    "  Start-Sleep -Milliseconds 500;" ^
    "  $port.Close();" ^
    "  [System.IO.File]::WriteAllText('%temp%\esp_cfg_result.txt', 'SUCCESS');" ^
    "} catch {" ^
    "  [System.IO.File]::WriteAllText('%temp%\esp_cfg_result.txt', ('ERROR: ' + $_.Exception.Message));" ^
    "}"

set /p CFG_RESULT=<"%temp%\esp_cfg_result.txt"
del /f /q "%temp%\esp_cfg_result.txt" >nul 2>&1

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
