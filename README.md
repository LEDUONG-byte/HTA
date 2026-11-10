# HTA - SPC Intelligent Quality Dashboard

**HTA (Statistical Process Control Intelligent)** là giải pháp phần mềm giám sát chất lượng và kiểm soát quy trình thống kê công nghiệp theo thời gian thực (Real-time Industrial SPC Platform). Ứng dụng được thiết kế chuyên biệt cho các nhà máy sản xuất, phòng QA/QC, và các kỹ sư quản lý quy trình nhằm phát hiện sớm các bất thường chất lượng, giảm thiểu phế phẩm và tối ưu hóa năng lực sản xuất.

Ứng dụng sở hữu ngôn ngữ thiết kế **Axon SaaS (Geist Typography & Warm Industrial Palette)** hiện đại, chuẩn màn hình điều hành công nghiệp 100vh không cuộn, tích hợp động cơ toán học SPC Shewhart 3-sigma, bộ 8 quy tắc phát hiện bất thường Nelson, trình giả lập dữ liệu ảo và **trình biên tập dữ liệu đo lường trực quan** không xâm lấn tệp Excel gốc.

---

## Mục lục

1. [Điểm nổi bật của hệ thống](#1-điểm-nổi-bật-của-hệ-thống)
2. [Kiến trúc hệ thống & Cấu trúc thư mục](#2-kiến-trúc-hệ-thống--cấu-trúc-thư-mục)
3. [Các phân hệ chức năng trên Dashboard](#3-các-phân-hệ-chức-năng-trên-dashboard)
   - [Thanh điều hướng WORKSPACE](#thanh-điều-hướng-workspace)
   - [Phân hệ 1: Tổng quan (Overview)](#phân-hệ-1-tổng-quan-overview)
   - [Phân hệ 2: SPC từng công đoạn / loại lỗi (Defect Detail E1 – E8)](#phân-hệ-2-spc-từng-công-đoạn--loại-lỗi-defect-detail-e1--e8)
   - [Phân hệ 3: Nhật ký kiểm toán (Log & Audit Trail)](#phân-hệ-3-nhật-ký-kiểm-toán-log--audit-trail)
   - [Phân hệ 4: Trình chỉnh sửa dữ liệu SPC trực quan (Data Editor)](#phân-hệ-4-trình-chỉnh-sửa-dữ-liệu-spc-trực-quan-data-editor)
   - [Trình giả lập dữ liệu ảo (Virtual Data Simulator)](#trình-giả-lập-dữ-liệu-ảo-virtual-data-simulator)
4. [Động cơ toán học SPC & 8 quy tắc Nelson](#4-động-cơ-toán-học-spc--8-quy-tắc-nelson)
   - [Hằng số Shewhart ($n = 10$)](#hằng-số-shewhart-n--10)
   - [Công thức biểu đồ $\bar{X} - R$](#công-thức-biểu-đồ-barx---r)
   - [Chỉ số năng lực quy trình ($C_p, C_{pk}$)](#chỉ-số-năng-lực-quy-trình-c_p-c_pk)
   - [Tiêu chuẩn đánh giá 8 quy tắc Nelson](#tiêu-chuẩn-đánh-giá-8-quy-tắc-nelson)
5. [Cấu trúc dữ liệu Excel đầu vào (`ER_TABLE.xlsx`)](#5-cấu-trúc-dữ-liệu-excel-đầu-vào-er_tablexlsx)
6. [Tài liệu REST API & WebSocket](#6-tài-liệu-rest-api--websocket)
7. [Yêu cầu hệ thống & Hướng dẫn cài đặt](#7-yêu-cầu-hệ-thống--hướng-dẫn-cài-đặt)
   - [Chạy nhanh bằng `run.bat` (Khuyến nghị)](#chạy-nhanh-bằng-runbat-khuyến-nghị)
   - [Chạy từ môi trường Python ảo (.venv)](#chạy-từ-môi-trường-python-ảo-venv)
   - [Đóng gói thành tệp thực thi độc lập (`build.bat`)](#đóng-gói-thành-tệp-thực-thi-độc-lập-buildbat)
8. [Bảo mật & Quyền riêng tư dữ liệu](#8-bảo-mật--quyền-riêng-tư-dữ-liệu)
9. [Khắc phục sự cố thường gặp (Troubleshooting)](#9-khắc-phục-sự-cố-thường-gặp-troubleshooting)
10. [Câu hỏi thường gặp (FAQ)](#10-câu-hỏi-thường-gặp-faq)

---

## 1. Điểm nổi bật của hệ thống

- ⚡ **Thiết kế giao diện Axon SaaS hiện đại (100vh No-Scroll):** Toàn bộ giao diện vừa vặn trong một khung hình duy nhất, tối ưu cho màn hình giám sát công nghiệp, phòng điều hành trung tâm và laptop kỹ sư mà không cần cuộn trang.
- 🎨 **Bảng màu ấm Axon & Phông chữ Geist:** Nền trắng sạch (`#FFFFFF`), sidebar xám mềm (`#F6F6F6`), đường viền sắc nét (`#E5E7EB`), chữ tương phản cao (`#111827`), điểm nhấn màu cảnh báo thương hiệu Coral 600 (`#D93111`), Peach (`#FF9A6B`) và Periwinkle (`#C3BDFF`).
- 📊 **Bộ biểu đồ kiểm soát toàn diện:** Biểu đồ tương quan đa trục Cpk vs OOS%, cặp biểu đồ kiểm soát $\bar{X} - R$ chuẩn Shewhart, và biểu đồ phân phối xác suất Histogram tích hợp đường cong chuẩn Gauss (Bell Curve).
- 🧠 **Tự động rà soát 8 quy tắc Nelson (Nelson Rules 1–8):** Tự động phát hiện điểm đột biến ngoài $3\sigma$, chuỗi xu hướng dồn về một phía đường tâm, xu hướng tăng/giảm đơn điệu, hiện tượng phân tầng và hỗn hợp.
- ✏️ **Trình chỉnh sửa dữ liệu SPC tương tác (Interactive Data Editor):** Cho phép sửa trực tiếp quy chuẩn LSL/USL và từng giá trị mẫu đo $X_1 \rightarrow X_{10}$. Tự động tính toán lại tức thì $\bar{X}, R, C_{pk}$, tô màu cảnh báo vi phạm quy chuẩn mà **tuyệt đối không làm thay đổi hay hỏng workbook Excel gốc**.
- 🔄 **Đồng bộ thời gian thực qua WebSocket:** Cập nhật thông số tức thời khi có dữ liệu mới từ máy móc, bộ mô phỏng hoặc thao tác chỉnh sửa.
- 🛡️ **100% Hoạt động Offline & Bảo mật nội bộ:** Máy chủ chỉ lắng nghe trên mạng nội bộ máy trạm `127.0.0.1:8000`, không truyền tải bất kỳ dữ liệu sản xuất nào ra ngoài Internet.

---

## 2. Kiến trúc hệ thống & Cấu trúc thư mục

Hệ thống được thiết kế theo kiến trúc **Clean Architecture & Module hóa phân tầng**:

```text
HTA/
├── core/                           # Tầng nghiệp vụ lõi & xử lý dữ liệu SPC
│   ├── __init__.py                 # Export các interface lõi
│   ├── config.py                   # Cấu hình đường dẫn, hằng số Shewhart, logging tập trung
│   ├── spc_calculator.py           # Động cơ toán học SPC thuần túy (X-bar, R, Cp, Cpk, 8 Nelson Rules, OOS)
│   ├── data_loader.py              # I/O đọc ER_TABLE.xlsx, cơ chế ghi đè user_edits.json và ghép dữ liệu
│   ├── cache_manager.py            # Quản lý bộ đệm In-memory Cache & cơ chế TTL (5.0s) / làm mới
│   ├── websocket_manager.py        # Quản lý kết nối WebSocket thời gian thực (ConnectionManager)
│   └── simulator.py                # Động cơ tạo mẫu đo ảo ngẫu nhiên có kiểm soát
│
├── api/                            # Tầng định tuyến & giao tiếp mạng
│   ├── __init__.py
│   └── routes.py                   # REST endpoints (/api/spc, /api/editor/*, /api/simulator/*) & WebSocket
│
├── css/                            # Định kiểu giao diện Axon SaaS & tối ưu hiển thị công nghiệp
│   └── spc-modern.css              # Hệ thống biến CSS variables, bảng màu Axon, Geist typography, 100vh layout
│
├── js/                             # Logic xử lý giao diện phía máy khách (Client Application)
│   ├── app.js                      # Điều phối giao diện, biểu đồ Chart.js, WebSocket và Data Editor
│   └── initial-data.js             # Dữ liệu dự phòng khởi tạo nhanh
│
├── lib/                            # Thư viện client bên thứ ba
│   ├── chart.js                    # Thư viện vẽ biểu đồ Canvas
│   ├── jquery.min.js               # Tiện ích DOM
│   └── bootstrap/                  # Bộ khung tiện ích bổ trợ
│
├── template/                       # Tầng giao diện người dùng
│   └── index.html                  # Giao diện chính 100vh tích hợp 4 phân hệ WORKSPACE
│
├── docs/                           # Tài liệu thiết kế kỹ thuật
│   ├── architecture.md             # Sơ đồ kiến trúc phân tầng chi tiết
│   ├── api_reference.md            # Đặc tả chi tiết các REST & WebSocket endpoints
│   └── virtual-data-simulator.md   # Hướng dẫn chi tiết bộ sinh dữ liệu ảo
│
├── ER_TABLE.xlsx                   # Workbook Excel dữ liệu gốc gồm 8 sheet loại lỗi kỹ thuật
├── user_edits.json                 # Lớp lưu trữ ghi đè tùy biến của người dùng từ Data Editor
├── main.py                         # Điểm lắp ráp ứng dụng FastAPI, middleware và static files
├── launcher.py                     # Quản lý vòng đời khởi chạy máy chủ, mở trình duyệt tự động
├── simulator.py                    # CLI entry point cho bộ mô phỏng
├── run.bat                         # Kịch bản khởi chạy ứng dụng 1-click trên Windows
├── build.bat                       # Kịch bản đóng gói ứng dụng thành file thực thi độc lập (.exe)
├── HTA.spec                        # Cấu hình đóng gói PyInstaller
├── requirements.txt                # Danh mục các thư viện Python phụ thuộc
└── pyproject.toml                  # Khai báo cấu hình dự án Python
```

---

## 3. Các phân hệ chức năng trên Dashboard

### Thanh điều hướng WORKSPACE
Thanh điều hướng bên trái được tinh gọn theo chuẩn Axon, gom tất cả chức năng quản trị và điều hành dưới một nhóm duy nhất:
- **Tổng quan (Overview):** Giám sát toàn cảnh chất lượng 8 công đoạn.
- **SPC từng lỗi:** Danh mục mở rộng liệt kê 8 loại lỗi kỹ thuật (`E1` đến `E8`). Từng mục được trang bị đèn LED trạng thái màu (🔴 Nguy hiểm / 🟡 Cảnh báo / 🟢 Ổn định) với cơ chế chống tràn văn bản thông minh.
- **Nhật ký (Audit Trail):** Lịch sử phát hiện vi phạm và cảnh báo thống kê.
- **Chỉnh sửa (Data Editor):** Trình biên tập dữ liệu đo lường trực tiếp.

---

### Phân hệ 1: Tổng quan (Overview)
Cung cấp góc nhìn điều hành cấp cao nhất (Executive View) về tình trạng toàn bộ dây chuyền sản xuất:
1. **4 Thẻ chỉ số chất lượng chính (Top KPI Cards):**
   - **Trạng thái hệ thống:** Đánh giá tổng quát (NGUY HIỂM / CẢNH BÁO / ỔN ĐỊNH).
   - **Tổng lỗi kích hoạt:** Tỷ lệ công đoạn cần can thiệp kỹ thuật ngay lập tức.
   - **Tỷ lệ khuyết tật:** Tỷ lệ phần trăm tổng số mẫu đo vượt ngoài giới hạn quy chuẩn (OOS%).
   - **Lỗi phổ biến nhất:** Xác định công đoạn có tỷ lệ phế phẩm hoặc vi phạm cao nhất để ưu tiên khắc phục.
2. **Biểu đồ xu hướng kiểm soát SPC:**
   - Hỗ trợ 3 chế độ xem: **Cpk & OOS%** (Trục kép kết hợp năng lực và phế phẩm), **Trạng thái** (Phân bổ mức độ an toàn), và **Tỷ trọng** (Tỷ lệ đóng góp lỗi).
   - Tích hợp đường tham chiếu chuẩn quốc tế $C_{pk} = 1.33$.
   - Tính năng **Crosshair Guide** (đường gióng thẳng đứng thông minh) khi di chuột qua các điểm dữ liệu.
3. **Bảng cảnh báo vi phạm thống kê (OOC Alerts):**
   - Tự động thống kê số lượng vi phạm quy chuẩn và vi phạm 8 quy tắc Nelson trên toàn bộ các công đoạn theo thời gian thực.

---

### Phân hệ 2: SPC từng công đoạn / loại lỗi (Defect Detail E1 – E8)
Phân tích sâu tình trạng kỹ thuật của từng công đoạn cụ thể:
1. **4 Thẻ thông số kỹ thuật then chốt:**
   - **USL (Upper Specification Limit):** Giới hạn quy chuẩn trên.
   - **LSL (Lower Specification Limit):** Giới hạn quy chuẩn dưới.
   - **UCL & LCL:** Giới hạn kiểm soát trên và dưới Shewhart 3-sigma.
   - **CL (Center Line):** Đường tâm trung bình quá trình ($\bar{\bar{X}}$).
2. **Bộ 3 Tab phân tích chuyên sâu:**
   - **Tab 1 - Biểu đồ $\bar{X} - R$:** Theo dõi đồng thời độ ổn định của giá trị trung bình nhóm ($\bar{X}$) và độ phân tán của quá trình ($R$). Đánh dấu rõ ràng các điểm vi phạm đường giới hạn kiểm soát $UCL/LCL$.
   - **Tab 2 - Phân phối chuẩn (Histogram & Gaussian Curve):** Biểu đồ tần suất nhóm đo kết hợp đường cong phân phối chuẩn Bell Curve. Trực quan hóa độ lệch tâm của quá trình so với khoảng quy chuẩn $[LSL, USL]$ để đánh giá độ chụm và độ lệch chuẩn $\hat{\sigma}$.
   - **Tab 3 - Dữ liệu đo theo lô:** Bảng dữ liệu chi tiết của từng lô gồm Mã lô, Thời gian, 10 giá trị đo $X_1 \rightarrow X_{10}$, Giá trị trung bình $\bar{X}$, Khoảng biến thiên $R$ và số mẫu OOS.
3. **Nhật ký vi phạm của công đoạn:** Liệt kê chi tiết từng lô bị đánh dấu cảnh báo kèm lý do vi phạm (vượt $UCL/LCL$ hoặc vi phạm quy tắc chuỗi Nelson).

---

### Phân hệ 3: Nhật ký kiểm toán (Log & Audit Trail)
- Lưu vết toàn diện mọi sự kiện vi phạm trên toàn hệ thống sản xuất.
- Hiển thị rõ: Thời gian ghi nhận, Mã công đoạn, Tên lỗi kỹ thuật, Giá trị đo vi phạm, Giới hạn kiểm soát liên quan và Quy tắc SPC bị kích hoạt.
- Tích hợp ô tìm kiếm và lọc dữ liệu nhanh theo từ khóa hoặc mức độ nghiêm trọng.

---

### Phân hệ 4: Trình chỉnh sửa dữ liệu SPC trực quan (Data Editor)
*Tính năng cao cấp cho phép kỹ sư chất lượng kiểm tra giả định (What-If Analysis) và hiệu chỉnh số liệu đo đạc:*

- **Lựa chọn công đoạn:** Dropdown chuyển đổi tức thời giữa các loại lỗi từ `E1` đến `E8`.
- **Tùy chỉnh thông số kỹ thuật:** Cho phép sửa đổi trực tiếp:
  - Tên công đoạn / loại lỗi.
  - Giới hạn quy chuẩn dưới ($LSL$).
  - Giới hạn quy chuẩn trên ($USL$).
- **Bảng biên tập mẫu đo $X_1 \rightarrow X_{10}$:**
  - Nhập liệu và chỉnh sửa trực tiếp trên từng ô mẫu đo của từng lô sản xuất.
  - **Tự động nhận diện OOS:** Ô số liệu nào vượt ra ngoài khoảng $[LSL, USL]$ sẽ lập tức được tô đỏ nổi bật.
  - **Tính toán thời gian thực:** Giá trị $\bar{X}$ (Trung bình nhóm) và $R$ (Biên độ dao động) tự động nhảy số tính toán lại ngay khi người dùng gõ phím.
- **Thao tác lô linh hoạt:**
  - `+ Thêm lô mới`: Chèn nhanh một hàng lô sản xuất mới vào đầu bảng để nhập dữ liệu đo đạc mới.
  - `✕ Xóa lô`: Xóa bỏ các lô đo nghi ngờ có sai số thao tác hoặc mẫu đo không hợp lệ.
- **Lưu trữ & Bảo vệ dữ liệu gốc:**
  - `💾 Lưu thay đổi`: Ghi nhận dữ liệu vào tệp cấu hình ghi đè `user_edits.json`. Hệ thống lập tức kích hoạt động cơ tính toán lại toàn bộ chỉ số $C_{pk}, UCL, LCL, OOS\%$ và 8 quy tắc Nelson, đồng thời cập nhật tức thời lên Dashboard.
  - `↺ Khôi phục gốc`: Khôi phục 100% dữ liệu nguyên bản từ tệp Excel `ER_TABLE.xlsx`, xóa bỏ toàn bộ can thiệp ghi đè của công đoạn đó chỉ bằng một cú nhấp chuột.
  - **Cam kết an toàn:** Tệp Excel gốc `ER_TABLE.xlsx` không bao giờ bị chỉnh sửa hoặc ghi đè.

---

### Trình giả lập dữ liệu ảo (Virtual Data Simulator)
- Tích hợp nút bấm **Giả lập đầu vào** ngay trên góc phải header.
- Khi kích hoạt, trình giả lập sẽ liên tục phát sinh các lô sản xuất ảo theo chu kỳ (mỗi 60 giây) dựa trên phân phối thống kê thực tế kèm nhiễu ngẫu nhiên.
- Dữ liệu ảo được cô lập trong cơ sở dữ liệu SQLite tạm thời và sẽ được **tự động dọn sạch hoàn toàn** ngay khi người dùng nhấn dừng hoặc tắt ứng dụng.

---

## 4. Động cơ toán học SPC & 8 quy tắc Nelson

### Hằng số Shewhart ($n = 10$)
Đối với cỡ mẫu nhóm con cố định $n = 10$, hệ thống áp dụng các hệ số tiêu chuẩn quốc tế:
$$A_2 = 0.308 \quad | \quad D_3 = 0.223 \quad | \quad D_4 = 1.777 \quad | \quad d_2 = 3.078$$

### Công thức biểu đồ $\bar{X} - R$

1. **Giá trị trung bình của từng nhóm con ($i$):**
   $$\bar{X}_i = \frac{1}{n} \sum_{j=1}^{n} X_{i,j}$$

2. **Khoảng biến thiên của từng nhóm con ($i$):**
   $$R_i = \max(X_{i,1 \dots n}) - \min(X_{i,1 \dots n})$$

3. **Đường tâm trung bình ($\bar{\bar{X}}$ và $\bar{R}$):**
   $$\bar{\bar{X}} = \frac{1}{k} \sum_{i=1}^{k} \bar{X}_i \qquad ; \qquad \bar{R} = \frac{1}{k} \sum_{i=1}^{k} R_i$$
   *(trong đó $k$ là tổng số lô đo lường hợp lệ)*

4. **Giới hạn kiểm soát biểu đồ $\bar{X}$:**
   $$UCL_{\bar{X}} = \bar{\bar{X}} + A_2 \bar{R} \qquad ; \qquad CL_{\bar{X}} = \bar{\bar{X}} \qquad ; \qquad LCL_{\bar{X}} = \bar{\bar{X}} - A_2 \bar{R}$$

5. **Giới hạn kiểm soát biểu đồ $R$:**
   $$UCL_R = D_4 \bar{R} \qquad ; \qquad CL_R = \bar{R} \qquad ; \qquad LCL_R = D_3 \bar{R}$$

6. **Độ lệch chuẩn ước lượng của quá trình ($\hat{\sigma}$):**
   $$\hat{\sigma} = \frac{\bar{R}}{d_2} = \frac{\bar{R}}{3.078}$$

---

### Chỉ số năng lực quy trình ($C_p, C_{pk}$)

- **Chỉ số năng lực tiềm năng ($C_p$):**
  $$C_p = \frac{USL - LSL}{6\hat{\sigma}}$$

- **Chỉ số năng lực thực tế có xét độ lệch tâm ($C_{pk}$):**
  $$C_{pu} = \frac{USL - \bar{\bar{X}}}{3\hat{\sigma}} \qquad ; \qquad C_{pl} = \frac{\bar{\bar{X}} - LSL}{3\hat{\sigma}}$$
  $$C_{pk} = \min(C_{pu}, C_{pl})$$

- **Bảng đánh giá mức độ hoàn thiện của quy trình:**
  | Giá trị $C_{pk}$ | Đánh giá năng lực | Trạng thái hệ thống | Hành động yêu cầu |
  | :--- | :--- | :--- | :--- |
  | **$C_{pk} \ge 1.33$** | Đạt năng lực tốt (Capable & Stable) | 🟢 Ổn định (SUCCESS) | Tiếp tục duy trì kiểm soát thông thường. |
  | **$1.00 \le C_{pk} < 1.33$** | Năng lực chấp nhận được nhưng cận biên | 🟡 Cảnh báo (WARNING) | Cần theo dõi chặt chẽ, tối ưu hóa thông số. |
  | **$C_{pk} < 1.00$** | Quy trình không đủ năng lực (Incapable) | 🔴 Nguy hiểm (DANGER) | Dừng dây chuyền kiểm tra, loại bỏ nguyên nhân đặc biệt. |

---

### Tiêu chuẩn đánh giá 8 quy tắc Nelson
Hệ thống tích hợp thuật toán tự động quét 8 quy tắc vi phạm thống kê Nelson:

| Quy tắc | Tên gọi | Mô tả điều kiện vi phạm | Ý nghĩa thực tế |
| :---: | :--- | :--- | :--- |
| **Rule 1** | Outlier $3\sigma$ | 1 điểm nằm ngoài vùng $3\sigma$ (vượt $UCL$ hoặc $LCL$) | Có biến động đột biến nghiêm trọng (gãy dao, sai nguyên liệu). |
| **Rule 2** | Shift (Dịch tâm) | 9 điểm (hoặc $\ge 7$ điểm) liên tiếp cùng nằm về một phía đường tâm $CL$ | Đường tâm quá trình đã bị dịch chuyển vị trí thiết lập. |
| **Rule 3** | Trend (Xu hướng) | 6 điểm liên tiếp tăng dần hoặc giảm dần liên tục | Có hiện tượng mài mòn dụng cụ, suy giảm nhiệt độ hoặc hao mòn cơ khí. |
| **Rule 4** | Alternating (Dao động) | 14 điểm liên tiếp dao động lên xuống xen kẽ hình răng cưa | Hiện tượng quá điều chỉnh (over-control) hoặc sai lệch giữa 2 ca kíp. |
| **Rule 5** | Zone A ($2\sigma$) | 2 trong 3 điểm liên tiếp nằm trong vùng Zone A ($> 2\sigma$) về cùng một phía | Cảnh báo sớm xu hướng mất kiểm soát trước khi vượt ngưỡng $3\sigma$. |
| **Rule 6** | Zone B ($1\sigma$) | 4 trong 5 điểm liên tiếp nằm trong vùng Zone B ($> 1\sigma$) về cùng một phía | Dấu hiệu dịch chuyển tâm nhẹ hoặc biến thiên gia tăng. |
| **Rule 7** | Stratification (Phân tầng) | 15 điểm liên tiếp nằm ép chặt bên trong vùng Zone C ($< 1\sigma$) hai bên đường tâm | Dữ liệu bị gộp từ nhiều nguồn hoặc cỡ mẫu không đồng nhất. |
| **Rule 8** | Mixture (Hỗn hợp) | 8 điểm liên tiếp nằm hai bên đường tâm nhưng không có điểm nào trong Zone C | Quá trình nhận mẫu từ hai dây chuyền/khuôn khác nhau. |

---

## 5. Cấu trúc dữ liệu Excel đầu vào (`ER_TABLE.xlsx`)

Tệp `ER_TABLE.xlsx` đặt tại thư mục gốc của dự án. Mỗi sheet tương ứng với một công đoạn / loại lỗi (Sheet 1 đến Sheet 8) với cấu trúc chuẩn:

```text
Hàng 1: [A1: Tên loại lỗi / Tên công đoạn kỹ thuật]
Hàng 2: [B2: Giá trị LSL]  |  [C2: Giá trị USL]
Hàng 3-4: [Dòng trống hoặc ghi chú kỹ thuật]
Hàng 5: [Tiêu đề cột]: ID | TIME | X1 | X2 | X3 | X4 | X5 | X6 | X7 | X8 | X9 | X10
Hàng 6+: [Dữ liệu đo từng lô sản xuất]
```

**Quy tắc hợp lệ:**
- Các cột mẫu đo từ `X1` đến `X10` phải chứa giá trị số (hỗ trợ cả dấu chấm `.` và dấu phẩy `,`).
- Mỗi lô cần tối thiểu 2 mẫu hợp lệ để tính toán giá trị trung bình $\bar{X}$ và khoảng biến thiên $R$.

---

## 6. Tài liệu REST API & WebSocket

Tất cả các endpoint hoạt động ở tiền tố `/api` trên máy chủ cục bộ:

### Nhóm API phân tích SPC
- **`GET /api/spc`**
  - Trả về toàn bộ dữ liệu tổng quan, thống kê 8 loại lỗi, các giới hạn $UCL/CL/LCL$, chỉ số $C_p, C_{pk}$, danh sách lô đo và lịch sử vi phạm.
  - Phản hồi mẫu:
    ```json
    {
      "summary": { "totalDefectTypes": 8, "dangerCount": 7, "warningCount": 0, "successCount": 1 },
      "defects": [
        {
          "id": "defect_1",
          "errorName": "LỆCH CUỘN VẢI",
          "lsl": 0.05,
          "usl": 0.25,
          "cpk": 0.82,
          "status": "DANGER",
          "ucl": 0.198,
          "lcl": 0.122,
          "cl": 0.160
        }
      ]
    }
    ```

### Nhóm API Trình biên tập dữ liệu (Data Editor)
- **`GET /api/editor/data`**
  - Trả về danh sách chi tiết cả 8 công đoạn kèm cấu hình ($LSL, USL$) và toàn bộ danh sách mẫu đo ($X_1 \rightarrow X_{10}$) phục vụ giao diện biên tập.
- **`POST /api/editor/save`**
  - Lưu trữ thay đổi số đo hoặc giới hạn kỹ thuật của một công đoạn.
  - Payload:
    ```json
    {
      "defectId": "defect_1",
      "errorName": "LỆCH CUỘN VẢI (ĐÃ CHỈNH)",
      "lsl": 0.06,
      "usl": 0.26,
      "batches": [
        { "ID": "LOT-001", "TIME": "08:00:00", "X1": 0.15, "X2": 0.16, "X3": 0.15, ... }
      ]
    }
    ```
- **`POST /api/editor/reset`**
  - Hoàn tác mọi thay đổi tùy biến và khôi phục dữ liệu gốc từ file Excel cho công đoạn được chỉ định.
  - Payload: `{"defectId": "defect_1"}`

### Nhóm API Giả lập dữ liệu ảo
- **`GET /api/simulator/status`**: Trạng thái bộ giả lập (`isRunning`, `totalVirtualBatches`).
- **`POST /api/simulator/start`**: Khởi chạy tiến trình sinh dữ liệu đo ảo.
- **`POST /api/simulator/stop`**: Dừng tiến trình và dọn dẹp sạch sẽ cơ sở dữ liệu SQLite ảo.

### WebSocket Kênh thời gian thực
- **`WS /ws/dashboard`**
  - Kết nối truyền tải sự kiện hai chiều. Tự động đẩy dữ liệu SPC mới nhất tới giao diện ngay khi có thay đổi dữ liệu hoặc nhịp đập giả lập định kỳ.

---

## 7. Yêu cầu hệ thống & Hướng dẫn cài đặt

### Yêu cầu tiên quyết:
- **Hệ điều hành:** Windows 10 / Windows 11 (64-bit).
- **Python:** Phiên bản 3.10 đến 3.13 (nếu chạy từ mã nguồn).
- **Trình duyệt khuyến nghị:** Google Chrome, Microsoft Edge, Brave, Firefox phiên bản hiện đại.

---

### Chạy nhanh bằng `run.bat` (Khuyến nghị)
Đây là phương pháp thuận tiện nhất cho người dùng và kỹ sư:

1. Tải hoặc giải nén mã nguồn dự án vào thư mục trên máy tính (ví dụ: `D:\HTA`).
2. Nhấp đúp chuột vào tệp **`run.bat`**.
3. Kịch bản sẽ tự động:
   - Tạo môi trường ảo Python `.venv` nếu chưa có.
   - Cài đặt đầy đủ các thư viện từ `requirements.txt`.
   - Khởi động máy chủ dịch vụ FastAPI.
   - Tự động mở trình duyệt web đến địa chỉ `http://127.0.0.1:8000`.
4. Giữ nguyên cửa sổ đen (Console) trong suốt quá trình làm việc. Khi muốn tắt ứng dụng, chỉ cần đóng cửa sổ console hoặc nhấn `Ctrl + C`.

---

### Chạy từ môi trường Python ảo (.venv)
Dành cho lập trình viên muốn chạy bằng dòng lệnh PowerShell / Command Prompt:

```powershell
# 1. Kích hoạt môi trường ảo
.\.venv\Scripts\Activate.ps1

# 2. Cài đặt thư viện phụ thuộc (nếu chưa cài)
pip install -r requirements.txt

# 3. Khởi chạy máy chủ FastAPI qua Uvicorn
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

---

### Đóng gói thành tệp thực thi độc lập (`build.bat`)
Để phân phối phần mềm cho máy tính người dùng **không có cài sẵn Python**:

1. Chạy tệp **`build.bat`**.
2. Quá trình PyInstaller sẽ đóng gói toàn bộ mã nguồn, máy chủ và tài nguyên tĩnh vào thư mục `dist\HTA`.
3. Khi phân phối, chỉ cần sao chép **toàn bộ thư mục `dist\HTA`** sang máy tính khác và nhấp đúp tệp **`HTA.exe`** để chạy trực tiếp.

---

## 8. Bảo mật & Quyền riêng tư dữ liệu

- 🔒 **Chế độ Ngoại tuyến 100% (Air-Gapped / Offline):** Toàn bộ dữ liệu sản xuất, công thức tính toán và lưu vết chỉ hoạt động trên bộ nhớ máy tính cục bộ.
- 🚫 **Không rò rỉ dữ liệu:** Hệ thống không gửi bất kỳ gói tin nào ra máy chủ bên ngoài hay dịch vụ đám mây công cộng.
- 🛡️ **Bảo vệ toàn vẹn nguồn dữ liệu:** Mọi thao tác chỉnh sửa hoặc chạy mô phỏng đều được ghi nhận vào các tầng trung gian riêng biệt (`user_edits.json` hoặc SQLite tạm). Tệp Excel chuẩn của nhà máy `ER_TABLE.xlsx` luôn được bảo vệ an toàn tuyệt đối.

Nếu cổng mạng mặc định `8000` bị trùng lặp với phần mềm khác, bạn có thể dễ dàng đổi sang cổng mới thông qua biến môi trường:
```cmd
set HTA_PORT=8080
run.bat
```

---

## 9. Khắc phục sự cố thường gặp (Troubleshooting)

| Tình trạng sự cố | Nguyên nhân khả dĩ | Cách xử lý dứt điểm |
| :--- | :--- | :--- |
| **Cửa sổ báo lỗi "Port 8000 is already in use"** | Có một tiến trình HTA cũ đang chạy ngầm hoặc phần mềm khác chiếm cổng 8000 | Mở Task Manager tìm và kết thúc tiến trình `python.exe` / `HTA.exe`, hoặc đổi cổng bằng lệnh `set HTA_PORT=8088` rồi chạy lại `run.bat`. |
| **Giao diện không hiển thị biểu đồ sau khi cập nhật mã nguồn** | Trình duyệt lưu cache JavaScript hoặc CSS cũ | Nhấn tổ hợp phím **`Ctrl + F5`** (hoặc `Shift + F5`) trên trình duyệt để nạp lại toàn bộ mã mới. |
| **Một công đoạn báo trạng thái "Chưa có dữ liệu"** | Cấu hình ô LSL/USL tại hàng 2 hoặc dòng tiêu đề tại hàng 5 trong sheet Excel sai tên | Mở `ER_TABLE.xlsx`, kiểm tra lại sheet tương ứng đảm bảo ô B2 là số LSL, C2 là số USL và hàng 5 có các cột từ `X1` đến `X10`. |
| **Tên công đoạn dài làm che mất chấm trạng thái** | Lỗi hiển thị CSS trên các phiên bản trình duyệt cũ | Hệ thống đã xử lý bằng cơ chế flexbox `min-width: 0` và `flex-shrink: 0`. Hãy nhấn `Ctrl + F5` để cập nhật CSS mới nhất. |

---

## 10. Câu hỏi thường gặp (FAQ)

**Q1: Chỉnh sửa dữ liệu trong tab "Chỉnh sửa" có làm mất dữ liệu trong file Excel không?**  
*Trả lời:* **Hoàn toàn không.** Dữ liệu chỉnh sửa được lưu độc lập tại tệp `user_edits.json`. Bất kỳ lúc nào bạn cũng có thể nhấn nút **"Khôi phục gốc"** để xóa bỏ tùy biến và trở về dữ liệu gốc từ Excel.

**Q2: Tại sao biểu đồ $R$ có đường giới hạn dưới $LCL_R$ bằng 0 hoặc không hiển thị?**  
*Trả lời:* Với cỡ nhóm mẫu $n = 10$, hệ số Shewhart $D_3 = 0.223 > 0$, do đó $LCL_R = 0.223 \times \bar{R} > 0$. Tuy nhiên với các công đoạn có cỡ mẫu $n \le 6$, $D_3 = 0$ nên $LCL_R$ theo quy chuẩn thống kê Shewhart luôn bằng 0.

**Q3: Tôi có thể thêm nhiều hơn 8 loại lỗi không?**  
*Trả lời:* Hoàn toàn có thể. Bạn chỉ cần tạo thêm các Sheet mới trong `ER_TABLE.xlsx` tuân theo đúng cấu trúc tiêu chuẩn (Hàng 1: Tên lỗi, Hàng 2: LSL/USL, Hàng 5: Tiêu đề X1..X10). Hệ thống sẽ tự động đọc và tính toán cho các sheet mới.

---

*Phát triển bởi đội ngũ Kỹ thuật Chất lượng & Tự động hóa SPC Intelligent.*  
*Phiên bản: 2.2.0 - Ngôn ngữ giao diện: Tiếng Việt - Chuẩn hiển thị: Axon SaaS Geist.*
