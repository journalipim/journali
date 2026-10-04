@echo off
rem Dateien der Webseite (site\) hochladen: tools\site publish | check
rem Seit 04.10.2026 laeuft die Seite mit WordPress: Startseite, Impressum und Datenschutz kommen ueber tools\blog.mjs als Seiten dorthin. Hochgeladen
rem werden nur noch die Logos — eine index.html, impressum.html oder datenschutz.html in der Wurzel verdeckte die Seiten von WordPress.
rem publish - laedt die Logos aus site\ per WinSCP in die gespeicherte Sitzung "journali" (Zugang liegt in WinSCP, nie im Repo);
rem           nur Neues/Geaendertes, nichts wird auf dem Server geloescht
rem check   - zeigt, was publish hochladen wuerde (Trockenlauf)
setlocal
set ROOT=%~dp0..
set WINSCP=%LOCALAPPDATA%\Programs\WinSCP\WinSCP.com
if not exist "%WINSCP%" set WINSCP=C:\Program Files (x86)\WinSCP\WinSCP.com
if not exist "%WINSCP%" ( echo WinSCP not found & exit /b 2 )

if "%~1"=="publish" goto publish
if "%~1"=="check"   goto check
echo usage: tools\site publish ^| check
exit /b 2

:publish
"%WINSCP%" /command "open journali" "synchronize remote -criteria=either -filemask=""logo*.png"" ""%ROOT%\site"" /" "exit"
exit /b %errorlevel%

:check
"%WINSCP%" /command "open journali" "synchronize remote -preview -criteria=either -filemask=""logo*.png"" ""%ROOT%\site"" /" "exit"
exit /b %errorlevel%
