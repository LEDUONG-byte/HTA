"""API FastAPI và bộ tính chỉ số SPC cho dashboard đa loại lỗi."""

import asyncio
import json
import logging
import sqlite3
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from simulator import DATABASE_PATH, VirtualDataSimulator, clear_virtual_batches

ROOT_PATH = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))

# Ghi log thống nhất để theo dõi lỗi API và các tác vụ nền.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("SPC_MultiDefect_Backend")

# Hằng số biểu đồ X-bar/R tương ứng với cỡ nhóm cố định gồm 10 mẫu.
A2_N10 = 0.308
D3_N10 = 0.223
D4_N10 = 1.777
D2_N10 = 3.078

# Cache dùng chung giúp tránh đọc và tính lại workbook ở mỗi lần gọi API.
CACHE_TTL_SECONDS = 5.0
_data_cache: Dict[str, Any] = {
    "timestamp": 0.0,
    "payload": None
}

DATA_WORKBOOK_PATH = ROOT_PATH / "ER_TABLE.xlsx"
VIRTUAL_DATA_DB_PATH = DATABASE_PATH


class ConnectionManager:
    """Quản lý vòng đời và việc gửi dữ liệu tới các client WebSocket."""

    def __init__(self) -> None:
        """Khởi tạo danh sách các kết nối WebSocket đang hoạt động."""
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Chấp nhận kết nối mới và thêm client vào danh sách theo dõi."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client WebSocket kết nối mới. Tổng client: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Xóa client khỏi danh sách nếu kết nối vẫn còn được đăng ký."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client ngắt kết nối. Còn lại: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """Gửi cùng một thông điệp cho mọi client và loại kết nối bị lỗi."""
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Lỗi khi broadcast tin nhắn tới client: {e}")
                self.disconnect(connection)


manager = ConnectionManager()
virtual_data_simulator = VirtualDataSimulator()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Dọn dữ liệu mô phỏng khi khởi động và dừng tác vụ khi ứng dụng kết thúc."""
    global _data_cache
    removed_rows = await asyncio.to_thread(clear_virtual_batches, VIRTUAL_DATA_DB_PATH)
    _data_cache = {"timestamp": 0.0, "payload": None}
    if removed_rows:
        logger.info("Đã xóa %s lô ảo còn sót từ lần chạy trước.", removed_rows)
    try:
        yield
    finally:
        await virtual_data_simulator.stop()
        _data_cache = {"timestamp": 0.0, "payload": None}


app = FastAPI(
    title="SPC Multi-Defect Realtime Dashboard API",
    version="3.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/css", StaticFiles(directory=str(ROOT_PATH / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(ROOT_PATH / "js")), name="js")
app.mount("/lib", StaticFiles(directory=str(ROOT_PATH / "lib")), name="lib")
app.mount("/template", StaticFiles(directory=str(ROOT_PATH / "template")), name="template")


def _calculate_spc_for_single_sheet(
    sheet_config: Dict[str, Any],
    df: pd.DataFrame
) -> Dict[str, Any]:
    """Tính chỉ số SPC và lịch sử cảnh báo cho một sheet lỗi."""
    defect_id = sheet_config["id"]
    error_name = sheet_config["errorName"]
    lsl = sheet_config["lsl"]
    usl = sheet_config["usl"]

    try:
        df.columns = [str(column).strip() for column in df.columns]
        sample_cols = [f"X{i}" for i in range(1, 11)]
        existing_cols = [c for c in sample_cols if c in df.columns]

        if not existing_cols:
            raise ValueError(f"Không tìm thấy cột dữ liệu X1-X10 ở loại lỗi {error_name}")

        valid_means = []
        valid_ranges = []
        timestamps = []
        batch_history = []
        oos_count = 0
        total_sample_points = 0

        for idx, row in df.iterrows():
            # Bỏ giá trị không phải số; nhóm còn dưới 2 mẫu không đủ tính khoảng biến thiên.
            numeric_samples = pd.to_numeric(row[existing_cols], errors="coerce").dropna()
            samples = numeric_samples.values
            if len(samples) < 2:
                continue

            row_mean = float(np.mean(samples))
            row_range = float(np.ptp(samples))
            out_of_spec_samples = []

            for sample_name, val in zip(numeric_samples.index, samples):
                total_sample_points += 1
                # Mẫu nằm đúng tại giới hạn vẫn đạt quy chuẩn; chỉ giá trị vượt giới hạn mới bị tính OOS.
                if val < lsl or val > usl:
                    oos_count += 1
                    out_of_spec_samples.append({
                        "sampleId": str(sample_name),
                        "value": round(float(val), 6),
                        "violatedLimit": "LSL" if val < lsl else "USL",
                        "limit": lsl if val < lsl else usl
                    })

            timestamp = str(row.get("TIME", f"R_{idx+1}"))
            batch_id = row.get("ID")
            if pd.isna(batch_id):
                batch_id = f"R_{idx+1}"
            virtual_marker = row.get("_virtual", False)
            batch_history.append({
                "timestamp": timestamp,
                "batchId": str(batch_id),
                "isVirtual": bool(virtual_marker) if pd.notna(virtual_marker) else False,
                "values": {
                    column: float(pd.to_numeric(row.get(column), errors="coerce"))
                    if pd.notna(pd.to_numeric(row.get(column), errors="coerce")) else None
                    for column in sample_cols
                },
                "mean": round(row_mean, 4),
                "range": round(row_range, 4),
                "sampleCount": len(samples),
                "oosCount": len(out_of_spec_samples),
                "outOfSpecSamples": out_of_spec_samples,
                "_sortKey": _timestamp_sort_key(timestamp, idx)
            })

        if not batch_history:
            raise ValueError("Không có dữ liệu hợp lệ sau khi làm sạch")

        # Chuẩn hóa thứ tự thời gian trước khi tính chuỗi điểm và biểu đồ.
        batch_history.sort(key=lambda batch: batch["_sortKey"])
        for batch in batch_history:
            batch.pop("_sortKey")
        valid_means = [batch["mean"] for batch in batch_history]
        valid_ranges = [batch["range"] for batch in batch_history]
        timestamps = [batch["timestamp"] for batch in batch_history]

        # Giới hạn X-bar/R được ước lượng từ trung bình và khoảng biến thiên của các nhóm.
        x_double_bar = float(np.mean(valid_means))
        r_bar = float(np.mean(valid_ranges))
        ucl_x = x_double_bar + A2_N10 * r_bar
        lcl_x = x_double_bar - A2_N10 * r_bar
        ucl_r = D4_N10 * r_bar
        lcl_r = D3_N10 * r_bar
        # Biểu đồ p theo dõi tỷ lệ mẫu ngoài quy chuẩn; giới hạn thay đổi theo cỡ mẫu từng lô.
        p_bar = oos_count / total_sample_points
        p_values = [
            batch["oosCount"] / batch["sampleCount"]
            for batch in batch_history
        ]
        ucl_p = [
            min(
                1.0,
                p_bar + 3 * np.sqrt(p_bar * (1 - p_bar) / batch["sampleCount"])
            )
            for batch in batch_history
        ]
        lcl_p = [
            max(
                0.0,
                p_bar - 3 * np.sqrt(p_bar * (1 - p_bar) / batch["sampleCount"])
            )
            for batch in batch_history
        ]
        # Biểu đồ c theo dõi số mẫu OOS trên mỗi lô với cỡ nhóm không đổi.
        c_bar = float(np.mean([batch["oosCount"] for batch in batch_history]))
        ucl_c = c_bar + 3 * np.sqrt(c_bar)
        lcl_c = max(0.0, c_bar - 3 * np.sqrt(c_bar))

        violation_types_by_batch = {}
        # Ước lượng sigma từ R-bar để tính năng lực quá trình Cp/Cpk.
        sigma_hat = r_bar / D2_N10 if D2_N10 > 0 else 0.001
        cp = (usl - lsl) / (6 * sigma_hat) if sigma_hat > 0 else 0.0
        cpk_upper = (usl - x_double_bar) / (3 * sigma_hat) if sigma_hat > 0 else 0.0
        cpk_lower = (x_double_bar - lsl) / (3 * sigma_hat) if sigma_hat > 0 else 0.0
        cpk = float(min(cpk_upper, cpk_lower))

        # Ghi nhận điểm vượt giới hạn kiểm soát của biểu đồ X-bar hoặc R.
        violation_logs = []
        for index, (mean, subgroup_range) in enumerate(zip(valid_means, valid_ranges)):
            timestamp = timestamps[index]
            batch_id = batch_history[index]["batchId"]
            if mean > ucl_x or mean < lcl_x:
                violation_types_by_batch.setdefault(index, []).append("X-bar vượt giới hạn kiểm soát")
                violation_logs.append({
                    "errorName": error_name,
                    "batchId": batch_id,
                    "timestamp": timestamp,
                    "value": round(mean, 4),
                    "violationType": "X-bar vượt giới hạn kiểm soát",
                    "status": "Out of Control",
                    "severity": "DANGER"
                })
            if subgroup_range > ucl_r or subgroup_range < lcl_r:
                violation_types_by_batch.setdefault(index, []).append("R vượt giới hạn kiểm soát")
                violation_logs.append({
                    "errorName": error_name,
                    "batchId": batch_id,
                    "timestamp": timestamp,
                    "value": round(subgroup_range, 4),
                    "violationType": "R vượt giới hạn kiểm soát",
                    "status": "Out of Control",
                    "severity": "DANGER"
                })

        # Quy tắc chạy: cảnh báo khi có 7 điểm liên tiếp cùng phía đường tâm X-bar.
        run_side = 0
        run_length = 0
        for index, mean in enumerate(valid_means):
            side = 1 if mean > x_double_bar else -1 if mean < x_double_bar else 0
            if side == 0 or side != run_side:
                run_side = side
                run_length = 1 if side else 0
            else:
                run_length += 1
            if run_length == 7:
                violation_types_by_batch.setdefault(index, []).append("7 điểm liên tiếp cùng phía đường tâm X-bar")
                violation_logs.append({
                    "errorName": error_name,
                    "batchId": batch_history[index]["batchId"],
                    "timestamp": timestamps[index],
                    "value": round(mean, 4),
                    "violationType": "7 điểm liên tiếp cùng phía đường tâm X-bar",
                    "status": "Out of Control",
                    "severity": "DANGER"
                })

        spc_violations_count = len(violation_logs)

        # Ưu tiên trạng thái nguy hiểm khi năng lực thấp, có vi phạm SPC hoặc có mẫu OOS.
        if cpk < 1.0 or spc_violations_count > 0 or oos_count > 0:
            status = "DANGER"
            status_text = "Không ổn định"
        elif 1.0 <= cpk < 1.33:
            status = "WARNING"
            status_text = "Cần theo dõi"
        else:
            status = "SUCCESS"
            status_text = "Ổn định"

        # Gắn trạng thái/cảnh báo vào từng lô để trả về lịch sử cho dashboard.
        alert_history = []
        for index, batch in enumerate(batch_history):
            event_types = violation_types_by_batch.get(index, [])
            if batch["outOfSpecSamples"]:
                event_types.extend(
                    sample["sampleId"] for sample in batch["outOfSpecSamples"]
                )
                violation_logs.append({
                    "errorName": error_name,
                    "batchId": batch["batchId"],
                    "timestamp": batch["timestamp"],
                    "value": batch["oosCount"],
                    "violationType": "Số mẫu ngoài quy chuẩn",
                    "status": "Out of Spec",
                    "severity": "DANGER"
                })
            batch["violations"] = event_types
            batch["status"] = "DANGER" if event_types else ("WARNING" if status == "WARNING" else "NORMAL")
            if event_types:
                alert_history.append({
                    "errorName": error_name,
                    "batchId": batch["batchId"],
                    "timestamp": batch["timestamp"],
                    "value": batch["mean"],
                    "message": "; ".join(event_types),
                    "severity": "DANGER"
                })

        if status == "WARNING" and batch_history:
            latest_batch = batch_history[-1]
            alert_history.append({
                "errorName": error_name,
                "batchId": latest_batch["batchId"],
                "timestamp": latest_batch["timestamp"],
                "value": round(cpk, 3),
                "message": "Cpk từ 1.00 đến dưới 1.33 (năng lực cần theo dõi)",
                "severity": "WARNING"
            })
        elif status == "DANGER" and cpk < 1.0 and batch_history:
            latest_batch = batch_history[-1]
            alert_history.append({
                "errorName": error_name,
                "batchId": latest_batch["batchId"],
                "timestamp": latest_batch["timestamp"],
                "value": round(cpk, 3),
                "message": "Cpk dưới 1.00 (năng lực không đạt)",
                "severity": "DANGER"
            })

        return {
            "id": defect_id,
            "errorName": error_name,
            "lsl": lsl,
            "usl": usl,
            "cp": round(cp, 3),
            "cpk": round(cpk, 3),
            "sigma": round(sigma_hat, 4),
            "xDoubleBar": round(x_double_bar, 4),
            "rBar": round(r_bar, 4),
            "oosCount": oos_count,
            "totalCount": total_sample_points,
            "spcViolationsCount": spc_violations_count,
            "status": status,
            "statusText": status_text,
            "times": timestamps[-12:],  # Mini Chart chỉ cần 12 điểm gần nhất.
            "means": [round(m, 4) for m in valid_means[-12:]],
            "ranges": [round(value, 4) for value in valid_ranges[-12:]],
            "pChart": {
                "values": [round(float(value), 4) for value in p_values[-12:]],
                "centerLine": round(p_bar, 4),
                "ucl": [round(float(value), 4) for value in ucl_p[-12:]],
                "lcl": [round(float(value), 4) for value in lcl_p[-12:]]
            },
            "cChart": {
                "values": [batch["oosCount"] for batch in batch_history[-12:]],
                "centerLine": round(c_bar, 4),
                "ucl": round(float(ucl_c), 4),
                "lcl": round(float(lcl_c), 4)
            },
            "uclX": round(ucl_x, 4),
            "lclX": round(lcl_x, 4),
            "uclR": round(ucl_r, 4),
            "lclR": round(lcl_r, 4),
            "violationLogs": sorted(
                violation_logs,
                key=lambda log: _timestamp_sort_key(log["timestamp"], 0),
                reverse=True
            ),
            "batchHistory": sorted(
                batch_history,
                key=lambda batch: _timestamp_sort_key(batch["timestamp"], 0),
                reverse=True
            ),
            "alertHistory": sorted(
                alert_history,
                key=lambda event: _timestamp_sort_key(event["timestamp"], 0),
                reverse=True
            )
        }

    except Exception as e:
        # Giữ cấu trúc phản hồi ổn định để dashboard vẫn hiển thị loại lỗi không đọc được.
        logger.error(f"Lỗi tính toán SPC cho {error_name}: {e}")
        return {
            "id": defect_id,
            "errorName": error_name,
            "lsl": lsl,
            "usl": usl,
            "cp": 0.0,
            "cpk": 0.0,
            "sigma": 0.0,
            "xDoubleBar": 0.0,
            "rBar": 0.0,
            "oosCount": 0,
            "totalCount": 0,
            "spcViolationsCount": 0,
            "status": "NO_DATA",
            "statusText": "Lỗi dữ liệu Excel",
            "times": [],
            "means": [],
            "ranges": [],
            "pChart": {"values": [], "centerLine": 0.0, "ucl": [], "lcl": []},
            "cChart": {"values": [], "centerLine": 0.0, "ucl": 0.0, "lcl": 0.0},
            "uclX": 0.0,
            "lclX": 0.0,
            "uclR": 0.0,
            "lclR": 0.0,
            "violationLogs": [],
            "batchHistory": [],
            "alertHistory": []
        }


def _timestamp_sort_key(value: Any, fallback_index: int) -> tuple[int, int]:
    """Chuẩn hóa nhiều định dạng thời gian thành khóa sắp xếp tăng dần."""
    # Dữ liệu cũ có thể dùng cả dấu gạch dưới, phút không có giây hoặc định dạng tự nhận diện.
    timestamp_text = str(value).replace("_", " ")
    timestamp = pd.to_datetime(timestamp_text, format="%H:%M:%S %d/%m/%Y", errors="coerce")
    if pd.isna(timestamp):
        timestamp = pd.to_datetime(timestamp_text, format="%H:%M %d/%m/%Y", errors="coerce")
    if pd.isna(timestamp):
        timestamp = pd.to_datetime(value, errors="coerce")
    if pd.isna(timestamp):
        return (1, fallback_index)
    return (0, int(timestamp.value), fallback_index)


def _load_virtual_batches(defect_id: str) -> List[Dict[str, Any]]:
    """Đọc các lô mô phỏng của một loại lỗi từ cơ sở dữ liệu SQLite."""
    if not VIRTUAL_DATA_DB_PATH.is_file():
        return []

    # Luôn đóng kết nối ngay cả khi câu truy vấn hoặc giải mã dữ liệu gặp lỗi.
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

    virtual_batches = []
    for batch_id, timestamp, values_json in rows:
        values = json.loads(values_json)
        virtual_batches.append({
            "TIME": timestamp,
            "ID": batch_id,
            **values
        })
    return virtual_batches


def _sync_fetch_all_defects() -> Dict[str, Any]:
    """Đọc workbook, ghép dữ liệu mô phỏng và tổng hợp trạng thái các sheet."""
    start_time = time.time()
    defects_data = []

    with pd.ExcelFile(DATA_WORKBOOK_PATH) as workbook:
        for sheet_index, sheet_name in enumerate(workbook.sheet_names, start=1):
            # Mỗi sheet lưu tên lỗi/giới hạn ở phần đầu và các nhóm mẫu từ hàng tiêu đề thứ 5.
            metadata = pd.read_excel(
                workbook,
                sheet_name=sheet_name,
                header=None,
                nrows=2
            )
            config = {
                "id": f"defect_{sheet_index}",
                "errorName": str(metadata.iat[0, 0]).strip(),
                "lsl": _parse_spec_limit(metadata.iat[1, 1]),
                "usl": _parse_spec_limit(metadata.iat[1, 2])
            }
            sheet_data = pd.read_excel(
                workbook,
                sheet_name=sheet_name,
                header=4
            )
            # Ghép các lô mô phỏng vào dữ liệu thật trước khi tính chung chỉ số SPC.
            virtual_rows = _load_virtual_batches(config["id"])
            if virtual_rows:
                sheet_data = pd.concat(
                    [sheet_data, pd.DataFrame(virtual_rows)],
                    ignore_index=True
                )
            defects_data.append(_calculate_spc_for_single_sheet(config, sheet_data))

    danger_count = sum(1 for d in defects_data if d["status"] == "DANGER")
    warning_count = sum(1 for d in defects_data if d["status"] == "WARNING")
    success_count = sum(1 for d in defects_data if d["status"] == "SUCCESS")
    no_data_count = sum(1 for d in defects_data if d["status"] == "NO_DATA")
    alert_history = sorted(
        (event for defect in defects_data for event in defect["alertHistory"]),
        key=lambda event: _timestamp_sort_key(event["timestamp"], 0),
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


def _parse_spec_limit(value: Any) -> float:
    """Chuyển giới hạn quy chuẩn trong workbook thành số thực."""
    if isinstance(value, str):
        value = value.strip().replace(",", ".")
    parsed_value = pd.to_numeric(value, errors="coerce")
    if pd.isna(parsed_value):
        raise ValueError(f"Giới hạn quy chuẩn trong Excel không hợp lệ: {value!r}")
    return float(parsed_value)


async def get_cached_spc_data() -> Dict[str, Any]:
    """Trả dữ liệu SPC còn hạn trong cache hoặc tính mới từ workbook."""
    global _data_cache
    now = time.time()

    # Chỉ dùng cache trong thời hạn cấu hình; xử lý workbook đồng bộ ở thread riêng.
    if _data_cache["payload"] is not None and (now - _data_cache["timestamp"]) < CACHE_TTL_SECONDS:
        return _data_cache["payload"]

    try:
        payload = await asyncio.to_thread(_sync_fetch_all_defects)
        _data_cache["timestamp"] = now
        _data_cache["payload"] = payload
        return payload
    except Exception as e:
        # Khi lần tải mới lỗi, dùng dữ liệu hợp lệ gần nhất nếu đã có; nếu chưa có thì báo HTTP 500.
        if _data_cache["payload"] is not None:
            logger.warning(f"Sử dụng Cache cũ do gặp lỗi khi tải mới: {e}")
            return _data_cache["payload"]
        raise HTTPException(status_code=500, detail=f"Không thể xử lý dữ liệu Multi-Defect SPC: {str(e)}")


@app.get("/")
async def get_index_page():
    """Phục vụ trang HTML chính của dashboard."""
    return FileResponse(ROOT_PATH / "template" / "index.html")


@app.get("/api/spc")
async def get_spc_metrics():
    """Trả các chỉ số, trạng thái và cảnh báo SPC dưới dạng JSON."""
    data = await get_cached_spc_data()
    return JSONResponse(content=data)


@app.get("/api/simulator/status")
async def get_simulator_status():
    """Trả trạng thái hiện tại của bộ nạp dữ liệu mô phỏng."""
    return virtual_data_simulator.status()


@app.post("/api/simulator/start")
async def start_virtual_data():
    """Khởi chạy phiên mô phỏng và làm mới cache dữ liệu SPC."""
    global _data_cache
    try:
        status = await virtual_data_simulator.start()
    except Exception as error:
        logger.exception("Không thể khởi động bộ nạp dữ liệu ảo.")
        raise HTTPException(
            status_code=500,
            detail=f"Không thể khởi động bộ nạp dữ liệu ảo: {error}"
        ) from error
    # Cache cũ không chứa lô vừa tạo nên buộc lần đọc tiếp theo tính lại.
    _data_cache = {"timestamp": 0.0, "payload": None}
    return status


@app.post("/api/simulator/stop")
async def stop_virtual_data():
    """Dừng phiên mô phỏng, xóa dữ liệu phiên đó và làm mới cache."""
    global _data_cache
    status = await virtual_data_simulator.stop()
    # Dữ liệu mô phỏng đã bị xóa, vì vậy không trả lại kết quả cache còn chứa các lô đó.
    _data_cache = {"timestamp": 0.0, "payload": None}
    return status


@app.websocket("/ws/dashboard")
async def websocket_dashboard_endpoint(websocket: WebSocket):
    """Gửi dữ liệu dashboard khi nội dung SPC thay đổi."""
    await manager.connect(websocket)
    previous_defects = None
    try:
        while True:
            spc_data = await get_cached_spc_data()
            # Chỉ gửi khi danh sách loại lỗi thay đổi, tránh đẩy lại nguyên trạng mỗi chu kỳ polling.
            current_defects = json.dumps(spc_data["defects"], sort_keys=True, ensure_ascii=False)
            if current_defects != previous_defects:
                await websocket.send_json(spc_data)
                previous_defects = current_defects
            await asyncio.sleep(CACHE_TTL_SECONDS)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Lỗi trên kết nối WebSocket: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    # Cho phép chạy trực tiếp trong môi trường phát triển; launcher dùng cấu hình riêng khi đóng gói.
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)