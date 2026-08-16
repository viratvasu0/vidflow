@echo off
REM VidFlow local setup script for Windows CMD.
REM Run this from inside the vidflow project folder.

echo Checking Python version...
python --version
IF ERRORLEVEL 1 (
    echo Python was not found on PATH. Please install Python 3.12+ first.
    exit /b 1
)

echo Creating virtual environment...
python -m venv .venv

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo Upgrading pip...
python -m pip install --upgrade pip

echo Installing dependencies...
pip install -r requirements.txt

IF NOT EXIST .env (
    echo Creating .env from .env.example...
    copy .env.example .env
)

echo.
echo Setup complete.
echo To start the app, run:
echo     python api\index.py
echo Then open http://127.0.0.1:5000 in your browser.
