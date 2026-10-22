@echo off
setlocal
set "ROOT=%~dp0"
pushd "%ROOT%" >nul

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js is required. Install Node.js 20.19+ or 22.12+ and try again.
    goto :fail
)
where npm >nul 2>&1
if errorlevel 1 (
    echo npm is required. Install Node.js 20.19+ or 22.12+ and try again.
    goto :fail
)

set "PYTHON_EXE="
if exist "backend\venv\Scripts\python.exe" set "PYTHON_EXE=%ROOT%backend\venv\Scripts\python.exe"
if not defined PYTHON_EXE if exist "venv\Scripts\python.exe" set "PYTHON_EXE=%ROOT%venv\Scripts\python.exe"
if not defined PYTHON_EXE (
    where py >nul 2>&1
    if not errorlevel 1 (
        py -3 -m venv "backend\venv"
    ) else (
        where python >nul 2>&1
        if errorlevel 1 (
            echo Python 3.10+ is required. Install Python and try again.
            goto :fail
        )
        python -m venv "backend\venv"
    )
    if errorlevel 1 (
        echo Could not create the backend virtual environment.
        goto :fail
    )
    set "PYTHON_EXE=%ROOT%backend\venv\Scripts\python.exe"
)

"%PYTHON_EXE%" -c "import fastapi, uvicorn, pydantic, psycopg, psycopg_pool, mangum, google.genai, groq, openai, dotenv, multipart" >nul 2>&1
if errorlevel 1 (
    echo Installing backend dependencies...
    "%PYTHON_EXE%" -m pip install -r "backend\requirements.txt"
    if errorlevel 1 (
        echo Backend dependency installation failed.
        goto :fail
    )
)

if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    pushd "frontend"
    call npm ci
    if errorlevel 1 (
        popd
        echo Frontend dependency installation failed.
        goto :fail
    )
    popd
)

if not exist "backend\.env" (
    echo NOTE: backend\.env is missing. Configure it from backend\.env.example
    echo       and set valid PostgreSQL connection details for database features.
)

echo Starting VocaTask backend, FrontFix chatbot backend, and frontend...
start "VocaTask Backend" /D "%ROOT%backend" cmd /k ""%PYTHON_EXE%" run.py"
if exist "frontfix-backend\main.py" (
    start "FrontFix AI Chatbot Backend" /D "%ROOT%frontfix-backend" cmd /k ""%PYTHON_EXE%" main.py"
)
start "VocaTask Frontend" /D "%ROOT%frontend" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Frontend:         http://localhost:5173
echo VocaTask Backend: http://127.0.0.1:8000
echo FrontFix Backend: http://127.0.0.1:8001
echo API docs:         http://127.0.0.1:8000/docs
popd
exit /b 0

:fail
popd
echo.
pause
exit /b 1
