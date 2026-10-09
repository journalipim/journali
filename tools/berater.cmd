@echo off
rem Produktberater auf dem PC: tools\berater [start] [key] ^| stop ^| status ^| pruefen [key] [dialog] ^| token ^<key^> ^<ja_...^>
rem start   - (auch ohne Befehl) startet den Dienst (plugins\advisor\serve.mjs, localhost:8190) und den Testaufbau
rem           (tools\berater-test, Testseite localhost:8191) in eigenen Fenstern und oeffnet die Testseite im Browser.
rem           journali muss laufen (tools\server start). Am Berater steht unter "Websites" http://localhost:8191,
rem           sonst antwortet der Dienst dem Browser mit 403. Das Lernen liegt in %USERPROFILE%\.journali\advisor-<key>\lernen.json
rem stop    - beendet Dienst und Testseite
rem status  - GET /health des Dienstes
rem pruefen - spielt den Pruefstand (tools\berater-dialoge) mit dem abgelegten Token gegen localhost:5000
rem token   - legt ein neues Token des Beraters ab (journali: Export - Produktberatung - + Token), ausserhalb des Repos:
rem           %USERPROFILE%\.journali\advisor-<key>.token - nur noetig, wenn das alte widerrufen ist
rem Ohne key gilt "shop". Die Ports sind 8190/8191, weil 8090 auf manchen Rechnern belegt ist.
rem Die Ausgaben sind englisch wie die Konsole des Servers.
setlocal
set ROOT=%~dp0..
set KEY=%~2
if "%KEY%"=="" set KEY=shop
set TOKENFILE=%USERPROFILE%\.journali\advisor-%KEY%.token
set DIENST=8190
set SEITE=8191

if "%~1"==""        goto start
if "%~1"=="start"   goto start
if "%~1"=="stop"    goto stop
if "%~1"=="status"  goto status
if "%~1"=="pruefen" goto pruefen
if "%~1"=="token"   goto token
echo usage: tools\berater [start] [key] ^| stop ^| status ^| pruefen [key] [dialog] ^| token ^<key^> ^<ja_...^>
exit /b 2

:token
if "%~3"=="" ( echo usage: tools\berater token ^<key^> ^<ja_...^> & exit /b 2 )
if not exist "%USERPROFILE%\.journali" mkdir "%USERPROFILE%\.journali"
> "%TOKENFILE%" echo %~3
echo token for advisor %KEY% saved in %TOKENFILE%
exit /b 0

:start
if not exist "%TOKENFILE%" ( echo no token for advisor %KEY% in %TOKENFILE% - journali: Export - Produktberatung - + Token, then: tools\berater token %KEY% ja_... & exit /b 2 )
curl -sf -m 2 -o nul localhost:5000/api/health || ( echo journali is not running - first: tools\server start & exit /b 1 )
call "%~f0" stop >nul
netstat -ano | findstr /r /c:"127.0.0.1:%DIENST% .*LISTENING" /c:"0.0.0.0:%DIENST% .*LISTENING" /c:"\[::\]:%DIENST% .*LISTENING" >nul && ( echo port %DIENST% is used by another program & exit /b 1 )
start "journali berater" /D "%ROOT%" cmd /k "set JOURNALI=http://localhost:5000&& set JOURNALI_ADVISOR=%KEY%&& set JOURNALI_ADVISOR_TOKEN_FILE=%TOKENFILE%&& set JOURNALI_ADVISOR_DATA=%USERPROFILE%\.journali\advisor-%KEY%&& set PORT=%DIENST%&& node plugins\advisor\serve.mjs"
start "journali berater testseite" /D "%ROOT%" cmd /k "node tools\berater-test\testseite.mjs --port %SEITE% --dienst http://localhost:%DIENST%"
echo advisor %KEY% starting ...
for /l %%i in (1,1,20) do (
  curl -sf -m 2 -o nul localhost:%DIENST%/health && (echo running - service http://localhost:%DIENST%, test page http://localhost:%SEITE% & start "" http://localhost:%SEITE% & exit /b 0)
  ping -n 2 127.0.0.1 >nul
)
echo the service does not answer - see the window "journali berater" (token revoked? advisor key wrong?)
exit /b 1

:stop
taskkill /fi "windowtitle eq journali berater*" /t /f >nul 2>&1 && echo stopped || echo was not running
exit /b 0

:status
curl -s -m 2 localhost:%DIENST%/health || echo not running
echo.
exit /b 0

:pruefen
if not exist "%TOKENFILE%" ( echo no token for advisor %KEY% in %TOKENFILE% & exit /b 2 )
set /p TOKEN=<"%TOKENFILE%"
if "%~3"=="" ( node "%ROOT%\tools\berater-dialoge\spiele.mjs" --journali http://localhost:5000 --berater %KEY% --token %TOKEN% ) else ( node "%ROOT%\tools\berater-dialoge\spiele.mjs" --journali http://localhost:5000 --berater %KEY% --token %TOKEN% --dialog %~3 )
exit /b %errorlevel%
