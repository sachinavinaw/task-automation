@echo off
cd /d "%~dp0"

powershell -WindowStyle Hidden -Command "Start-Process cmd -ArgumentList '/c npm start' -WindowStyle Hidden"