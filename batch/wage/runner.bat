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
set "PLAYWRIGHT_DIR=%APP_BASE_PATH%\tests\wage"
set "NODE_DIR=%APP_BASE_PATH%\src\wage"

echo PLAYWRIGHT_DIR is set to: %PLAYWRIGHT_DIR%
echo NODE_DIR is set to: %NODE_DIR%

echo.
echo WAGE FTO Report Automation Script

echo ==================================================
echo Step-1: Create FTO_Report.xlsx by block name
echo ==================================================
echo.

:: Use --% to disable cmd.exe parsing so the quoted grep pattern is preserved accurately
call npx playwright test tests/wage/blockdata.spec.js --% --grep "Download FTO Report for block" --reporter=line

if errorlevel 1 (
    echo.
    echo Step-1 FAILED.
    exit /b !ERRORLEVEL!
)

echo.
echo ==================================================
echo Step-2: Prepare FTO_Report.json from FTO_Report.xlsx
echo ==================================================
echo.

pushd "%NODE_DIR%"
call node ftoExcelToJsonConverter.js
popd

if errorlevel 1 (
    echo.
    echo Step-2 FAILED.
    exit /b !ERRORLEVEL!
)

echo.
echo ==================================================
echo Step-3: Get Panchayat Name details and create FTO_Report_With_Panchayat.json
echo ==================================================
echo.

call npx playwright test tests/wage/panchayat.spec.js --% --grep "Fetch Panchayat Name from FTO links" --reporter=line

if errorlevel 1 (
    echo.
    echo Step-3 FAILED.
    exit /b !ERRORLEVEL!
)

echo.
echo ==================================================
echo Step-4: Merge files and create FTO_Report_With_Panchayat.xlsx
echo ==================================================
echo.

pushd "%NODE_DIR%"
call node mergeFtoReport.js
popd

if errorlevel 1 (
    echo.
    echo Step-4 FAILED.
    exit /b !ERRORLEVEL!
)

echo.
echo ==================================================
echo [WAGE] ALL STEPS COMPLETED SUCCESSFULLY
echo ==================================================

exit /b 0