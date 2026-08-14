@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ESP32 Serial Monitor (115200 baud)

echo ======================================================
echo       ESP32 Serial Monitor & Debug Console
echo ======================================================
echo.
echo Scanning available COM ports on your PC...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.IO.Ports.SerialPort]::getportnames()"
echo.
set /p COMPORT="Enter COM port (e.g. COM3, COM4, COM5): "
if "%COMPORT%"=="" set COMPORT=COM3

echo.
echo [*] Opening %COMPORT% at 115200 baud...
echo [*] Press Ctrl+C to exit monitor.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$port = new-Object System.IO.Ports.SerialPort '%COMPORT%',115200,None,8,one; try { $port.open(); Write-Host '--- Connected to %COMPORT% (115200 baud) ---' -ForegroundColor Green; while ($true) { $line = $port.ReadLine(); Write-Host $line } } catch { Write-Host 'Failed to connect or port is busy by another program.' -ForegroundColor Red } finally { $port.close() }"

echo.
pause
