@echo off
setlocal EnableDelayedExpansion

echo ==================================================
echo Step-1: Create FTO_Report.xlsx by block name
echo ==================================================

call npx playwright test --grep "Download FTO Report for block" --reporter=line

if errorlevel 1 (
    echo.
    echo Step-1 FAILED.
    exit /b !ERRORLEVEL!
)

echo.
echo ==================================================
echo Step-2: Prepare FTO_Report.json from FTO_Report.xlsx
echo ==================================================

call node .\src\ftoExcelToJsonConverter.js

if errorlevel 1 (
    echo.
    echo Step-2 FAILED.
    exit /b !ERRORLEVEL!
)

echo.
echo ==================================================
echo Step-3: Get Panchayat Name details and create FTO_Report_With_Panchayat.json
echo ==================================================

call npx playwright test --grep "Fetch Panchayat Name from FTO links" --reporter=line

if errorlevel 1 (
    echo.
    echo Step-3 FAILED.
    exit /b !ERRORLEVEL!
)

echo.
echo ==================================================
echo Step-4: Merge files and create FTO_Report_With_Panchayat.xlsx
echo ==================================================

call node .\src\mergeFtoReport.js

if errorlevel 1 (
    echo.
    echo Step-4 FAILED.
    exit /b !ERRORLEVEL!
)

echo.
echo ==================================================
echo ALL STEPS COMPLETED SUCCESSFULLY
echo ==================================================

exit /b 0