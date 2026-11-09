@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Dang tao moi truong Python de dong goi...
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

".venv\Scripts\python.exe" -c "import sys; raise SystemExit(sys.version_info < (3, 13))" >nul 2>nul
if errorlevel 1 (
    echo Can Python 3.13 tro len de dong goi. Hay xoa thu muc .venv cu hoac cai Python moi hon.
    goto finish
)

echo Dang dam bao pip san sang...
".venv\Scripts\python.exe" -m ensurepip --upgrade
if errorlevel 1 (
    echo Khong the chuan bi pip cho moi truong Python.
    goto finish
)

echo Dang cai cac thu vien va cong cu dong goi...
".venv\Scripts\python.exe" -m pip install -r requirements-build.txt
if errorlevel 1 (
    echo Cai thu vien that bai. Hay kiem tra ket noi Internet va chay lai.
    goto finish
)

echo Dang dong goi dashboard...
".venv\Scripts\pyinstaller.exe" --noconfirm --clean HTA.spec
if errorlevel 1 (
    echo Dong goi that bai. Xem thong bao loi o phia tren.
    goto finish
)
copy /y ER_TABLE.xlsx dist\HTA\ER_TABLE.xlsx >nul

echo.
echo Da dong goi xong: dist\HTA\HTA.exe
echo Hay chia se ca thu muc dist\HTA, khong chi rieng file HTA.exe.

:finish
echo.
echo Nhan phim bat ky de dong cua so nay.
pause >nul
endlocal
