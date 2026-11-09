"""Trích xuất, tiền xử lý và tích hợp dữ liệu từ bảng tính Excel và cơ sở dữ liệu SQLite."""

import json
import sqlite3
import time
from typing import Any, Dict, List
import pandas as pd

from core.config import DATA_WORKBOOK_PATH, VIRTUAL_DATA_DB_PATH, logger
from core.spc_calculator import calculate_spc_for_single_sheet, timestamp_sort_key


def parse_spec_limit(value: Any) -> float:
    """Chuyển đổi giới hạn quy chuẩn kỹ thuật (LSL/USL) thành số thực an toàn."""
    if isinstance(value, str):
        value = value.strip().replace(",", ".")
    parsed_value = pd.to_numeric(value, errors="coerce")
    if pd.isna(parsed_value):
        raise ValueError(f"Giới hạn quy chuẩn trong Excel không hợp lệ: {value!r}")
    return float(parsed_value)


def load_virtual_batches(defect_id: str) -> List[Dict[str, Any]]:
    """Đọc danh sách các lô đo lường mô phỏng của một loại lỗi từ cơ sở dữ liệu SQLite."""
    if not VIRTUAL_DATA_DB_PATH.is_file():
        return []

    try:
        connection = sqlite3.connect(VIRTUAL_DATA_DB_PATH, timeout=5)
        try:
            rows = connection.execute(
                """
                SELECT batch_id, timestamp, values_json
                FROM virtual_batches
                WHERE defect_id = ?
                ORDER BY created_at, batch_id
                """,
                (defect_id,)
            ).fetchall()
        finally:
            connection.close()
    except (sqlite3.OperationalError, sqlite3.DatabaseError):
        return []

    virtual_batches = []
    for batch_id, timestamp, values_json in rows:
        values = json.loads(values_json)
        virtual_batches.append({
            "TIME": timestamp,
            "ID": batch_id,
            "_virtual": True,
            **values
        })
    return virtual_batches


def sync_fetch_all_defects() -> Dict[str, Any]:
    """Đọc toàn bộ các sheet lỗi từ workbook Excel, hợp nhất dữ liệu mô phỏng và tổng hợp chỉ số."""
    start_time = time.time()
    defects_data = []

    with pd.ExcelFile(DATA_WORKBOOK_PATH) as workbook:
        for sheet_index, sheet_name in enumerate(workbook.sheet_names, start=1):
            # Hàng 1-2 chứa tên lỗi và các giới hạn kỹ thuật LSL/USL
            metadata = pd.read_excel(
                workbook,
                sheet_name=sheet_name,
                header=None,
                nrows=2
            )
            config = {
                "id": f"defect_{sheet_index}",
                "errorName": str(metadata.iat[0, 0]).strip(),
                "lsl": parse_spec_limit(metadata.iat[1, 1]),
                "usl": parse_spec_limit(metadata.iat[1, 2])
            }
            # Từ hàng thứ 5 trở đi là dữ liệu đo lường thực tế (X1 -> X10)
            sheet_data = pd.read_excel(
                workbook,
                sheet_name=sheet_name,
                header=4
            )
            # Hợp nhất các lô mô phỏng ảo nếu có vào dữ liệu thực
            virtual_rows = load_virtual_batches(config["id"])
            if virtual_rows:
                sheet_data = pd.concat(
                    [sheet_data, pd.DataFrame(virtual_rows)],
                    ignore_index=True
                )
            defects_data.append(calculate_spc_for_single_sheet(config, sheet_data))

    danger_count = sum(1 for d in defects_data if d["status"] == "DANGER")
    warning_count = sum(1 for d in defects_data if d["status"] == "WARNING")
    success_count = sum(1 for d in defects_data if d["status"] == "SUCCESS")
    no_data_count = sum(1 for d in defects_data if d["status"] == "NO_DATA")
    alert_history = sorted(
        (event for defect in defects_data for event in defect["alertHistory"]),
        key=lambda event: timestamp_sort_key(event["timestamp"], 0),
        reverse=True
    )

    return {
        "summary": {
            "totalDefectTypes": len(defects_data),
            "dangerCount": danger_count,
            "warningCount": warning_count,
            "successCount": success_count,
            "noDataCount": no_data_count,
            "timestamp": time.strftime("%H:%M:%S %d/%m/%Y")
        },
        "defects": defects_data,
        "alertHistory": alert_history,
        "processTimeSeconds": round(time.time() - start_time, 3)
    }
