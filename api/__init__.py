"""API module: Định tuyến REST endpoints và quản lý giao thức WebSocket."""

from api.routes import router, virtual_data_simulator

__all__ = ["router", "virtual_data_simulator"]
