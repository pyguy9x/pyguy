@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Dang cai dat thu vien (can Python 3.10+ va Internet)...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo.
echo Cai dat xong. Chay CHAY_APP.bat de mo ung dung.
pause
