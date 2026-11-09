"""Bộ tính toán thống kê và động cơ phân tích kiểm soát chất lượng SPC (Statistical Process Control)."""

from datetime import datetime
from typing import Any, Dict, List
import numpy as np
import pandas as pd

from core.config import A2_N10, D2_N10, D3_N10, D4_N10, logger


def timestamp_sort_key(value: Any, fallback_index: int) -> tuple[int, int, int]:
    """Chuẩn hóa định dạng thời gian thành khóa sắp xếp tăng dần hiệu năng cao."""
    if value is None or pd.isna(value):
        return (1, 0, fallback_index)

    if isinstance(value, (datetime, pd.Timestamp)):
        return (0, int(value.timestamp()), fallback_index)

    text = str(value).replace("_", " ").strip()
    if not text:
        return (1, 0, fallback_index)

    # Ưu tiên parse nhanh qua datetime.strptime chuẩn C
    for fmt in (
        "%H:%M:%S %d/%m/%Y",
        "%H:%M %d/%m/%Y",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
        "%Y-%m-%d"
    ):
        try:
            dt = datetime.strptime(text, fmt)
            return (0, int(dt.timestamp()), fallback_index)
        except ValueError:
            continue

    # Fallback cho các định dạng không chuẩn
    ts = pd.to_datetime(text, errors="coerce")
    if pd.notna(ts):
        return (0, int(ts.timestamp()), fallback_index)

    return (1, 0, fallback_index)


def calculate_spc_for_single_sheet(
    sheet_config: Dict[str, Any],
    df: pd.DataFrame
) -> Dict[str, Any]:
    """Tính toán toàn bộ các chỉ số kiểm soát SPC, năng lực quá trình và quy tắc vi phạm cho 1 loại lỗi."""
    defect_id = sheet_config["id"]
    error_name = sheet_config["errorName"]
    lsl = float(sheet_config["lsl"])
    usl = float(sheet_config["usl"])

    try:
        df.columns = [str(col).strip() for col in df.columns]
        sample_cols = [f"X{i}" for i in range(1, 11)]
        existing_cols = [c for c in sample_cols if c in df.columns]

        if not existing_cols:
            raise ValueError(f"Không tìm thấy cột dữ liệu X1-X10 ở loại lỗi {error_name}")

        existing_col_indices = {col: idx for idx, col in enumerate(existing_cols)}

        # Chuyển đổi ma trận mẫu số đo thành mảng NumPy float64 (tối ưu tốc độ gấp 20-50 lần iterrows)
        numeric_df = df[existing_cols].apply(pd.to_numeric, errors="coerce")
        raw_matrix = numeric_df.to_numpy(dtype=np.float64)

        time_series = df["TIME"].tolist() if "TIME" in df.columns else [None] * len(df)
        id_series = df["ID"].tolist() if "ID" in df.columns else [None] * len(df)
        virtual_series = df["_virtual"].tolist() if "_virtual" in df.columns else [False] * len(df)

        batch_history = []
        oos_count = 0
        total_sample_points = 0

        for row_idx in range(len(df)):
            row_vals = raw_matrix[row_idx]
            valid_mask = ~np.isnan(row_vals)
            valid_samples = row_vals[valid_mask]

            if len(valid_samples) < 2:
                continue

            row_mean = float(np.mean(valid_samples))
            row_range = float(np.ptp(valid_samples))
            out_of_spec_samples = []

            for col_name, val in zip(existing_cols, row_vals):
                if np.isnan(val):
                    continue
                total_sample_points += 1
                if val < lsl or val > usl:
                    oos_count += 1
                    out_of_spec_samples.append({
                        "sampleId": col_name,
                        "value": round(float(val), 6),
                        "violatedLimit": "LSL" if val < lsl else "USL",
                        "limit": lsl if val < lsl else usl
                    })

            raw_time = time_series[row_idx]
            timestamp = str(raw_time) if pd.notna(raw_time) and str(raw_time).strip() else f"R_{row_idx + 1}"

            raw_id = id_series[row_idx]
            batch_id = str(raw_id) if pd.notna(raw_id) and str(raw_id).strip() else f"R_{row_idx + 1}"

            is_virtual = bool(virtual_series[row_idx]) if pd.notna(virtual_series[row_idx]) else False

            values_dict = {}
            for col in sample_cols:
                if col in existing_col_indices:
                    v = row_vals[existing_col_indices[col]]
                    values_dict[col] = round(float(v), 6) if not np.isnan(v) else None
                else:
                    values_dict[col] = None

            batch_history.append({
                "timestamp": timestamp,
                "batchId": batch_id,
                "isVirtual": is_virtual,
                "values": values_dict,
                "mean": round(row_mean, 4),
                "range": round(row_range, 4),
                "sampleCount": len(valid_samples),
                "oosCount": len(out_of_spec_samples),
                "outOfSpecSamples": out_of_spec_samples,
                "_sortKey": timestamp_sort_key(timestamp, row_idx)
            })

        if not batch_history:
            raise ValueError("Không có dữ liệu hợp lệ sau khi làm sạch")

        # Sắp xếp lịch sử lô theo thời gian tăng dần
        batch_history.sort(key=lambda batch: batch["_sortKey"])
        for batch in batch_history:
            batch.pop("_sortKey")

        valid_means = [batch["mean"] for batch in batch_history]
        valid_ranges = [batch["range"] for batch in batch_history]
        timestamps = [batch["timestamp"] for batch in batch_history]

        # 1. Giới hạn kiểm soát X-bar và R
        x_double_bar = float(np.mean(valid_means))
        r_bar = float(np.mean(valid_ranges))
        ucl_x = x_double_bar + A2_N10 * r_bar
        lcl_x = x_double_bar - A2_N10 * r_bar
        ucl_r = D4_N10 * r_bar
        lcl_r = D3_N10 * r_bar

        # 2. Biểu đồ P (tỷ lệ phế phẩm)
        p_bar = (oos_count / total_sample_points) if total_sample_points > 0 else 0.0
        p_values = [
            (batch["oosCount"] / batch["sampleCount"]) if batch["sampleCount"] > 0 else 0.0
            for batch in batch_history
        ]
        ucl_p = [
            min(
                1.0,
                p_bar + 3 * np.sqrt(p_bar * (1.0 - p_bar) / batch["sampleCount"])
            ) if batch["sampleCount"] > 0 else 1.0
            for batch in batch_history
        ]
        lcl_p = [
            max(
                0.0,
                p_bar - 3 * np.sqrt(p_bar * (1.0 - p_bar) / batch["sampleCount"])
            ) if batch["sampleCount"] > 0 else 0.0
            for batch in batch_history
        ]

        # 3. Biểu đồ C (số khuyết tật đếm được)
        c_bar = float(np.mean([batch["oosCount"] for batch in batch_history]))
        ucl_c = c_bar + 3 * np.sqrt(c_bar)
        lcl_c = max(0.0, c_bar - 3 * np.sqrt(c_bar))

        violation_types_by_batch = {}

        # 4. Năng lực quá trình Cp / Cpk (ước lượng sigma qua R-bar / d2)
        sigma_hat = (r_bar / D2_N10) if D2_N10 > 0 else 0.001
        cp = ((usl - lsl) / (6 * sigma_hat)) if sigma_hat > 0 else 0.0
        cpk_upper = ((usl - x_double_bar) / (3 * sigma_hat)) if sigma_hat > 0 else 0.0
        cpk_lower = ((x_double_bar - lsl) / (3 * sigma_hat)) if sigma_hat > 0 else 0.0
        cpk = float(min(cpk_upper, cpk_lower))

        # 5. Kiểm tra vi phạm giới hạn kiểm soát X-bar & R
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

        # 6. Quy tắc chuỗi (Run Rule): 7 điểm liên tiếp cùng phía đường tâm CL
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

        # 7. Đánh giá trạng thái quy trình
        if cpk < 1.0 or spc_violations_count > 0 or oos_count > 0:
            status = "DANGER"
            status_text = "Không ổn định"
        elif 1.0 <= cpk < 1.33:
            status = "WARNING"
            status_text = "Cần theo dõi"
        else:
            status = "SUCCESS"
            status_text = "Ổn định"

        # Gắn cảnh báo chi tiết vào từng lô
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
            "cp": round(cp, 3) if np.isfinite(cp) else 0.0,
            "cpk": round(cpk, 3) if np.isfinite(cpk) else 0.0,
            "sigma": round(sigma_hat, 4) if np.isfinite(sigma_hat) else 0.0,
            "xDoubleBar": round(x_double_bar, 4) if np.isfinite(x_double_bar) else 0.0,
            "rBar": round(r_bar, 4) if np.isfinite(r_bar) else 0.0,
            "oosCount": oos_count,
            "totalCount": total_sample_points,
            "spcViolationsCount": spc_violations_count,
            "status": status,
            "statusText": status_text,
            "times": timestamps[-12:],
            "means": [round(m, 4) for m in valid_means[-12:]],
            "ranges": [round(val, 4) for val in valid_ranges[-12:]],
            "pChart": {
                "values": [round(float(val), 4) for val in p_values[-12:]],
                "centerLine": round(p_bar, 4) if np.isfinite(p_bar) else 0.0,
                "ucl": [round(float(val), 4) for val in ucl_p[-12:]],
                "lcl": [round(float(val), 4) for val in lcl_p[-12:]]
            },
            "cChart": {
                "values": [batch["oosCount"] for batch in batch_history[-12:]],
                "centerLine": round(c_bar, 4) if np.isfinite(c_bar) else 0.0,
                "ucl": round(float(ucl_c), 4) if np.isfinite(ucl_c) else 0.0,
                "lcl": round(float(lcl_c), 4) if np.isfinite(lcl_c) else 0.0
            },
            "uclX": round(ucl_x, 4) if np.isfinite(ucl_x) else 0.0,
            "lclX": round(lcl_x, 4) if np.isfinite(lcl_x) else 0.0,
            "uclR": round(ucl_r, 4) if np.isfinite(ucl_r) else 0.0,
            "lclR": round(lcl_r, 4) if np.isfinite(lcl_r) else 0.0,
            "violationLogs": sorted(
                violation_logs,
                key=lambda log: timestamp_sort_key(log["timestamp"], 0),
                reverse=True
            ),
            "batchHistory": sorted(
                batch_history,
                key=lambda batch: timestamp_sort_key(batch["timestamp"], 0),
                reverse=True
            ),
            "alertHistory": sorted(
                alert_history,
                key=lambda event: timestamp_sort_key(event["timestamp"], 0),
                reverse=True
            )
        }

    except Exception as e:
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
