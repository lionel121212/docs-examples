@echo off
REM Sim Controller launcher.
REM Starts the server, then every time a phone/tablet is plugged in over USB:
REM installs the app if missing, forwards the port and opens the app.
setlocal
cd /d "%~dp0"
title Sim Controller
set PKG=com.simcontroller

start "Sim Controller Server" /min python server.py

:loop
echo Waiting for a phone or tablet on USB...
adb wait-for-device
adb shell pm path %PKG% | findstr /c:"package:" >nul || adb install -r "apk\SimController.apk"
adb reverse tcp:8000 tcp:8000
adb shell am start -n %PKG%/.MainActivity
echo Connected. Unplug the cable to stop; plug it in again to reopen.
adb wait-for-disconnect
goto loop
