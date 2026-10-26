@echo off
setlocal
set "ROOT=%~dp0"
pushd "%ROOT%" >nul

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is required. Install Node.js 20.19+ or 22.12+ and try again.
    goto :fail
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is required. Install Node.js 20.19+ or 22.12+ and try again.
    goto :fail
)

set "PYTHON_EXE="
if exist "backend\venv\Scripts\python.exe" set "PYTHON_EXE=%ROOT%backend\venv\Scripts\python.exe"
if not defined PYTHON_EXE if exist "venv\Scripts\python.exe" set "PYTHON_EXE=%ROOT%venv\Scripts\python.exe"
if not defined PYTHON_EXE (
    where py >nul 2>&1
    if not errorlevel 1 (
        echo Creating backend virtual environment with py...
        py -3 -m venv "backend\venv"
    ) else (
        where python >nul 2>&1
        if errorlevel 1 (
            echo [ERROR] Python 3.10+ is required. Install Python and try again.
            goto :fail
        )
        echo Creating backend virtual environment with python...
        python -m venv "backend\venv"
    )
    if errorlevel 1 (
        echo [ERROR] Could not create the backend virtual environment.
        goto :fail
    )
    set "PYTHON_EXE=%ROOT%backend\venv\Scripts\python.exe"
)

"%PYTHON_EXE%" -c "import fastapi, uvicorn, pydantic, psycopg, psycopg_pool, mangum, google.genai, groq, openai, dotenv" >nul 2>&1
if errorlevel 1 (
    echo Installing backend dependencies from backend\requirements.txt...
    "%PYTHON_EXE%" -m pip install -r "backend\requirements.txt"
    if errorlevel 1 (
        echo [ERROR] Backend dependency installation failed.
        goto :fail
    )
)

if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    pushd "frontend"
    call npm ci
    if errorlevel 1 (
        popd
        echo [ERROR] Frontend dependency installation failed.
        goto :fail
    )
    popd
)

if not exist "backend\.env" (
    echo [NOTE] backend\.env is missing. Configure it from backend\.env.example
    echo        and set valid PostgreSQL/AI connection details.
)

echo.
echo ========================================================
echo   🎙️ Launching VocaTask + ⚡ FrontFix AI Unified Stack
echo ========================================================
echo [1/3] Starting Unified Backend (Uvicorn on Port 8000)...
start "VocaTask & FrontFix Backend" /D "%ROOT%backend" cmd /k ""%PYTHON_EXE%" run.py"

echo [2/3] Waiting for backend API to be ready on port 8000...
set /a ATTEMPTS=0
:wait_backend
set /a ATTEMPTS+=1
timeout /t 1 /nobreak >nul
curl -s -m 2 http://127.0.0.1:8000/health >nul 2>&1
if not errorlevel 1 (
    echo [OK] Backend API is live on http://127.0.0.1:8000
    goto :start_frontend
)
if %ATTEMPTS% leq 15 (
    echo ... waiting for backend to bind port 8000 ^(%ATTEMPTS%/15^)
    goto :wait_backend
)
echo [WARNING] Backend is taking longer than expected to bind. Proceeding with frontend...

:start_frontend
echo [3/3] Starting Frontend (Vite on Port 5173)...
start "VocaTask Frontend" /D "%ROOT%frontend" cmd /k "npm run dev"

timeout /t 2 /nobreak >nul
echo Opening VocaTask & FrontFix in your default browser...
start "" "http://localhost:5173"

echo.
echo ========================================================
echo   🚀 All Systems Running Smoothly!
echo ========================================================
echo   Frontend App:    http://localhost:5173
echo   Backend API:     http://127.0.0.1:8000
echo   API Docs:        http://127.0.0.1:8000/docs
echo   Health Status:   http://127.0.0.1:8000/health
echo   FrontFix Health: http://127.0.0.1:8000/api/frontfix/health
echo ========================================================
echo Leave the two command windows open while testing.
echo Press any key in this window to close this launcher.
pause >nul
popd
exit /b 0

:fail
popd
echo.
echo [FAIL] Startup encountered an error.
pause
exit /b 1
