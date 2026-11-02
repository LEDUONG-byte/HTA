"""Khởi chạy dashboard cục bộ và yêu cầu dọn dữ liệu mô phỏng khi thoát."""

import json
import os
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

ROOT_PATH = Path(__file__).resolve().parent
# Máy chủ chỉ lắng nghe loopback; cổng có thể đổi qua biến môi trường khi cần.
HOST = "127.0.0.1"
PORT = int(os.environ.get("HTA_PORT", "8000"))
DASHBOARD_URL = f"http://{HOST}:{PORT}"
SERVE_ARGUMENT = "--serve"


def ensure_port_is_available() -> None:
    """Báo lỗi sớm nếu cổng dashboard đang được tiến trình khác sử dụng."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            probe.bind((HOST, PORT))
        except OSError as error:
            raise RuntimeError(
                f"Cổng {PORT} đang được sử dụng hoặc không khả dụng. "
                "Hãy đóng dashboard đang chạy rồi thử lại."
            ) from error


def wait_for_dashboard(server: subprocess.Popen[bytes], timeout: float = 45) -> None:
    """Chờ máy chủ mở cổng hoặc báo lỗi nếu máy chủ dừng/không phản hồi."""
    deadline = time.monotonic() + timeout
    # Kiểm tra tiến trình và cổng định kỳ để phát hiện sớm lỗi khởi động.
    while time.monotonic() < deadline:
        if server.poll() is not None:
            raise RuntimeError(
                "Dashboard không khởi động được. Kiểm tra lỗi phía trên "
                "hoặc cài lại các thư viện bằng CHAY_SPC.bat."
            )
        try:
            with socket.create_connection((HOST, PORT), timeout=1):
                return
        except OSError:
            time.sleep(0.5)
    raise RuntimeError(
        f"Dashboard không phản hồi sau {timeout:.0f} giây. "
        "Kiểm tra lỗi phía trên rồi thử lại."
    )


def stop_dashboard(server: subprocess.Popen[bytes]) -> None:
    """Kết thúc máy chủ, buộc dừng nếu không thoát trong thời hạn chờ."""
    if server.poll() is not None:
        return
    # API đã được yêu cầu dọn dữ liệu trước khi launcher kết thúc tiến trình máy chủ.
    server.terminate()
    try:
        server.wait(timeout=10)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait()


def stop_virtual_simulator() -> bool:
    """Yêu cầu API dừng mô phỏng và xác nhận phản hồi trước khi đóng máy chủ."""
    request = Request(f"{DASHBOARD_URL}/api/simulator/stop", method="POST")
    try:
        with urlopen(request, timeout=5) as response:
            status = json.loads(response.read().decode("utf-8"))
        if status.get("running") is not False:
            raise RuntimeError("Máy chủ chưa xác nhận bộ nạp dữ liệu ảo đã dừng.")
        print("Đã dừng và xóa dữ liệu ảo trước khi đóng dashboard.", flush=True)
        return True
    except (OSError, URLError, TimeoutError) as error:
        print(f"Không thể xác nhận dừng dữ liệu ảo: {error}", file=sys.stderr, flush=True)
        return False
    except (AttributeError, json.JSONDecodeError, RuntimeError) as error:
        print(f"Không thể xác nhận dừng dữ liệu ảo: {error}", file=sys.stderr, flush=True)
        return False


def main() -> int:
    """Khởi chạy Uvicorn, mở dashboard trên trình duyệt và xử lý thoát."""
    # Ở bản đóng gói, tiến trình con tự gọi lại launcher với --serve để chạy ASGI.
    if getattr(sys, "frozen", False) and sys.argv[1:] == [SERVE_ARGUMENT]:
        import uvicorn
        from main import app

        uvicorn.run(app, host=HOST, port=PORT)
        return 0

    server = None
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    try:
        # Launcher kiểm tra cổng trước khi tạo tiến trình máy chủ con.
        ensure_port_is_available()
        if getattr(sys, "frozen", False):
            command = [sys.executable, SERVE_ARGUMENT]
        else:
            command = [
                sys.executable,
                "-m",
                "uvicorn",
                "main:app",
                "--host",
                HOST,
                "--port",
                str(PORT)
            ]
        # Chạy backend riêng để launcher có thể chờ sẵn sàng và đóng mô phỏng an toàn.
        server = subprocess.Popen(command, cwd=ROOT_PATH)
        wait_for_dashboard(server)
        print(f"Dashboard đã sẵn sàng: {DASHBOARD_URL}", flush=True)
        webbrowser.open(DASHBOARD_URL)
        print("Nhấn 'Bắt đầu dữ liệu ảo' trên trang để chạy mô phỏng.", flush=True)
        while server.poll() is None:
            time.sleep(0.5)
        return 0
    except KeyboardInterrupt:
        print("\nĐã dừng chương trình.", flush=True)
        return 0
    except (OSError, RuntimeError) as error:
        print(f"\nKhông thể chạy SPC: {error}", file=sys.stderr, flush=True)
        return 1
    finally:
        # Thử dọn qua API trước; nếu không xác nhận được thì chờ máy chủ tự thoát rồi mới buộc dừng.
        if server is not None:
            if server.poll() is None:
                stopped = stop_virtual_simulator()
                if stopped:
                    stop_dashboard(server)
                else:
                    try:
                        server.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        print(
                            "Máy chủ chưa tự tắt sau yêu cầu dừng; đang đóng máy chủ.",
                            file=sys.stderr,
                            flush=True
                        )
                        stop_dashboard(server)


if __name__ == "__main__":
    raise SystemExit(main())
