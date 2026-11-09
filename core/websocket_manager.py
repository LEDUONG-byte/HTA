"""Quản lý kết nối và truyền dữ liệu thời gian thực qua giao thức WebSocket."""

import asyncio
from typing import Any, Dict, Set
from fastapi import WebSocket

from core.config import logger


class ConnectionManager:
    """Quản lý vòng đời và gửi dữ liệu tới các client WebSocket kết nối tới dashboard."""

    def __init__(self) -> None:
        """Khởi tạo tập hợp kết nối WebSocket đang hoạt động."""
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        """Chấp nhận kết nối mới và lưu vào tập hợp quản lý."""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"Client WebSocket kết nối mới. Tổng client: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Loại bỏ client khỏi tập hợp quản lý khi ngắt kết nối."""
        self.active_connections.discard(websocket)
        logger.info(f"Client ngắt kết nối. Còn lại: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """Gửi đồng loạt gói tin JSON tới tất cả các client đang trực tuyến bất đồng bộ."""
        if not self.active_connections:
            return

        connections = list(self.active_connections)
        results = await asyncio.gather(
            *(conn.send_json(message) for conn in connections),
            return_exceptions=True
        )

        for conn, res in zip(connections, results):
            if isinstance(res, Exception):
                logger.error(f"Lỗi khi broadcast tin nhắn tới client: {res}")
                self.disconnect(conn)


manager = ConnectionManager()
