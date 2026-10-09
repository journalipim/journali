@echo off
rem Produktberater auf dem PC: tools\berater token ^<key^> ^<ja_...^> ^| start [key] ^| stop ^| status ^| pruefen [key] [dialog]
rem token   - das Token des Beraters (journali: Export - Produktberatung - + Token) einmal ablegen, ausserhalb des Repos:
rem           %USERPROFILE%\.journali\advisor-<key>.token
rem start   - startet den Dienst (plugins\advisor\serve.mjs, localhost:8090) und den Testaufbau (tools\berater-test, Testseite localhost:8091)
rem           in eigenen Fenstern und oeffnet die Testseite im Browser. journali muss laufen (tools\server start). Am Berater muss unter
rem           "Websites" http://localhost:8091 stehen, sonst antwortet der Dienst dem Browser mit 403.
rem           Das Lernen liegt in %USERPROFILE%\.journali\advisor-<key>\lernen.json
rem stop    - beendet Dienst und Testseite
rem status  - GET /health des Dienstes
rem pruefen - spielt den Pruefstand (tools\berater-dialoge) mit dem abgelegten Token gegen localhost:5000
rem Ohne key gilt "shop". Die Ausgaben sind englisch wie die Konsole des Servers.
setlocal
set ROOT=%~dp0..
set KEY=%~2
if "%KEY%"=="" set KEY=shop
set TOKENFILE=%USERPROFILE%\.journali\advisor-%KEY%.token

if "%~1"=="token"   goto token
if "%~1"=="start"   goto start
if "%~1"=="stop"    goto stop
if "%~1"=="status"  goto status
if "%~1"=="pruefen" goto pruefen
echo usage: tools\berater token ^<key^> ^<ja_...^> ^| start [key] ^| stop ^| status ^| pruefen [key] [dialog]
exit /b 2

:token
if "%~3"=="" ( echo usage: tools\berater token ^<key^> ^<ja_...^> & exit /b 2 )
if not exist "%USERPROFILE%\.journali" mkdir "%USERPROFILE%\.journali"
> "%TOKENFILE%" echo %~3
echo token for advisor %KEY% saved in %TOKENFILE%
exit /b 0

:start
if not exist "%TOKENFILE%" ( echo no token for advisor %KEY% - first: tools\berater token %KEY% ja_... & exit /b 2 )
curl -sf -m 2 -o nul localhost:5000/api/health || ( echo journali is not running - first: tools\server start & exit /b 1 )
call "%~f0" stop >nul
start "journali berater" /D "%ROOT%" cmd /k "set JOURNALI=http://localhost:5000&& set JOURNALI_ADVISOR=%KEY%&& set JOURNALI_ADVISOR_TOKEN_FILE=%TOKENFILE%&& set JOURNALI_ADVISOR_DATA=%USERPROFILE%\.journali\advisor-%KEY%&& set PORT=8090&& node plugins\advisor\serve.mjs"
start "journali berater testseite" /D "%ROOT%" cmd /k "node tools\berater-test\testseite.mjs --port 8091 --dienst http://localhost:8090"
echo advisor %KEY% starting ...
for /l %%i in (1,1,20) do (
  curl -sf -m 2 -o nul localhost:8090/health && (echo running - service http://localhost:8090, test page http://localhost:8091 & start "" http://localhost:8091 & exit /b 0)
  ping -n 2 127.0.0.1 >nul
)
echo the service does not answer - see the window "journali berater" (token revoked? advisor key wrong?)
exit /b 1

:stop
taskkill /fi "windowtitle eq journali berater*" /t /f >nul 2>&1 && echo stopped || echo was not running
exit /b 0

:status
curl -s -m 2 localhost:8090/health || echo not running
echo.
exit /b 0

:pruefen
if not exist "%TOKENFILE%" ( echo no token for advisor %KEY% - first: tools\berater token %KEY% ja_... & exit /b 2 )
set /p TOKEN=<"%TOKENFILE%"
if "%~3"=="" ( node "%ROOT%\tools\berater-dialoge\spiele.mjs" --journali http://localhost:5000 --berater %KEY% --token %TOKEN% ) else ( node "%ROOT%\tools\berater-dialoge\spiele.mjs" --journali http://localhost:5000 --berater %KEY% --token %TOKEN% --dialog %~3 )
exit /b %errorlevel%
