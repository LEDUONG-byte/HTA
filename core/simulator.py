"""Tạo, lưu trữ và dọn dẹp các lô dữ liệu SPC mô phỏng ảo."""

import asyncio
import json
import logging
import os
import random
import signal
import sqlite3
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from statistics import pstdev
from typing import Any, Dict, List

import pandas as pd

ROOT_PATH = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))

# Ưu tiên ER_TABLE.xlsx nằm cạnh HTA.exe khi đóng gói để người dùng dễ chỉnh sửa
if getattr(sys, "frozen", False):
    EXE_DIR = Path(sys.executable).resolve().parent
    EXTERNAL_WORKBOOK = EXE_DIR / "ER_TABLE.xlsx"
    WORKBOOK_PATH = EXTERNAL_WORKBOOK if EXTERNAL_WORKBOOK.is_file() else (ROOT_PATH / "ER_TABLE.xlsx")
else:
    WORKBOOK_PATH = ROOT_PATH / "ER_TABLE.xlsx"

# Bản đóng gói ghi SQLite vào hồ sơ người dùng để không ghi vào thư mục cài đặt chỉ đọc
if getattr(sys, "frozen", False):
    DATA_PATH = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "HTA"
else:
    DATA_PATH = ROOT_PATH

DATABASE_PATH = DATA_PATH / "virtual_spc_data.sqlite3"
INTERVAL_SECONDS = 60
SAMPLE_COLUMNS = [f"X{index}" for index in range(1, 11)]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("SPC_Virtual_Data_Simulator")


def load_defect_profiles() -> List[Dict[str, Any]]:
    """Đọc cấu hình, nhóm mẫu và độ nhiễu từ từng sheet của workbook."""
    profiles = []
    with pd.ExcelFile(WORKBOOK_PATH) as workbook:
        for sheet_index, sheet_name in enumerate(workbook.sheet_names, start=1):
            metadata = pd.read_excel(workbook, sheet_name=sheet_name, header=None, nrows=2)
            data = pd.read_excel(workbook, sheet_name=sheet_name, header=4)
            data.columns = [str(column).strip() for column in data.columns]
            existing_columns = [column for column in SAMPLE_COLUMNS if column in data.columns]
            if not existing_columns:
                raise ValueError(f"Không có cột X1-X10 trong sheet {sheet_name}")

            # Lưu từng nhóm hợp lệ làm nguồn lấy mẫu, giữ nguyên cấu trúc từng hàng trong workbook.
            numeric_data = data[existing_columns].apply(pd.to_numeric, errors="coerce")
            groups = [
                [float(value) for value in row if pd.notna(value)]
                for row in numeric_data.to_numpy()
            ]
            groups = [group for group in groups if len(group) >= 2]
            if not groups:
                raise ValueError(f"Không có nhóm mẫu hợp lệ trong sheet {sheet_name}")

            all_values = [value for group in groups for value in group]
            lsl = float(pd.to_numeric(metadata.iat[1, 1], errors="raise"))
            usl = float(pd.to_numeric(metadata.iat[1, 2], errors="raise"))
            # Nhiễu nhỏ giúp dữ liệu mô phỏng gần dữ liệu gốc nhưng không lặp y nguyên.
            profiles.append({
                "id": f"defect_{sheet_index}",
                "errorName": str(metadata.iat[0, 0]).strip(),
                "groups": groups,
                "noise": max((usl - lsl) * 0.005, pstdev(all_values) * 0.03, 1e-8)
            })
    return profiles


def initialize_database(connection: sqlite3.Connection) -> None:
    """Tạo bảng và chỉ mục lưu các lô mô phỏng nếu chưa tồn tại."""
    connection.execute("PRAGMA secure_delete = ON")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS virtual_batches (
            run_id TEXT NOT NULL,
            defect_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            batch_id TEXT NOT NULL,
            values_json TEXT NOT NULL,
            PRIMARY KEY (run_id, defect_id, batch_id)
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_virtual_batches_defect_time "
        "ON virtual_batches (defect_id, created_at)"
    )
    connection.commit()


def insert_virtual_cycle(
    connection: sqlite3.Connection,
    profiles: List[Dict[str, Any]],
    run_id: str,
    cycle: int,
    created_at: datetime,
    rng: random.Random
) -> int:
    """Sinh một lô cho mỗi profile và ghi toàn bộ chu kỳ trong một giao dịch."""
    timestamp = created_at.strftime("%H:%M:%S_%d/%m/%Y")
    created_at_iso = created_at.isoformat(timespec="microseconds")
    rows = []
    for profile in profiles:
        source_group = rng.choice(profile["groups"])
        center = sum(source_group) / len(source_group)
        measurements = []
        for index in range(len(SAMPLE_COLUMNS)):
            source_value = source_group[index] if index < len(source_group) else center
            measurements.append(round(source_value + rng.gauss(0, profile["noise"]), 2))

        batch_id = f"LOT-{cycle:06d}"
        rows.append((
            run_id,
            profile["id"],
            created_at_iso,
            timestamp,
            batch_id,
            json.dumps(
                {**dict(zip(SAMPLE_COLUMNS, measurements)), "_virtual": True},
                separators=(",", ":")
            )
        ))

    with connection:
        connection.executemany(
            """
            INSERT INTO virtual_batches
                (run_id, defect_id, created_at, timestamp, batch_id, values_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            rows
        )
    return len(rows)


def delete_run_data(database_path: Path, run_id: str) -> int:
    """Xóa dữ liệu của riêng phiên mô phỏng và trả về số hàng đã xóa."""
    if not database_path.is_file():
        return 0
    connection = sqlite3.connect(database_path, timeout=5)
    try:
        connection.execute("PRAGMA secure_delete = ON")
        with connection:
            cursor = connection.execute(
                "DELETE FROM virtual_batches WHERE run_id = ?",
                (run_id,)
            )
            return cursor.rowcount
    finally:
        connection.close()


def clear_virtual_batches(database_path: Path) -> int:
    """Xóa mọi lô mô phỏng còn lưu trong cơ sở dữ liệu được chỉ định."""
    if not database_path.is_file():
        return 0

    connection = sqlite3.connect(database_path, timeout=5)
    try:
        connection.execute("PRAGMA secure_delete = ON")
        table_exists = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'virtual_batches'"
        ).fetchone()
        if table_exists is None:
            return 0
        with connection:
            cursor = connection.execute("DELETE FROM virtual_batches")
            return cursor.rowcount
    finally:
        connection.close()


def stop_on_termination(signum: int, frame: Any) -> None:
    """Chuyển tín hiệu kết thúc thành KeyboardInterrupt để chạy dọn dẹp."""
    del signum, frame
    raise KeyboardInterrupt


class VirtualDataSimulator:
    """Điều phối phiên mô phỏng bất đồng bộ được điều khiển qua API."""

    def __init__(self) -> None:
        """Khởi tạo trạng thái phiên, tác vụ nền và khóa điều phối."""
        self._task: asyncio.Task[None] | None = None
        self._run_id: str | None = None
        self._cycle = 0
        self._lock = asyncio.Lock()
        self._last_error: str | None = None
        self._removed_rows = 0
        self._checks_per_batch = 0

    def status(self) -> Dict[str, Any]:
        """Tạo bản trạng thái hiện tại để API trả về cho client."""
        running = self._task is not None and not self._task.done()
        return {
            "running": running,
            "intervalSeconds": INTERVAL_SECONDS,
            "cycle": self._cycle,
            "checksPerBatch": self._checks_per_batch,
            "lastError": self._last_error
        }

    async def start(self) -> Dict[str, Any]:
        """Tạo lô đầu tiên ngay lập tức rồi khởi chạy tác vụ sinh lô định kỳ."""
        async with self._lock:
            if self._task is not None and not self._task.done():
                return self.status()

            profiles = await asyncio.to_thread(load_defect_profiles)
            run_id = uuid.uuid4().hex
            rng = random.Random()
            DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
            connection = sqlite3.connect(DATABASE_PATH, timeout=5)
            try:
                initialize_database(connection)
                self._cycle = 1
                inserted = insert_virtual_cycle(
                    connection,
                    profiles,
                    run_id,
                    self._cycle,
                    datetime.now(),
                    rng
                )
            except Exception:
                connection.close()
                delete_run_data(DATABASE_PATH, run_id)
                raise
            connection.close()

            self._run_id = run_id
            self._last_error = None
            self._removed_rows = 0
            self._checks_per_batch = len(profiles)
            self._task = asyncio.create_task(self._run_loop(run_id, profiles, rng))
            logger.info(
                "Bắt đầu phiên nạp dữ liệu ảo %s: lô LOT-%06d qua %s bước kiểm tra (%s bản ghi chỉ số).",
                run_id[:8],
                self._cycle,
                len(profiles),
                inserted
            )
            return self.status()

    async def stop(self) -> Dict[str, Any]:
        """Hủy tác vụ nền và xóa toàn bộ dữ liệu của phiên đang chạy."""
        async with self._lock:
            task = self._task
            if task is None:
                return {**self.status(), "removedRows": 0}

            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

            cleanup_rows = delete_run_data(DATABASE_PATH, self._run_id) if self._run_id else 0
            if cleanup_rows:
                self._removed_rows = cleanup_rows
            self._task = None
            self._run_id = None
            return {**self.status(), "removedRows": self._removed_rows}

    async def _run_loop(
        self,
        run_id: str,
        profiles: List[Dict[str, Any]],
        rng: random.Random
    ) -> None:
        """Chờ theo chu kỳ, ghi lô mới và dọn dữ liệu khi tác vụ kết thúc."""
        connection = None
        try:
            connection = sqlite3.connect(DATABASE_PATH, timeout=5)
            initialize_database(connection)
            while True:
                await asyncio.sleep(INTERVAL_SECONDS)
                self._cycle += 1
                inserted = insert_virtual_cycle(
                    connection,
                    profiles,
                    run_id,
                    self._cycle,
                    datetime.now(),
                    rng
                )
                logger.info(
                    "Đã tạo lô LOT-%06d qua %s bước kiểm tra (%s bản ghi chỉ số).",
                    self._cycle,
                    len(profiles),
                    inserted
                )
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self._last_error = str(error)
            logger.exception("Lỗi khi nạp dữ liệu ảo.")
        finally:
            if connection is not None:
                connection.close()
            self._removed_rows = delete_run_data(DATABASE_PATH, run_id)
            logger.info("Đã xóa %s lô thuộc phiên ảo %s.", self._removed_rows, run_id[:8])


def main() -> None:
    """Chạy bộ mô phỏng độc lập cho tới khi nhận tín hiệu dừng."""
    profiles = load_defect_profiles()
    run_id = uuid.uuid4().hex
    rng = random.Random()
    removed_rows = clear_virtual_batches(DATABASE_PATH)
    if removed_rows:
        logger.info("Đã xóa %s lô ảo còn sót từ lần chạy trước.", removed_rows)
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=5)
    cycle = 0

    signal.signal(signal.SIGTERM, stop_on_termination)
    initialize_database(connection)
    logger.info(
        "Bắt đầu nạp một lô qua %s bước kiểm tra, mỗi lô gồm 10 mẫu cho từng bước, chu kỳ %s giây. Nhấn Ctrl+C để dừng và xóa dữ liệu của phiên này.",
        len(profiles),
        INTERVAL_SECONDS
    )
    try:
        while True:
            cycle += 1
            row_count = insert_virtual_cycle(
                connection,
                profiles,
                run_id,
                cycle,
                datetime.now(),
                rng
            )
            logger.info(
                "Đã tạo lô LOT-%06d qua %s bước kiểm tra (%s bản ghi chỉ số).",
                cycle,
                len(profiles),
                row_count
            )
            time.sleep(INTERVAL_SECONDS)
    except KeyboardInterrupt:
        logger.info("Đang dừng bộ nạp dữ liệu ảo...")
    finally:
        connection.close()
        deleted_count = delete_run_data(DATABASE_PATH, run_id)
        logger.info("Đã xóa %s lô ảo thuộc phiên %s.", deleted_count, run_id[:8])


if __name__ == "__main__":
    main()

