@echo off
setlocal
rem Chuyển console sang UTF-8 để hiển thị thông báo tiếng Việt.
chcp 65001 >nul
cd /d "%~dp0"

rem Tạo môi trường riêng dùng cho quá trình đóng gói nếu chưa tồn tại.
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

rem Quy trình đóng gói này giới hạn phiên bản Python từ 3.13 trở lên.
".venv\Scripts\python.exe" -c "import sys; raise SystemExit(sys.version_info < (3, 13))" >nul 2>nul
if errorlevel 1 (
    echo Can Python 3.13 tro len de dong goi. Hay xoa thu muc .venv cu hoac cai Python moi hon.
    goto finish
)

rem Đảm bảo pip có sẵn trước khi cài các phụ thuộc chỉ phục vụ build.
echo Dang dam bao pip san sang...
".venv\Scripts\python.exe" -m ensurepip --upgrade
if errorlevel 1 (
    echo Khong the chuan bi pip cho moi truong Python.
    goto finish
)

rem Cài phụ thuộc build rồi tạo thư mục phân phối theo cấu hình HTA.spec.
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

echo.
echo Da dong goi xong: dist\HTA\HTA.exe
echo Hay chia se ca thu muc dist\HTA, khong chi rieng file HTA.exe.

:finish
rem Chờ thao tác để cửa sổ không đóng mất thông báo lỗi/kết quả.
echo.
echo Nhan phim bat ky de dong cua so nay.
pause >nul
endlocal
