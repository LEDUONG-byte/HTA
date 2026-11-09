"""Các endpoint API REST và kết nối WebSocket cho hệ thống SPC Dashboard."""

import asyncio
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from core.cache_manager import get_cached_spc_data, invalidate_cache
from core.config import CACHE_TTL_SECONDS, logger
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
