"""Trích xuất, tiền xử lý và tích hợp dữ liệu từ bảng tính Excel và cơ sở dữ liệu SQLite."""

import json
import sqlite3
import time
from typing import Any, Dict, List
import pandas as pd

from core.config import DATA_WORKBOOK_PATH, VIRTUAL_DATA_DB_PATH, USER_EDITS_PATH, logger
from core.spc_calculator import calculate_spc_for_single_sheet, timestamp_sort_key


def load_user_edits() -> Dict[str, Any]:
    """Đọc dữ liệu chỉnh sửa người dùng đã lưu từ file JSON."""
    if not USER_EDITS_PATH.is_file():
        return {}
    try:
        with open(USER_EDITS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Lỗi khi đọc file user_edits.json: {e}")
        return {}


def save_user_edits(edits: Dict[str, Any]) -> None:
    """Lưu dữ liệu chỉnh sửa người dùng ra file JSON một cách an toàn."""
    USER_EDITS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(USER_EDITS_PATH, "w", encoding="utf-8") as f:
        json.dump(edits, f, ensure_ascii=False, indent=2)


def clear_user_edits(defect_id: str = None) -> None:
    """Xóa dữ liệu tùy chỉnh của một hoặc toàn bộ loại lỗi để khôi phục gốc từ Excel."""
    if not USER_EDITS_PATH.is_file():
        return
    if defect_id is None:
        try:
            USER_EDITS_PATH.unlink()
        except Exception as e:
            logger.error(f"Lỗi khi xóa file user_edits.json: {e}")
    else:
        edits = load_user_edits()
        if defect_id in edits:
            del edits[defect_id]
            save_user_edits(edits)


def get_raw_defect_batches(defect_id: str = None) -> List[Dict[str, Any]]:
    """Trả về dữ liệu thô (metadata + danh sách mẫu X1..X10) để người dùng xem và chỉnh sửa trên UI."""
    overrides = load_user_edits()
    results = []

    with pd.ExcelFile(DATA_WORKBOOK_PATH) as workbook:
        for sheet_index, sheet_name in enumerate(workbook.sheet_names, start=1):
            cur_id = f"defect_{sheet_index}"
            if defect_id and cur_id != defect_id:
                continue

            metadata = pd.read_excel(workbook, sheet_name=sheet_name, header=None, nrows=2)
            default_config = {
                "id": cur_id,
                "errorName": str(metadata.iat[0, 0]).strip(),
                "lsl": parse_spec_limit(metadata.iat[1, 1]),
                "usl": parse_spec_limit(metadata.iat[1, 2])
            }

            override = overrides.get(cur_id, {})
            config = {
                "id": cur_id,
                "errorName": override.get("errorName") or default_config["errorName"],
                "lsl": override.get("lsl") if override.get("lsl") is not None else default_config["lsl"],
                "usl": override.get("usl") if override.get("usl") is not None else default_config["usl"],
                "isModified": bool(override)
            }

            if override.get("batches"):
                batches = override["batches"]
            else:
                sheet_data = pd.read_excel(workbook, sheet_name=sheet_name, header=4)
                sheet_data.columns = [str(c).strip() for c in sheet_data.columns]
                batches = []
                for idx, row in sheet_data.iterrows():
                    batch_id = str(row.get("ID", "")).strip() or f"BATCH-{idx+1:03d}"
                    time_val = str(row.get("TIME", "")).strip() or "00:00:00"
                    b = {
                        "ID": batch_id,
                        "TIME": time_val
                    }
                    for i in range(1, 11):
                        col = f"X{i}"
                        val = row.get(col)
                        b[col] = round(float(val), 4) if pd.notna(val) else None
                    batches.append(b)

            results.append({
                "config": config,
                "defaultConfig": default_config,
                "batches": batches
            })
    return results


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
    """Đọc toàn bộ các sheet lỗi từ workbook Excel, hợp nhất dữ liệu chỉnh sửa người dùng và mô phỏng."""
    start_time = time.time()
    defects_data = []
    overrides = load_user_edits()

    with pd.ExcelFile(DATA_WORKBOOK_PATH) as workbook:
        for sheet_index, sheet_name in enumerate(workbook.sheet_names, start=1):
            cur_id = f"defect_{sheet_index}"
            override = overrides.get(cur_id, {})

            # Hàng 1-2 chứa tên lỗi và các giới hạn kỹ thuật LSL/USL
            metadata = pd.read_excel(
                workbook,
                sheet_name=sheet_name,
                header=None,
                nrows=2
            )
            config = {
                "id": cur_id,
                "errorName": override.get("errorName") or str(metadata.iat[0, 0]).strip(),
                "lsl": override.get("lsl") if override.get("lsl") is not None else parse_spec_limit(metadata.iat[1, 1]),
                "usl": override.get("usl") if override.get("usl") is not None else parse_spec_limit(metadata.iat[1, 2])
            }

            if override.get("batches"):
                sheet_data = pd.DataFrame(override["batches"])
            else:
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
