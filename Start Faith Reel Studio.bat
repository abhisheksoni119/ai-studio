@echo off
title Faith Reel Studio Launcher
echo.
echo  +------------------------------------------+
echo  ^|        Faith Reel Studio                 ^|
echo  +------------------------------------------+
echo.

:: Move to the project folder
cd /d "C:\Users\dell\Documents\ai-studio"
if errorlevel 1 (
    echo ERROR: Could not find the project folder.
    echo Expected location: C:\Users\dell\Documents\ai-studio
    echo Please check that the folder exists and try again.
    echo.
    pause
    exit /b 1
)

:: Check if the server is already running on port 3333
netstat -ano | findstr ":3333 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo Server is already running.
    echo Opening browser...
    start "" "http://localhost:3333"
    timeout /t 2 /nobreak >nul
    exit /b 0
)

:: Check that Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not found in PATH.
    echo Please install Node.js from https://nodejs.org and try again.
    echo.
    pause
    exit /b 1
)

:: Install dependencies when they are missing, and refresh them whenever
:: package.json has gained one since the last install. npm install is a no-op
:: when everything is already there, so running it on doubt is cheaper than
:: letting the server fail later on a module that was never installed.
set "NEED_INSTALL="
if not exist "node_modules\" set "NEED_INSTALL=1"
if defined NEED_INSTALL goto :do_install

node -e "const f=require('fs');try{const a=f.statSync('package.json').mtimeMs,b=f.statSync('node_modules/.package-lock.json').mtimeMs;process.exit(Math.sign(a-b)===1?1:0)}catch(e){process.exit(1)}"
if errorlevel 1 set "NEED_INSTALL=1"
if not defined NEED_INSTALL goto :deps_ready

:do_install
echo Setting up dependencies...
echo This may take a minute.
echo.
npm install
if errorlevel 1 (
    echo ERROR: npm install failed. Check your internet connection and try again.
    echo.
    pause
    exit /b 1
)
echo.

:deps_ready

:: Start the server in a new window (stays open, shows live logs)
echo Starting server...
start "Faith Reel Studio - Server" cmd /k "cd /d C:\Users\dell\Documents\ai-studio && npm run ui"

:: Wait up to 20 seconds for the server to become ready
echo Waiting for server to start...
set /a tries=0
:wait_loop
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":3333 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 goto :server_ready
set /a tries+=1
if %tries% lss 20 goto :wait_loop

:: Server did not start in time
echo.
echo ERROR: The server did not start within 20 seconds.
echo.
echo Possible causes:
echo   - Port 3333 is already used by another program
echo   - A previous server window is still running (close it first)
echo   - There is an error in server.mjs (check the server window)
echo.
echo You can also start the server manually:
echo   1. Open a terminal in C:\Users\dell\Documents\ai-studio
echo   2. Type:  npm run ui
echo   3. Open your browser to:  http://localhost:3333
echo.
pause
exit /b 1

:server_ready
echo Server is ready. Opening browser...
start "" "http://localhost:3333"
echo.
echo Faith Reel Studio is open in your browser.
echo.
echo To stop the server: close the "Faith Reel Studio - Server" window.
echo To open the studio again: just double-click this launcher.
echo.
timeout /t 4 /nobreak >nul
exit /b 0
