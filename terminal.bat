@echo off
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
    "$ports = [System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object;" ^
    "if ($ports.Count -eq 0) { 'NO_PORTS'; exit }" ^
    "$usbPorts = $ports | Where-Object { $_ -ne 'COM1' };" ^
    "$defaultPort = if ($usbPorts.Count -gt 0) { $usbPorts[0] } else { $ports[0] };" ^
    "$i = 1;" ^
    "foreach ($p in $ports) {" ^
    "  $rec = if ($p -eq $defaultPort) { ' (Рекомендуется)' } else { '' };" ^
    "  Write-Host ('  [' + $i + '] ' + $p + $rec);" ^
    "  $i++;" ^
    "}" ^
    "$defaultPort | Out-File -Encoding ascii '%temp%\esp_def_port.txt';" ^
    "($ports -join ',') | Out-File -Encoding ascii '%temp%\esp_all_ports.txt';"

if exist "%temp%\esp_def_port.txt" (
    set /p DEFAULT_PORT=<"%temp%\esp_def_port.txt"
    del /f /q "%temp%\esp_def_port.txt" >nul 2>&1
)

if "%DEFAULT_PORT%"=="NO_PORTS" (
    echo.
    echo ❌ [ОШИБКА] Ни одного COM-порта не обнаружено!
    echo Убедитесь, что ESP32 подключена по USB-кабелю и установлены драйверы CH340 / CP2102.
    echo.
    pause
    exit /b 1
)

if exist "%temp%\esp_all_ports.txt" (
    set /p ALL_PORTS=<"%temp%\esp_all_ports.txt"
    del /f /q "%temp%\esp_all_ports.txt" >nul 2>&1
)

echo.
echo Нажмите ENTER для выбора [%DEFAULT_PORT%] или введите номер/имя порта:
set "USER_INPUT="
set /p USER_INPUT="Выбор [%DEFAULT_PORT%]: "

set "CHOSEN_PORT=%DEFAULT_PORT%"
if not "%USER_INPUT%"=="" (
    :: Check if user typed number like 1, 2, 3
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$inputVal = '%USER_INPUT%'.Trim();" ^
        "$all = '%ALL_PORTS%'.Split(',');" ^
        "if ($inputVal -match '^\d+$') {" ^
        "  $idx = [int]$inputVal - 1;" ^
        "  if ($idx -ge 0 -and $idx -lt $all.Count) { $all[$idx] } else { $all[0] }" ^
        "} else {" ^
        "  if (-not $inputVal.ToUpper().StartsWith('COM')) { 'COM' + $inputVal } else { $inputVal.ToUpper() }" ^
        "}" > "%temp%\esp_chosen_port.txt"
    set /p CHOSEN_PORT=<"%temp%\esp_chosen_port.txt"
    del /f /q "%temp%\esp_chosen_port.txt" >nul 2>&1
)

echo.
echo ======================================================================
echo  🔌 Подключение к %CHOSEN_PORT% на скорости 115200 бод...
echo  💡 Полезные команды (вводите в окно консоли):
echo     STATUS           - Узнать IP-адрес, статус Wi-Fi и ступени
echo     WIFI=SSID,PASS   - Настроить подключение к домашнему Wi-Fi
echo     STEPS=16         - Изменить число ступеней (1-32)
echo     REBOOT           - Перезагрузить плату
echo     HELP             - Список всех команд
echo ======================================================================
echo.

:: 2. Robust Serial Monitor & Command Sender via PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$portName = '%CHOSEN_PORT%';" ^
    "try {" ^
    "  $port = New-Object System.IO.Ports.SerialPort $portName, 115200, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One;" ^
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
    "      Write-Host -NoNewline ('\n[Ввод команды]: ' + $k.KeyChar);" ^
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
