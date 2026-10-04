@echo off
rem Demo-Daten in eine laufende journali-Instanz: aus jedem Verzeichnis, ohne Parameter. Fragt nach Adresse, Anwender und Passwort.
rem Parameter gehen durch: demo-daten.cmd --url http://server:5000 --user admin
setlocal
python -c "import requests, PIL" 2>nul || python -m pip install --quiet requests pillow
python "%~dp0demo_master_tree.py" %*
endlocal
pause
