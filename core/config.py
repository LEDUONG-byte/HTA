"""Cấu hình hệ thống, đường dẫn tài nguyên và hằng số kiểm soát chất lượng SPC."""

import logging
import sys
from pathlib import Path
from core.simulator import DATABASE_PATH

# Xác định thư mục gốc của dự án (hỗ trợ cả môi trường dev lẫn gói đóng gói PyInstaller)
ROOT_PATH = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))

# Cấu hình logging thống nhất cho toàn bộ hệ thống
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("SPC_MultiDefect_Backend")

# Hằng số thống kê Shewhart cho cỡ nhóm n = 10 mẫu cố định
A2_N10 = 0.308
D3_N10 = 0.223
D4_N10 = 1.777
D2_N10 = 3.078

# Cấu hình bộ nhớ đệm (Cache) dữ liệu tính toán SPC
CACHE_TTL_SECONDS = 5.0

# Đường dẫn tệp dữ liệu nguồn (ưu tiên tệp nằm cùng thư mục HTA.exe khi đóng gói)
if getattr(sys, "frozen", False):
    import os
    EXE_DIR = Path(sys.executable).resolve().parent
    EXTERNAL_WORKBOOK = EXE_DIR / "ER_TABLE.xlsx"
    DATA_WORKBOOK_PATH = EXTERNAL_WORKBOOK if EXTERNAL_WORKBOOK.is_file() else (ROOT_PATH / "ER_TABLE.xlsx")
    USER_EDITS_PATH = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "HTA" / "user_edits.json"
else:
    DATA_WORKBOOK_PATH = ROOT_PATH / "ER_TABLE.xlsx"
    USER_EDITS_PATH = ROOT_PATH / "user_edits.json"

VIRTUAL_DATA_DB_PATH = DATABASE_PATH
