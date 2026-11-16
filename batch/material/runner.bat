@echo off
setlocal EnableDelayedExpansion

REM ==================================================
REM Project Root
REM ==================================================
set "APP_BASE_PATH=%~dp0..\.."
cd /d "%APP_BASE_PATH%"

REM Resolve clean absolute path without relative '..' segments
set "APP_BASE_PATH=%CD%"
echo Current Directory: %APP_BASE_PATH%

REM Define default directories
set "PLAYWRIGHT_DIR=%APP_BASE_PATH%\tests\semiskilled"
set "NODE_DIR=%APP_BASE_PATH%\src\semiskilled"

echo PLAYWRIGHT_DIR is set to: %PLAYWRIGHT_DIR%
echo NODE_DIR is set to: %NODE_DIR%

echo.
echo MATERIAL FTO Report Automation Script