@echo off
REM Runs start.bat automatically every time you sign in to Windows.
schtasks /create /tn "Sim Controller" /tr "\"%~dp0start.bat\"" /sc onlogon /f
echo Done. Sim Controller will start when you sign in to Windows.
pause
