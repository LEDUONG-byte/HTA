@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Dang tao moi truong Python lan dau...
    where py >nul 2>nul
    if not errorlevel 1 (
        py -3 -m venv .venv
    ) else (
        where python >nul 2>nul
        if errorlevel 1 (
            echo Khong tim thay Python. Hay cai Python 3.13 hoac moi hon roi chay lai.
            goto finish
        )
        python -m venv .venv
    )
    if errorlevel 1 (
        echo Khong tao duoc moi truong Python.
        goto finish
    )
)

".venv\Scripts\python.exe" -c "import fastapi, numpy, openpyxl, pandas, uvicorn" >nul 2>nul
if errorlevel 1 (
    echo Dang cai cac thu vien can thiet...
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 (
        echo Cai thu vien that bai. Hay kiem tra ket noi Internet va chay lai.
        goto finish
    )
)

echo Dashboard dang khoi dong. Du lieu ao chua bat dau.
echo Cua so nay phai duoc giu mo trong khi su dung.
echo Bam "Bat dau du lieu ao" tren trang web de nap du lieu.
echo Nhan Ctrl+C de dong dashboard va xoa du lieu ao neu dang chay.
".venv\Scripts\python.exe" launcher.py
if errorlevel 1 (
    echo.
    echo Chuong trinh gap loi. Xem thong bao o phia tren.
)

:finish
echo.
echo Nhan phim bat ky de dong cua so nay.
pause >nul
endlocal
