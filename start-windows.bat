@echo off
rem FlipWise - start on Windows (double-click this file)
cd /d "%~dp0"
set PNPM=npx --yes pnpm@10.28.0
title FlipWise
echo === FlipWise ===

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Download the LTS version from https://nodejs.org, install it, then run this again.
  start "" https://nodejs.org
  pause
  exit /b 1
)
node -e "process.exit(+process.versions.node.split('.')[0] < 20 ? 1 : 0)"
if errorlevel 1 (
  echo Your Node.js is too old. Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)

echo 1/4 Installing components (first time takes a few minutes)...
call %PNPM% install --frozen-lockfile
if errorlevel 1 ( echo Install failed. & pause & exit /b 1 )
echo 2/4 Preparing the database and demo data...
call %PNPM% run bootstrap
if errorlevel 1 ( echo Setup failed. & pause & exit /b 1 )
echo 3/4 Building the app (about a minute)...
call %PNPM% run build
if errorlevel 1 ( echo Build failed. & pause & exit /b 1 )
echo 4/4 Starting FlipWise at http://localhost:3000
echo      Sign in: demo@flipwise.fi  /  flipwise-demo-2026
echo      Keep this window open while you use the app. Close it to stop FlipWise.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 6; Start-Process 'http://localhost:3000'"
call %PNPM% run start
pause
