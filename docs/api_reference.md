# Tài liệu API Tham chiếu (API Reference)

Tất cả các API được phục vụ bởi máy chủ FastAPI cục bộ (mặc định tại `http://127.0.0.1:8000`).

---

## 📡 REST Endpoints

### 1. Lấy dữ liệu SPC tổng hợp
* **Endpoint**: `GET /api/spc`
* **Mô tả**: Trả về toàn bộ các chỉ số kiểm soát chất lượng, biểu đồ SPC và cảnh báo cho tất cả 8 loại lỗi.
* **Phản hồi mẫu**:
  ```json
  {
    "_version": 1,
    "summary": {
      "totalDefectTypes": 8,
      "dangerCount": 2,
      "warningCount": 1,
      "successCount": 5,
      "noDataCount": 0,
      "timestamp": "18:30:00 06/11/2026"
    },
    "defects": [
      {
        "id": "defect_1",
        "errorName": "Lỗi cần cong biến dạng sau nung",
        "lsl": 0.12,
        "usl": 0.18,
        "cp": 1.25,
        "cpk": 1.18,
        "status": "WARNING",
        "statusText": "Cần theo dõi",
        "uclX": 0.177,
        "lclX": 0.123,
        "pChart": { ... },
        "cChart": { ... },
        "batchHistory": [ ... ]
      }
    ],
    "alertHistory": [ ... ],
    "processTimeSeconds": 0.045
  }
  ```

---

### 2. Kiểm tra trạng thái bộ nạp dữ liệu ảo
* **Endpoint**: `GET /api/simulator/status`
* **Mô tả**: Trả về trạng thái hoạt động hiện tại của trình mô phỏng dữ liệu ảo.
* **Phản hồi mẫu**:
  ```json
  {
    "running": true,
    "intervalSeconds": 60,
    "cycle": 3,
    "checksPerBatch": 8,
    "lastError": null
  }
  ```

---

### 3. Bắt đầu sinh dữ liệu ảo
* **Endpoint**: `POST /api/simulator/start`
* **Mô tả**: Kích hoạt phiên mô phỏng, tạo lô đầu tiên ngay lập tức và tự động tạo các lô tiếp theo mỗi 60 giây. Làm mới bộ nhớ đệm cache.

---

### 4. Dừng và xóa dữ liệu ảo
* **Endpoint**: `POST /api/simulator/stop`
* **Mô tả**: Dừng phiên mô phỏng, tự động xóa sạch các bản ghi lô ảo đã sinh trong phiên và làm mới bộ nhớ đệm.

---

## ⚡ WebSocket Endpoint

### Luồng truyền dữ liệu thời gian thực
* **Endpoint**: `ws://127.0.0.1:8000/ws/dashboard`
* **Cơ chế**:
  - Khi client kết nối, hệ thống gửi gói dữ liệu SPC ban đầu.
  - Sau mỗi chu kỳ cấu hình (5 giây), máy chủ so sánh `_version` của dữ liệu hiện tại với phiên bản đã gửi. Nếu có thay đổi (do có dữ liệu mới hoặc thao tác mô phỏng), gói tin cập nhật mới sẽ được phát tới client.

