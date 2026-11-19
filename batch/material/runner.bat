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
set "PLAYWRIGHT_DIR=%APP_BASE_PATH%\tests\material"
set "NODE_DIR=%APP_BASE_PATH%\src\material"

echo PLAYWRIGHT_DIR is set to: %PLAYWRIGHT_DIR%
echo NODE_DIR is set to: %NODE_DIR%

echo.
echo MATERIAL FTO Report Automation Script

@REM  echo ==================================================
@REM  echo Step-1: Create FTO_Report.xlsx by block name
@REM  echo ==================================================
@REM  echo.

@REM  :: Use --% to disable cmd.exe parsing so the quoted grep pattern is preserved accurately
@REM  call npx playwright test tests/material/blockdata.spec.js --% --grep "Download FTO Report for block" --reporter=line

@REM  if errorlevel 1 (
@REM      echo.
@REM      echo Step-1 FAILED.
@REM      exit /b !ERRORLEVEL!
@REM  )

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
echo Step-3: Fetch ML details from FTO Link and update MaterialList_FTO_Report.json
echo ==================================================
echo.

call npx playwright test tests/material/materialList.spec.js --% --grep "Fetch Material List Details Name from FTO links" --reporter=line

if errorlevel 1 (
    echo.
    echo Step-1 FAILED.
    exit /b !ERRORLEVEL!
)

echo.
echo ==================================================
echo Step-4: Merge files and create MaterialList_FTO_Report_with_ML.xlsx
echo ==================================================
echo.

pushd "%NODE_DIR%"
call node mergeMldetailsInFto.js
popd

if errorlevel 1 (
    echo.
    echo Step-4 FAILED.
    exit /b !ERRORLEVEL!
)
