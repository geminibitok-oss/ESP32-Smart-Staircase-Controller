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
    "$rawPorts = [System.IO.Ports.SerialPort]::GetPortNames();" ^
    "if (-not $rawPorts -or $rawPorts.Length -eq 0) { [System.IO.File]::WriteAllText('%temp%\esp_ports.txt', 'NO_PORTS'); exit }" ^
    "$ports = @($rawPorts | Sort-Object);" ^
    "$usbPorts = @($ports | Where-Object { $_ -ne 'COM1' });" ^
    "$def = if ($usbPorts.Count -gt 0) { $usbPorts[0] } else { $ports[0] };" ^
    "$i = 1;" ^
    "foreach ($p in $ports) {" ^
    "  $rec = if ($p -eq $def) { ' (Рекомендуется)' } else { '' };" ^
    "  Write-Host ('  [' + $i + '] ' + $p + $rec);" ^
    "  $i++;" ^
    "}" ^
    "[System.IO.File]::WriteAllText('%temp%\esp_ports.txt', ($def + '|' + ($ports -join ',')));"

if exist "%temp%\esp_ports.txt" (
    set /p PORTS_INFO=<"%temp%\esp_ports.txt"
    del /f /q "%temp%\esp_ports.txt" >nul 2>&1
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
        "if ($in -match '^\d+$') {" ^
        "  $idx = [int]$in - 1;" ^
        "  if ($idx -ge 0 -and $idx -lt $all.Count) { $res = $all[$idx] } else { $res = ('COM' + $in) }" ^
        "} else {" ^
        "  if (-not $in.ToUpper().StartsWith('COM')) { $res = 'COM' + $in } else { $res = $in.ToUpper() }" ^
        "}" ^
        "[System.IO.File]::WriteAllText('%temp%\esp_sel.txt', $res);"
    set /p CHOSEN_PORT=<"%temp%\esp_sel.txt"
    del /f /q "%temp%\esp_sel.txt" >nul 2>&1
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
    "  Start-Sleep -Milliseconds 200;" ^
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
    "      Write-Host -NoNewline ('\n[Команда]: ' + $k.KeyChar);" ^
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
