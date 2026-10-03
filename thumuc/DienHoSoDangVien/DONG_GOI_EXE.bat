@echo off
chcp 65001 >nul
cd /d "%~dp0"
python -m pip install pyinstaller
python -m PyInstaller --noconfirm --onedir --windowed --name DienHoSoDangVien --collect-all playwright app_dien_ho_so.py
echo.
echo Tep chay nam trong thu muc dist\DienHoSoDangVien\DienHoSoDangVien.exe
pause
