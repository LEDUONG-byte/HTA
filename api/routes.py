"""Các endpoint API REST và kết nối WebSocket cho hệ thống SPC Dashboard."""

import asyncio
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from core.cache_manager import get_cached_spc_data, invalidate_cache
from core.config import CACHE_TTL_SECONDS, logger
from core.data_loader import clear_user_edits, get_raw_defect_batches, load_user_edits, save_user_edits
from core.websocket_manager import manager
from core.simulator import VirtualDataSimulator

router = APIRouter()
virtual_data_simulator = VirtualDataSimulator()


@router.get("/api/spc")
async def get_spc_metrics():
    """Trả các chỉ số, trạng thái và cảnh báo SPC dưới dạng JSON."""
    data = await get_cached_spc_data()
    return JSONResponse(content=data)


@router.get("/api/simulator/status")
async def get_simulator_status():
    """Trả trạng thái hiện tại của bộ nạp dữ liệu mô phỏng."""
    return virtual_data_simulator.status()


@router.post("/api/simulator/start")
async def start_virtual_data():
    """Khởi chạy phiên mô phỏng và làm mới cache dữ liệu SPC."""
    try:
        status = await virtual_data_simulator.start()
    except Exception as error:
        logger.exception("Không thể khởi động bộ nạp dữ liệu ảo.")
        raise HTTPException(
            status_code=500,
            detail=f"Không thể khởi động bộ nạp dữ liệu ảo: {error}"
        ) from error
    # Xóa cache cũ để lần truy vấn tiếp theo cập nhật lô mới sinh
    invalidate_cache()
    return status


@router.post("/api/simulator/stop")
async def stop_virtual_data():
    """Dừng phiên mô phỏng, xóa dữ liệu ảo và làm mới cache."""
    status = await virtual_data_simulator.stop()
    # Dữ liệu mô phỏng đã bị xóa, buộc làm mới cache
    invalidate_cache()
    return status


@router.websocket("/ws/dashboard")
async def websocket_dashboard_endpoint(websocket: WebSocket):
    """Gửi dữ liệu dashboard thời gian thực qua cơ chế phiên bản (_version) hiệu năng cao."""
    await manager.connect(websocket)
    previous_version = -1
    try:
        while True:
            spc_data = await get_cached_spc_data()
            current_version = spc_data.get("_version", 0)
            # So sánh phiên bản dữ liệu (O(1)) thay vì serialize toàn bộ cây JSON
            if current_version != previous_version:
                await websocket.send_json(spc_data)
                previous_version = current_version
            await asyncio.sleep(CACHE_TTL_SECONDS)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Lỗi trên kết nối WebSocket: {e}")
        manager.disconnect(websocket)


@router.get("/api/editor/data")
async def get_editor_data(defect_id: str = None):
    """Trả về dữ liệu thô (metadata + các lô đo X1..X10) để người dùng xem và chỉnh sửa."""
    data = await asyncio.to_thread(get_raw_defect_batches, defect_id)
    return JSONResponse(content=data)


@router.post("/api/editor/save")
async def save_editor_data(payload: Dict[str, Any]):
    """Lưu dữ liệu tùy chỉnh của người dùng, làm mới cache và tính lại SPC tức thì."""
    defect_id = payload.get("defectId")
    if not defect_id:
        raise HTTPException(status_code=400, detail="Thiếu trường bắt buộc defectId")

    edits = await asyncio.to_thread(load_user_edits)
    edits[defect_id] = {
        "errorName": payload.get("config", {}).get("errorName"),
        "lsl": payload.get("config", {}).get("lsl"),
        "usl": payload.get("config", {}).get("usl"),
        "batches": payload.get("batches", [])
    }
    await asyncio.to_thread(save_user_edits, edits)
    invalidate_cache()
    # Tính toán lại dữ liệu mới nhất
    spc_data = await get_cached_spc_data()
    return JSONResponse(content={
        "status": "success",
        "message": "Đã lưu và cập nhật chỉ số SPC thành công",
        "summary": spc_data.get("summary")
    })


@router.post("/api/editor/reset")
async def reset_editor_data(payload: Dict[str, Any] = None):
    """Khôi phục lại dữ liệu nguyên bản từ file Excel cho một hoặc toàn bộ loại lỗi."""
    defect_id = payload.get("defectId") if payload else None
    await asyncio.to_thread(clear_user_edits, defect_id)
    invalidate_cache()
    spc_data = await get_cached_spc_data()
    return JSONResponse(content={
        "status": "success",
        "message": "Đã khôi phục dữ liệu gốc từ Excel thành công",
        "summary": spc_data.get("summary")
    })
