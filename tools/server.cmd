@echo off
rem Entwicklungsserver auf dem PC: tools\server start | stop | restart | status
rem start  - dotnet run in eigenem Fenster "journali" (localhost:5000)
rem stop   - beendet Journali.Server.exe; das dotnet-run-Fenster schliesst mit
rem status - GET /health
setlocal
set ROOT=%~dp0..

if "%~1"=="start"   goto start
if "%~1"=="stop"    goto stop
if "%~1"=="restart" goto restart
if "%~1"=="status"  goto status
echo Aufruf: tools\server start ^| stop ^| restart ^| status
exit /b 2

:start
start "journali" /D "%ROOT%" dotnet run --project Journali.Server
exit /b 0

:stop
taskkill /im Journali.Server.exe /f >nul 2>&1 && echo gestoppt || echo lief nicht
exit /b 0

:restart
call "%~f0" stop
call "%~f0" start
exit /b 0

:status
curl -s -m 2 localhost:5000/health || echo laeuft nicht
echo.
exit /b 0
