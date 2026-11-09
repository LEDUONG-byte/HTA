# Kiến trúc Hệ thống HTA (SPC Dashboard)

Hệ thống **HTA** được thiết kế theo kiến trúc phân tầng module hóa (Clean Layered Architecture), tách biệt hoàn toàn giữa các tầng: Dữ liệu (Data), Nghiệp vụ lõi (Core Domain), Giao tiếp mạng (API Layer), và Giao diện người dùng (Presentation Layer).

---

## 🏗️ Sơ đồ tổng thể hệ thống

```
+-------------------------------------------------------------------------+
|                        Presentation Layer (Frontend)                    |
|       template/index.html  |  css/spc-modern.css  |  js/app.js          |
+------------------------------------+------------------------------------+
                                     | (REST HTTP / WebSocket)
                                     v
+------------------------------------+------------------------------------+
|                             API Layer                                   |
|       api/routes.py (REST: /api/spc, /api/simulator/* | WS: /ws)        |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                            Core Domain Layer                            |
|  +--------------------+  +--------------------+  +-------------------+  |
|  |   spc_calculator   |  |   cache_manager    |  | websocket_manager |  |
|  |  (X-bar, R, P, C,  |  |  (Double-Checked   |  | (Broadcast O(1),  |  |
|  |   Cp, Cpk, Rules)  |  |   TTL Lock 5.0s)   |  |  Set Manager)     |  |
|  +--------------------+  +--------------------+  +-------------------+  |
|  +--------------------+  +--------------------+  +-------------------+  |
|  |    data_loader     |  |     simulator      |  |      config       |  |
|  | (Excel I/O, SQLite |  |  (Virtual Batch    |  | (Constants, Paths,|  |
|  |  Merge Matrix)     |  |   Cycle Generator) |  |  Unified Logging) |  |
|  +--------------------+  +--------------------+  +-------------------+  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|                            Persistence Layer                            |
|       ER_TABLE.xlsx (Dữ liệu gốc)  |  SQLite virtual_batches (Tạm thời) |
+-------------------------------------------------------------------------+
```

---

## 🧩 Chi tiết các thành phần

### 1. Core Domain Layer (`core/`)
* **`config.py`**:
  - Tự động nhận diện thư mục gốc `ROOT_PATH` (hỗ trợ cả môi trường lập trình lẫn bản đóng gói PyInstaller qua `_MEIPASS`).
  - Hằng số kiểm soát Shewhart cho cỡ mẫu $n=10$: $A_2 = 0.308$, $D_3 = 0.223$, $D_4 = 1.777$, $d_2 = 3.078$.
* **`spc_calculator.py`**:
  - Sử dụng NumPy vectorization ma trận thay cho vòng lặp hàng để tăng tốc xử lý dữ liệu.
  - Phân tích thống kê Shewhart 3-sigma, chỉ số năng lực quá trình $C_p$ và $C_{pk}$.
  - Nhận diện vi phạm giới hạn kiểm soát và quy tắc chuỗi 7 điểm một phía (Western Electric Run Rules).
* **`data_loader.py`**:
  - Trích xuất dữ liệu đa sheet từ `ER_TABLE.xlsx`.
  - Đọc và hợp nhất các lô mô phỏng ảo từ SQLite.
* **`cache_manager.py`**:
  - Bộ nhớ đệm In-memory với cơ chế Double-Checked Locking qua `asyncio.Lock()`, triệt tiêu hoàn toàn nguy cơ Cache Stampede khi có nhiều truy vấn đồng thời.
  - Đánh số phiên bản `_version` cho mỗi lần làm mới.
* **`websocket_manager.py`**:
  - Quản lý tập hợp các kết nối WebSocket client, phát dữ liệu song song qua `asyncio.gather(..., return_exceptions=True)`.
* **`simulator.py`**:
  - Bộ mô phỏng sinh dữ liệu đo lường ảo độc lập, chu kỳ 60 giây, tự động dọn sạch cơ sở dữ liệu khi kết thúc.

---

### 2. API Layer (`api/`)
* Cung cấp các RESTful API endpoints độc lập.
* Luồng WebSocket sử dụng kiểm tra phiên bản `_version` độ phức tạp $O(1)$ thay vì tuần tự hóa JSON liên tục.

---

### 3. Presentation Layer
* **Offline 100%**: Không phụ thuộc vào kết nối Internet khi vận hành.
* Thư viện Chart.js, jQuery, Bootstrap được lưu trữ nội bộ tại `lib/`.
* Thiết kế phẳng hiện đại, tối ưu không gian hiển thị, loại bỏ bóng đổ và bo góc nhẹ nhàng.

