@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ESP32 Smart Staircase - Firmware Flasher

:MAIN_MENU
cls
echo ======================================================================
echo    🌟 ESP32 Smart Staircase Controller - Прошивка и Настройка
echo ======================================================================
echo.
echo Папка запуска: %~dp0
echo.
echo Выберите действие:
echo.
echo   [1] ⚡ Прошить текущую локальную версию (Автопоиск файлов в папке)
echo   [2] 📁 Выбрать локальный .bin файл на компьютере вручную
echo   [3] 🌐 Скачать последнюю версию прошивки из GitHub Releases и прошить
echo   [4] 🧹 ПОЛНАЯ ОЧИСТКА ПАМЯТИ ESP32 (Erase Flash - сброс всех настроек)
echo   [5] 📶 Настройка Wi-Fi через USB (SSID и пароль за 5 секунд)
echo   [6] ⚙️  Мастер настройки параметров (LED, Пины, Яркость, Ступени)
echo   [7] 📟 Открыть Монитор Serial Порта (Live логи 115200)
echo   [8] 🚪 Выход
echo.

set "CHOICE="
set /p CHOICE="Введите номер пункта (1-8) [По умолчанию 1]: "
if "%CHOICE%"=="" set CHOICE=1

if "%CHOICE%"=="1" goto FLASH_AUTO
if "%CHOICE%"=="2" goto FLASH_MANUAL
if "%CHOICE%"=="3" goto FLASH_GITHUB
if "%CHOICE%"=="4" goto FLASH_ERASE
if "%CHOICE%"=="5" goto SETUP_WIFI
if "%CHOICE%"=="6" goto SETUP_WIZARD
if "%CHOICE%"=="7" goto SERIAL_MONITOR
if "%CHOICE%"=="8" goto SCRIPT_EXIT

echo.
echo [!] Неверный ввод: %CHOICE%
pause
goto MAIN_MENU

:: -------------------------------------------------------------
:: 1. АВТОПРОШИВКА ЛОКАЛЬНЫХ ФАЙЛОВ
:: -------------------------------------------------------------
:FLASH_AUTO
cls
echo ======================================================================
echo  ⚡ [Режим 1] Автопоиск и прошивка локальных файлов
echo ======================================================================
echo.

:: 1. Проверяем esptool
call :PREPARE_ESPTOOL
if "%ESPTOOL_READY%"=="0" (
    echo.
    echo ❌ [ОШИБКА] Не найдена утилита esptool.exe!
    pause
    goto MAIN_MENU
)

:: 2. Ищем бинарники
set "FLASH_BIN_CMD="

if exist "%~dp0StairsEsp.ino.bootloader.bin" if exist "%~dp0StairsEsp.ino.partitions.bin" if exist "%~dp0StairsEsp.ino.bin" (
    echo [INFO] Найден полный комплект Arduino CLI:
    echo        - Bootloader: StairsEsp.ino.bootloader.bin (0x1000)
    echo        - Partitions: StairsEsp.ino.partitions.bin (0x8000)
    echo        - Firmware:   StairsEsp.ino.bin (0x10000)
    set FLASH_BIN_CMD=0x1000 "%~dp0StairsEsp.ino.bootloader.bin" 0x8000 "%~dp0StairsEsp.ino.partitions.bin" 0x10000 "%~dp0StairsEsp.ino.bin"
    goto RUN_FLASH_AUTO
)

if exist "%~dp0firmware_merged.bin" (
    echo [INFO] Найден файл: firmware_merged.bin (0x0)
    set FLASH_BIN_CMD=0x0 "%~dp0firmware_merged.bin"
    goto RUN_FLASH_AUTO
)

if exist "%~dp0firmware.bin" (
    echo [INFO] Найден файл: firmware.bin (0x10000)
    set FLASH_BIN_CMD=0x10000 "%~dp0firmware.bin"
    goto RUN_FLASH_AUTO
)

if exist "%~dp0StairsEsp.ino.bin" (
    echo [INFO] Найден файл: StairsEsp.ino.bin (0x10000)
    set FLASH_BIN_CMD=0x10000 "%~dp0StairsEsp.ino.bin"
    goto RUN_FLASH_AUTO
)

for %%F in ("%~dp0*.bin") do (
    echo [INFO] Найден файл: %%~nxF (0x10000)
    set FLASH_BIN_CMD=0x10000 "%%~fF"
    goto RUN_FLASH_AUTO
)

:RUN_FLASH_AUTO
if "%FLASH_BIN_CMD%"=="" (
    echo.
    echo ❌ [ОШИБКА] В папке "%~dp0" нет файлов прошивки (.bin)!
    echo.
    echo ⚠️ Убедитесь, что вы РАСПАКОВАЛИ zip архив в обычную папку.
    echo.
    pause
    goto MAIN_MENU
)

call :FIND_COM_PORT
if "%SELECTED_COM%"=="" (
    echo.
    echo ❌ [ОШИБКА] COM-порт не выбран.
    pause
    goto MAIN_MENU
)

echo.
echo ======================================================================
echo [*] Прошивка ESP32 на порту %SELECTED_COM%...
echo ======================================================================
echo.

if "%USE_PYTHON_ESPTOOL%"=="1" (
    python -m esptool --chip esp32 --port %SELECTED_COM% --baud 921600 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_BIN_CMD%
) else (
    "%ESPTOOL_EXE%" --chip esp32 --port %SELECTED_COM% --baud 921600 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_BIN_CMD%
)

if errorlevel 1 (
    echo.
    echo [!] Повтор на безопасной скорости 115200 бод...
    echo.
    if "%USE_PYTHON_ESPTOOL%"=="1" (
        python -m esptool --chip esp32 --port %SELECTED_COM% --baud 115200 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_BIN_CMD%
    ) else (
        "%ESPTOOL_EXE%" --chip esp32 --port %SELECTED_COM% --baud 115200 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_BIN_CMD%
    )
)

if errorlevel 1 (
    echo.
    echo ======================================================================
    echo ❌ НЕ УДАЛОСЬ ПРОШИТЬ ESP32!
    echo ======================================================================
    echo Возможные причины:
    echo  1. Зажмите и удерживайте кнопку BOOT на ESP32 при подключении к USB.
    echo  2. Порт %SELECTED_COM% занят (закройте Arduino IDE / Монитор порта).
    echo  3. Используется кабель без передачи данных (только питание).
    echo ======================================================================
    echo.
    pause
    goto MAIN_MENU
)

echo.
echo ======================================================================
echo  🎉 [УСПЕХ] Прошивка успешно загружена в ESP32!
echo ======================================================================
echo.
pause
goto POST_FLASH_DIALOG

:: -------------------------------------------------------------
:: 2. РУЧНОЙ ВЫБОР ФАЙЛА
:: -------------------------------------------------------------
:FLASH_MANUAL
cls
echo ======================================================================
echo  📁 [Режим 2] Ручной выбор локального файла прошивки
echo ======================================================================
echo.
call :PREPARE_ESPTOOL
if "%ESPTOOL_READY%"=="0" ( pause & goto MAIN_MENU )

set "CUSTOM_BIN="
set /p CUSTOM_BIN="Перетащите .bin файл мышкой в это окно или введите путь: "
if "%CUSTOM_BIN%"=="" goto MAIN_MENU
set CUSTOM_BIN=%CUSTOM_BIN:"=%

if not exist "%CUSTOM_BIN%" (
    echo.
    echo [ERROR] Файл не найден: "%CUSTOM_BIN%"
    pause
    goto MAIN_MENU
)

echo.
echo Выберите адрес смещения Flash памяти:
echo   [1] 0x10000 (Стандартная прошивка - РЕКОМЕНДУЕТСЯ)
echo   [2] 0x0     (Полный образ / Full Binary Image)
echo.
set "ADDR_CHOICE="
set /p ADDR_CHOICE="Адрес (1 или 2) [По умолчанию 1]: "
if "%ADDR_CHOICE%"=="2" (
    set FLASH_BIN_CMD=0x0 "%CUSTOM_BIN%"
) else (
    set FLASH_BIN_CMD=0x10000 "%CUSTOM_BIN%"
)

call :FIND_COM_PORT
if "%SELECTED_COM%"=="" ( pause & goto MAIN_MENU )

echo.
echo [*] Прошивка файла в ESP32...
if "%USE_PYTHON_ESPTOOL%"=="1" (
    python -m esptool --chip esp32 --port %SELECTED_COM% --baud 921600 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_BIN_CMD%
) else (
    "%ESPTOOL_EXE%" --chip esp32 --port %SELECTED_COM% --baud 921600 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect %FLASH_BIN_CMD%
)

if errorlevel 1 (
    echo.
    echo ❌ Ошибка прошивки.
    pause
    goto MAIN_MENU
)

echo.
echo 🎉 [УСПЕХ] Прошивка завершена!
pause
goto POST_FLASH_DIALOG

:: -------------------------------------------------------------
:: 3. СКАЧИВАНИЕ С GITHUB RELEASES
:: -------------------------------------------------------------
:FLASH_GITHUB
cls
echo ======================================================================
echo  🌐 [Режим 3] Загрузка последней версии с GitHub
echo ======================================================================
echo.
call :PREPARE_ESPTOOL
if "%ESPTOOL_READY%"=="0" ( pause & goto MAIN_MENU )

set "GH_REPO_URL=https://github.com/geminibitok-oss/ESP32-Smart-Staircase-Controller/releases/latest/download/firmware.bin"
set "DOWNLOADED_BIN=%~dp0github_firmware.bin"

echo [*] Загрузка firmware.bin с GitHub...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('%GH_REPO_URL%', '%DOWNLOADED_BIN%')"

if not exist "%DOWNLOADED_BIN%" (
    echo.
    echo ❌ [ОШИБКА] Не удалось скачать файл. Проверьте интернет.
    pause
    goto MAIN_MENU
)

echo [OK] Файл успешно скачан!
call :FIND_COM_PORT
if "%SELECTED_COM%"=="" ( pause & goto MAIN_MENU )

echo [*] Прошивка ESP32...
if "%USE_PYTHON_ESPTOOL%"=="1" (
    python -m esptool --chip esp32 --port %SELECTED_COM% --baud 921600 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect 0x10000 "%DOWNLOADED_BIN%"
) else (
    "%ESPTOOL_EXE%" --chip esp32 --port %SELECTED_COM% --baud 921600 --before default_reset --after hard_reset write_flash -z --flash_mode dio --flash_freq 40m --flash_size detect 0x10000 "%DOWNLOADED_BIN%"
)

if errorlevel 1 (
    echo.
    echo ❌ Ошибка при прошивке.
    pause
    goto MAIN_MENU
)

echo.
echo 🎉 [УСПЕХ] Прошивка с GitHub успешно загружена!
pause
goto POST_FLASH_DIALOG

:: -------------------------------------------------------------
:: 4. ПОЛНАЯ ОЧИСТКА ПАМЯТИ
:: -------------------------------------------------------------
:FLASH_ERASE
cls
echo ======================================================================
echo  🧹 [Режим 4] Полная очистка Flash памяти ESP32
echo ======================================================================
echo.
call :PREPARE_ESPTOOL
if "%ESPTOOL_READY%"=="0" ( pause & goto MAIN_MENU )

call :FIND_COM_PORT
if "%SELECTED_COM%"=="" ( pause & goto MAIN_MENU )

echo [*] Очистка Flash памяти...
if "%USE_PYTHON_ESPTOOL%"=="1" (
    python -m esptool --chip esp32 --port %SELECTED_COM% --baud 921600 erase_flash
) else (
    "%ESPTOOL_EXE%" --chip esp32 --port %SELECTED_COM% --baud 921600 erase_flash
)

echo.
echo [OK] Память полностью очищена!
pause
goto MAIN_MENU

:: -------------------------------------------------------------
:: 5. БЫСТРАЯ НАСТРОЙКА WI-FI
:: -------------------------------------------------------------
:SETUP_WIFI
cls
echo ======================================================================
echo  📶 [Режим 5] Настройка Wi-Fi через USB
echo ======================================================================
echo.
set "WIFI_SSID="
set /p WIFI_SSID="1. Имя домашнего Wi-Fi (SSID): "
set "WIFI_PASS="
set /p WIFI_PASS="2. Пароль от Wi-Fi: "

call :FIND_COM_PORT
if "%SELECTED_COM%"=="" ( pause & goto MAIN_MENU )

echo.
echo [*] Отправка данных Wi-Fi в память ESP32...
powershell -Command "$p=New-Object System.IO.Ports.SerialPort '%SELECTED_COM%',115200,None,8,one;$p.Open();Start-Sleep -Milliseconds 400;$p.WriteLine('SET:wifi_ssid=%WIFI_SSID%');Start-Sleep -Milliseconds 200;$p.WriteLine('SET:wifi_pass=%WIFI_PASS%');Start-Sleep -Milliseconds 200;$p.WriteLine('SAVE');Start-Sleep -Milliseconds 500;$p.Close()"

echo [OK] Настройки сохранены! Плата перезагружается и подключается к '%WIFI_SSID%'.
echo.
pause
goto MAIN_MENU

:: -------------------------------------------------------------
:: 6. ПОЛНЫЙ МАСТЕР НАСТРОЙКИ
:: -------------------------------------------------------------
:SETUP_WIZARD
cls
echo ======================================================================
echo  ⚙️  [Режим 6] Мастер настройки параметров лестницы
echo ======================================================================
echo.
set /p CFG_SSID="1. Имя Wi-Fi (SSID): "
set /p CFG_PASS="2. Пароль от Wi-Fi: "
set /p CFG_STEPS="3. Количество ступеней [16]: "
set /p CFG_LEDS="4. Диодов на ступень [30]: "
set /p CFG_SPEED="5. Скорость шага в мс [60]: "
set /p CFG_HOLD="6. Время свечения в сек [15]: "
set /p CFG_BRI="7. Яркость (10-255) [220]: "
set /p CFG_PIN_LED="8. GPIO пин ленты [4]: "
set /p CFG_PIN_BOT="9. GPIO нижнего датчика [22]: "
set /p CFG_PIN_TOP="10. GPIO верхнего датчика [23]: "

call :FIND_COM_PORT
if "%SELECTED_COM%"=="" ( pause & goto MAIN_MENU )

echo.
echo [*] Запись настроек в ESP32...
powershell -Command ^
    "$p=New-Object System.IO.Ports.SerialPort '%SELECTED_COM%',115200,None,8,one;$p.Open();Start-Sleep -Milliseconds 500;" ^
    "if ('%CFG_SSID%' -ne '') { $p.WriteLine('SET:wifi_ssid=%CFG_SSID%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_PASS%' -ne '') { $p.WriteLine('SET:wifi_pass=%CFG_PASS%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_STEPS%' -ne '') { $p.WriteLine('SET:step_count=%CFG_STEPS%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_LEDS%' -ne '') { $p.WriteLine('SET:leds_per_step=%CFG_LEDS%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_SPEED%' -ne '') { $p.WriteLine('SET:step_speed=%CFG_SPEED%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_HOLD%' -ne '') { $p.WriteLine('SET:hold_time=%CFG_HOLD%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_BRI%' -ne '') { $p.WriteLine('SET:brightness=%CFG_BRI%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_PIN_LED%' -ne '') { $p.WriteLine('SET:pin_led=%CFG_PIN_LED%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_PIN_BOT%' -ne '') { $p.WriteLine('SET:pin_sensor_bot=%CFG_PIN_BOT%'); Start-Sleep -Milliseconds 150; }" ^
    "if ('%CFG_PIN_TOP%' -ne '') { $p.WriteLine('SET:pin_sensor_top=%CFG_PIN_TOP%'); Start-Sleep -Milliseconds 150; }" ^
    "$p.WriteLine('SAVE'); Start-Sleep -Milliseconds 500; $p.Close();"

echo [OK] Все параметры сохранены!
pause
goto MAIN_MENU

:: -------------------------------------------------------------
:: 7. МОНИТОР SERIAL ПОРТА
:: -------------------------------------------------------------
:SERIAL_MONITOR
cls
call :FIND_COM_PORT
if "%SELECTED_COM%"=="" ( pause & goto MAIN_MENU )

echo ======================================================================
echo  📟 Подключение к %SELECTED_COM% (115200 бод)...
echo  💡 Нажмите Ctrl+C для выхода в главное меню
echo ======================================================================
echo.
powershell -Command "$p=New-Object System.IO.Ports.SerialPort '%SELECTED_COM%',115200,None,8,one;$p.Open();while($true){if($p.BytesToRead -gt 0){Write-Host -NoNewline $p.ReadExisting()} Start-Sleep -Milliseconds 25}"
pause
goto MAIN_MENU

:: -------------------------------------------------------------
:: Вспомогательный диалог после прошивки
:: -------------------------------------------------------------
:POST_FLASH_DIALOG
echo Выберите следующее действие:
echo   [1] 📶 Настроить Wi-Fi прямо сейчас через USB (Рекомендуется)
echo   [2] 📟 Открыть монитор Serial порта (Посмотреть IP адрес)
echo   [3] 🔙 Главное меню
echo.
set "POST_ACTION="
set /p POST_ACTION="Ваш выбор (1-3) [По умолчанию 1]: "
if "%POST_ACTION%"=="" set POST_ACTION=1
if "%POST_ACTION%"=="1" goto SETUP_WIFI
if "%POST_ACTION%"=="2" goto SERIAL_MONITOR
goto MAIN_MENU

:: -------------------------------------------------------------
:: Хелпер: Поиск esptool
:: -------------------------------------------------------------
:PREPARE_ESPTOOL
set "ESPTOOL_READY=0"
set "USE_PYTHON_ESPTOOL=0"
set "ESPTOOL_EXE="

if exist "%~dp0esptool.exe" (
    set "ESPTOOL_EXE=%~dp0esptool.exe"
    set "ESPTOOL_READY=1"
    goto :EOF
)

if exist "%~dp0tools\esptool.exe" (
    set "ESPTOOL_EXE=%~dp0tools\esptool.exe"
    set "ESPTOOL_READY=1"
    goto :EOF
)

where esptool.exe >nul 2>&1
if not errorlevel 1 (
    set "ESPTOOL_EXE=esptool.exe"
    set "ESPTOOL_READY=1"
    goto :EOF
)

where python >nul 2>&1
if not errorlevel 1 (
    python -m esptool version >nul 2>&1
    if not errorlevel 1 (
        set "USE_PYTHON_ESPTOOL=1"
        set "ESPTOOL_READY=1"
        goto :EOF
    )
)

:: Скачивание esptool.exe
echo [*] Загрузка официального esptool.exe от Espressif...
powershell -Command ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
    "try {" ^
    "  $url = 'https://github.com/espressif/esptool/releases/download/v4.7.0/esptool-v4.7.0-win64.zip';" ^
    "  $z = '%temp%\esptool_tmp.zip';" ^
    "  (New-Object System.Net.WebClient).DownloadFile($url, $z);" ^
    "  Expand-Archive -Path $z -DestinationPath '%temp%\esptool_unzip' -Force;" ^
    "  $exe = Get-ChildItem -Path '%temp%\esptool_unzip' -Filter 'esptool.exe' -Recurse | Select-Object -First 1;" ^
    "  if ($exe) { Copy-Item $exe.FullName -Destination '%~dp0esptool.exe' -Force }" ^
    "  Remove-Item $z -Force -ErrorAction SilentlyContinue;" ^
    "  Remove-Item '%temp%\esptool_unzip' -Recurse -Force -ErrorAction SilentlyContinue;" ^
    "} catch {}"

if exist "%~dp0esptool.exe" (
    set "ESPTOOL_EXE=%~dp0esptool.exe"
    set "ESPTOOL_READY=1"
    echo [OK] esptool.exe успешно подготовлен!
)
goto :EOF

:: -------------------------------------------------------------
:: Хелпер: Поиск COM-порта
:: -------------------------------------------------------------
:FIND_COM_PORT
set "SELECTED_COM="
echo [*] Поиск подключенного COM-порта ESP32...

powershell -Command ^
    "$p = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object);" ^
    "if ($p.Count -eq 0) { [System.IO.File]::WriteAllText('%temp%\esp_port_sel.txt', 'NONE'); exit };" ^
    "$usb = @($p | Where-Object { $_ -ne 'COM1' });" ^
    "$sel = if ($usb.Count -gt 0) { $usb[0] } else { $p[0] };" ^
    "[System.IO.File]::WriteAllText('%temp%\esp_port_sel.txt', $sel);"

if exist "%temp%\esp_port_sel.txt" (
    set /p SELECTED_COM=<"%temp%\esp_port_sel.txt"
    del /f /q "%temp%\esp_port_sel.txt" >nul 2>&1
)

if "%SELECTED_COM%"=="NONE" set "SELECTED_COM="

if "%SELECTED_COM%"=="" (
    echo [!] COM-порт не найден автоматически.
    set /p SELECTED_COM="Введите имя COM-порта вручную (например COM3 или COM12): "
)

if not "%SELECTED_COM%"=="" (
    echo [OK] Выбран порт: %SELECTED_COM%
)
goto :EOF

:SCRIPT_EXIT
exit /b 0
