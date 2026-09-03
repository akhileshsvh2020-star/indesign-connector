@echo off
setlocal

title InDesign Connector Worker

cd /d "%~dp0"

echo.
echo ==========================================
echo   InDesign Connector Worker
echo ==========================================
echo.
echo Folder: %CD%
echo.

if not exist package.json (
  echo ERROR: package.json was not found.
  echo Make sure this file is inside the indesign-connector folder.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing Node packages...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    echo.
    pause
    exit /b 1
  )
)

if not exist worker.config.json (
  echo Creating worker.config.json from example...
  copy worker.config.example.json worker.config.json >nul
)

if not exist .env (
  echo.
  echo ERROR: .env file was not found.
  echo Open this folder and create .env with Supabase and ExtractorPro details.
  echo.
  pause
  exit /b 1
)

echo Checking Playwright browser...
call npx.cmd playwright install chromium
if errorlevel 1 (
  echo.
  echo ERROR: Playwright browser install/check failed.
  echo.
  pause
  exit /b 1
)

echo.
echo Starting worker. Keep this window open while processing jobs.
echo Press CTRL+C, then Y, to stop it.
echo.

call npm.cmd run worker

echo.
echo Worker stopped.
pause
