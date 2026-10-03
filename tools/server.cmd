@echo off
rem Entwicklung auf dem PC: tools\server start | stop | restart | status | web | build
rem start   - Server per dotnet run in eigenem Fenster "journali" (localhost:5000), Log zusaetzlich in tools\server.log; das Fenster bleibt nach dem
rem           Ende offen, damit man sieht, warum. Ohne Datenbank zeigt http://localhost:5000 die Einrichtung
rem           Umgebung aus Journali.Server\Properties\launchSettings.json (dotnet run liest sie), darunter
rem           JOURNALI_LIZENZSERVER
rem stop    - beendet Journali.Server.exe
rem status  - GET /api/health
rem web     - Vite-Entwicklungsserver in eigenem Fenster (localhost:5173, Hot Reload,
rem           /api geht an :5000) - zum Arbeiten an der Oberflaeche
rem build   - Oberflaeche nach Journali.Server\wwwroot bauen und die gebauten Plugins (plugins\<key>\src -> entry.js);
rem           danach liefert :5000 alles aus. tools\server plugins [key] baut nur die Plugins
setlocal
set ROOT=%~dp0..

if "%~1"=="start"   goto start
if "%~1"=="stop"    goto stop
if "%~1"=="restart" goto restart
if "%~1"=="status"  goto status
if "%~1"=="web"     goto web
if "%~1"=="build"   goto build
if "%~1"=="plugins" goto plugins
echo Aufruf: tools\server start ^| stop ^| restart ^| status ^| web ^| build ^| plugins [key]
exit /b 2

:start
rem Die Ausgabe steht im Fenster und zugleich in tools\server.log (jeder Start beginnt die Datei neu) - so laesst sich das Log auch von aussen lesen
start "journali" /D "%ROOT%" powershell -NoProfile -NoExit -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; $l='%ROOT%\tools\server.log'; Set-Content $l ''; cmd /c 'dotnet run --project Journali.Server 2>&1' | ForEach-Object { $_; [IO.File]::AppendAllText($l, ($_ | Out-String)) }"
goto warten

rem Warten, bis der Server antwortet (der erste Start uebersetzt noch) — und es sagen
:warten
echo Server startet ...
for /l %%i in (1,1,90) do (
  curl -s -m 2 localhost:5000/api/health 2>nul | findstr /c:"\"setup\"" >nul && (echo wartet auf die Einrichtung der Datenbank - http://localhost:5000, Code im Fenster "journali" & exit /b 0)
  curl -sf -m 2 -o nul localhost:5000/api/health && (echo laeuft - http://localhost:5000 & exit /b 0)
  ping -n 2 127.0.0.1 >nul
)
echo kam nicht hoch - siehe Fenster "journali"
exit /b 1

:stop
taskkill /im Journali.Server.exe /f >nul 2>&1 && echo gestoppt || echo lief nicht
exit /b 0

:restart
call "%~f0" stop
call "%~f0" start
exit /b 0

:status
curl -s -m 2 localhost:5000/api/health || echo laeuft nicht
echo.
exit /b 0

:web
if not exist "%ROOT%\web\node_modules" (cd /d "%ROOT%\web" && call npm install)
start "journali web" /D "%ROOT%\web" npm run dev
exit /b 0

:build
cd /d "%ROOT%\web"
if not exist node_modules call npm install
call npm run build
exit /b %errorlevel%

:plugins
cd /d "%ROOT%\web"
if not exist node_modules call npm install
call node build-plugins.mjs %2
exit /b %errorlevel%
