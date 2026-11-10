"""API FastAPI chính và điểm lắp ráp ứng dụng cho hệ thống SPC Dashboard."""

import asyncio
import posixpath
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api import router as api_router, virtual_data_simulator
from core import (
    A2_N10,
    CACHE_TTL_SECONDS,
    D2_N10,
    D3_N10,
    D4_N10,
    DATA_WORKBOOK_PATH,
    ROOT_PATH,
    VIRTUAL_DATA_DB_PATH,
    ConnectionManager,
    calculate_spc_for_single_sheet,
    clear_virtual_batches,
    get_cached_spc_data,
    invalidate_cache,
    load_virtual_batches,
    logger,
    manager,
    parse_spec_limit,
    sync_fetch_all_defects,
    timestamp_sort_key,
)

# Re-export các thành phần cốt lõi để duy trì tương thích 100% với các script hoặc test cũ
__all__ = [
    "app",
    "manager",
    "virtual_data_simulator",
    "get_cached_spc_data",
    "invalidate_cache",
    "calculate_spc_for_single_sheet",
    "sync_fetch_all_defects",
    "ROOT_PATH",
    "A2_N10",
    "D2_N10",
    "D3_N10",
    "D4_N10",
    "CACHE_TTL_SECONDS",
    "DATA_WORKBOOK_PATH",
    "VIRTUAL_DATA_DB_PATH",
    "logger",
    "load_virtual_batches",
    "parse_spec_limit",
    "timestamp_sort_key",
    "ConnectionManager",
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Dọn dữ liệu mô phỏng khi khởi động và dừng tác vụ khi ứng dụng kết thúc."""
    removed_rows = await asyncio.to_thread(clear_virtual_batches, VIRTUAL_DATA_DB_PATH)
    invalidate_cache()
    if removed_rows:
        logger.info("Đã xóa %s lô ảo còn sót từ lần chạy trước.", removed_rows)
    try:
        yield
    finally:
        await virtual_data_simulator.stop()
        invalidate_cache()


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


@app.middleware("http")
async def normalize_path_middleware(request: Request, call_next):
    """Chuẩn hóa đường dẫn và thiết lập header cấm cache tuyệt đối để tránh dùng script cũ."""
    path = request.scope.get("path", "")
    if "/../" in path or path.startswith("/.."):
        clean_path = posixpath.normpath(path)
        request.scope["path"] = clean_path
    response: Response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


# Phục vụ các tài nguyên tĩnh
app.mount("/css", StaticFiles(directory=str(ROOT_PATH / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(ROOT_PATH / "js")), name="js")
app.mount("/lib", StaticFiles(directory=str(ROOT_PATH / "lib")), name="lib")
app.mount("/template", StaticFiles(directory=str(ROOT_PATH / "template")), name="template")


@app.get("/favicon.ico", include_in_schema=False)
async def get_favicon():
    """Trả về 204 No Content để tránh lỗi 404 trên console khi trình duyệt hỏi favicon."""
    return Response(status_code=204)


@app.get("/")
async def get_index_page():
    """Phục vụ trang HTML chính của dashboard."""
    return FileResponse(
        ROOT_PATH / "template" / "index.html",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


# Đăng ký các route API REST và WebSocket
app.include_router(api_router)


if __name__ == "__main__":
    # Cho phép chạy trực tiếp trong môi trường phát triển; launcher dùng cấu hình riêng khi đóng gói.
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
