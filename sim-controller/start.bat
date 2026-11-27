@echo off
REM Starts the sim controller: waits for the phone/tablet, forwards the port,
REM opens the dashboard on the device, and runs the server.
REM Requires: adb in PATH, Python 3.10+ with requirements installed.

cd /d "%~dp0"

echo Waiting for an Android device with USB debugging...
adb wait-for-device

adb reverse tcp:8000 tcp:8000
adb shell am start -a android.intent.action.VIEW -d "http://localhost:8000"

python server.py
