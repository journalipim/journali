@echo off
rem Webseite (site\) veroeffentlichen: tools\site publish | check
rem publish - laedt site\ per WinSCP in die gespeicherte Sitzung "journali" (Zugang liegt in WinSCP, nie im Repo);
rem           nur Neues/Geaendertes, nichts wird auf dem Server geloescht
rem check   - zeigt, was publish hochladen wuerde (Trockenlauf)
setlocal
set ROOT=%~dp0..
set WINSCP=%LOCALAPPDATA%\Programs\WinSCP\WinSCP.com
if not exist "%WINSCP%" set WINSCP=C:\Program Files (x86)\WinSCP\WinSCP.com
if not exist "%WINSCP%" ( echo WinSCP nicht gefunden & exit /b 2 )

if "%~1"=="publish" goto publish
if "%~1"=="check"   goto check
echo Aufruf: tools\site publish ^| check
exit /b 2

:publish
"%WINSCP%" /command "open journali" "synchronize remote -criteria=either ""%ROOT%\site"" /" "exit"
exit /b %errorlevel%

:check
"%WINSCP%" /command "open journali" "synchronize remote -preview -criteria=either ""%ROOT%\site"" /" "exit"
exit /b %errorlevel%
