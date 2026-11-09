"""Quản lý bộ nhớ đệm (In-memory Cache) kết quả tính toán SPC an toàn đa luồng và tối ưu I/O."""

import asyncio
import time
from typing import Any, Dict
from fastapi import HTTPException

from core.config import CACHE_TTL_SECONDS, logger
from core.data_loader import sync_fetch_all_defects

_data_cache: Dict[str, Any] = {
    "timestamp": 0.0,
    "payload": None,
    "version": 0
}
_cache_lock = asyncio.Lock()


def invalidate_cache() -> None:
    """Xóa bộ nhớ đệm, buộc lần truy vấn tiếp theo phải tính toán lại từ đầu."""
    global _data_cache
    _data_cache["timestamp"] = 0.0
    _data_cache["payload"] = None
    _data_cache["version"] += 1


async def get_cached_spc_data() -> Dict[str, Any]:
    """Trả về dữ liệu SPC từ bộ nhớ đệm nếu còn hạn TTL, hoặc tính toán mới an toàn chống tranh chấp (Cache Stampede)."""
    global _data_cache
    now = time.time()

    # Kiểm tra nhanh không cần khóa nếu cache còn trong thời hạn TTL
    if _data_cache["payload"] is not None and (now - _data_cache["timestamp"]) < CACHE_TTL_SECONDS:
        return _data_cache["payload"]

    async with _cache_lock:
        # Kiểm tra kép (Double-checked locking pattern) để tránh nhiều request tính đồng thời
        now = time.time()
        if _data_cache["payload"] is not None and (now - _data_cache["timestamp"]) < CACHE_TTL_SECONDS:
            return _data_cache["payload"]

        try:
            payload = await asyncio.to_thread(sync_fetch_all_defects)
            _data_cache["version"] += 1
            payload["_version"] = _data_cache["version"]
            _data_cache["timestamp"] = now
            _data_cache["payload"] = payload
            return payload
        except Exception as e:
            if _data_cache["payload"] is not None:
                logger.warning(f"Sử dụng Cache cũ do gặp lỗi khi tải mới: {e}")
                return _data_cache["payload"]
            raise HTTPException(
                status_code=500,
                detail=f"Không thể xử lý dữ liệu Multi-Defect SPC: {str(e)}"
            )
