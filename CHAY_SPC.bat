@echo off
setlocal
rem Dùng UTF-8 cho thông báo tiếng Việt trong cửa sổ console.
chcp 65001 >nul
cd /d "%~dp0"

rem Tạo môi trường ảo lần đầu; ưu tiên Python Launcher nếu có.
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

rem Chỉ cài lại gói khi môi trường thiếu một trong các thư viện backend chính.
".venv\Scripts\python.exe" -c "import fastapi, numpy, openpyxl, pandas, uvicorn" >nul 2>nul
if errorlevel 1 (
    echo Dang cai cac thu vien can thiet...
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 (
        echo Cai thu vien that bai. Hay kiem tra ket noi Internet va chay lai.
        goto finish
    )
)

rem Launcher mở dashboard và chịu trách nhiệm dừng/xóa dữ liệu mô phỏng khi thoát.
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
rem Giữ cửa sổ mở để người dùng đọc thông báo kết quả hoặc lỗi.
echo.
echo Nhan phim bat ky de dong cua so nay.
pause >nul
endlocal
