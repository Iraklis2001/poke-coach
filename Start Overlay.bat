@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 20 or newer from https://nodejs.org
  echo Then double-click this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo First start installs the app. This can take a minute.
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm run overlay
pause
