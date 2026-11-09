# HTA - Dashboard giám sát chất lượng SPC

HTA là ứng dụng dashboard chạy trên máy tính Windows, dùng để theo dõi dữ liệu kiểm soát chất lượng theo phương pháp **SPC (Statistical Process Control)**. Ứng dụng đọc dữ liệu từ workbook Excel, tính các chỉ số và biểu đồ cho từng loại lỗi, hiển thị cảnh báo theo thời gian thực, đồng thời tích hợp trình giả lập dữ liệu ảo để kiểm thử và theo dõi phản ứng của hệ thống.

---

## Mục lục

- [Tổng quan cách hoạt động](#tổng-quan-cách-hoạt-động)
- [Kiến trúc hệ thống & Cấu trúc thư mục](#kiến-trúc-hệ-thống--cấu-trúc-thư-mục)
- [Yêu cầu sử dụng](#yêu-cầu-sử-dụng)
- [Chạy ứng dụng từ mã nguồn](#chạy-ứng-dụng-từ-mã-nguồn)
- [Chạy bản đã đóng gói](#chạy-bản-đã-đóng-gói)
- [Sử dụng dashboard](#sử-dụng-dashboard)
- [Ý nghĩa các chỉ số và trạng thái](#ý-nghĩa-các-chỉ-số-và-trạng-thái)
- [Dữ liệu Excel đầu vào](#dữ-liệu-excel-đầu-vào)
- [Dữ liệu mô phỏng](#dữ-liệu-mô-phỏng)
- [Dữ liệu và quyền riêng tư](#dữ-liệu-và-quyền-riêng-tư)
- [Khắc phục sự cố](#khắc-phục-sự-cố)
- [Câu hỏi thường gặp](#câu-hỏi-thường-gặp)

---

## Tổng quan cách hoạt động

Ứng dụng vận hành theo luồng tự động và bảo toàn dữ liệu:

1. Người dùng chạy ứng dụng bằng `run.bat` hoặc tệp đóng gói `HTA.exe`.
2. HTA khởi động máy chủ FastAPI cục bộ (`127.0.0.1`) và tự động mở trang dashboard trên trình duyệt mặc định.
3. Tầng dữ liệu đọc từng sheet trong `ER_TABLE.xlsx`, trích xuất tên loại lỗi, giới hạn quy chuẩn kỹ thuật (LSL/USL) và các nhóm mẫu đo lường ($X_1 \rightarrow X_{10}$).
4. Động cơ tính toán SPC làm sạch số liệu, tính các giá trị trung bình, khoảng biến thiên, giới hạn kiểm soát ($UCL/CL/LCL$), chỉ số năng lực quá trình ($C_p, C_{pk}$), và quét các quy tắc vi phạm (run rules).
5. Kết quả được lưu đệm trong cache bộ nhớ (TTL = 5 giây) và phân phối tới giao diện qua REST API và kênh WebSocket thời gian thực.
6. Nếu người dùng bật mô phỏng, các lô ảo được sinh và lưu tạm trong SQLite, ghép với dữ liệu thật trong bộ nhớ để tính toán lại. **Tệp workbook Excel gốc hoàn toàn không bị chỉnh sửa hay ghi đè.**

Dashboard được thiết kế để giám sát trên máy trạm nội bộ, mặc định lắng nghe loopback `127.0.0.1`, đảm bảo bảo mật và tốc độ phản hồi tức thời.

---

## Kiến trúc hệ thống & Cấu trúc thư mục

Hệ thống được thiết kế theo kiến trúc module hóa phân tầng (Clean Architecture & Single Responsibility Principle), tách bạch rõ ràng giữa nghiệp vụ tính toán, truy xuất dữ liệu, định tuyến mạng và giao diện:

```text
HTA/
├── core/                           # Tầng nghiệp vụ lõi & xử lý dữ liệu
│   ├── __init__.py
│   ├── config.py                   # Cấu hình đường dẫn, logging, hằng số Shewhart (A2, D3, D4, d2)
│   ├── spc_calculator.py           # Động cơ toán học SPC thuần túy (X-bar, R, P, C, Cp/Cpk, Run Rules, OOS)
│   ├── data_loader.py              # I/O đọc ER_TABLE.xlsx, truy vấn lô ảo SQLite và ghép dữ liệu
│   ├── cache_manager.py            # Quản lý bộ đệm In-memory Cache & cơ chế TTL / làm mới
│   ├── websocket_manager.py        # Quản lý vòng đời kết nối WebSocket (ConnectionManager)
│   └── simulator.py                # Động cơ mô phỏng sinh dữ liệu đo lường ảo định kỳ
│
├── api/                            # Tầng giao tiếp mạng & định tuyến
│   ├── __init__.py
│   └── routes.py                   # Định tuyến REST (/api/spc, /api/simulator/*) & WebSocket (/ws/dashboard)
│
├── css/                            # Định kiểu giao diện hiện đại, phẳng, tối ưu hiển thị
├── js/                             # Logic xử lý giao diện client (app.js, initial-data.js)
├── lib/                            # Thư viện client bên thứ ba (Chart.js, jQuery, Bootstrap)
├── template/                       # Template HTML giao diện chính (index.html)
├── docs/                           # Tài liệu kiến trúc, API và trình giả lập
│   ├── architecture.md             # Sơ đồ kiến trúc phân tầng chi tiết
│   ├── api_reference.md            # Tài liệu tham chiếu REST & WebSocket API
│   └── virtual-data-simulator.md   # Hướng dẫn chi tiết bộ nạp dữ liệu ảo
│
├── main.py                         # Điểm lắp ráp ứng dụng FastAPI, middleware và static files
├── simulator.py                    # CLI entry point cho bộ mô phỏng dữ liệu ảo
├── launcher.py                     # Quản lý khởi chạy máy chủ, mở trình duyệt và dọn dẹp khi thoát
│
├── ER_TABLE.xlsx                   # Bảng tính Excel dữ liệu gốc gồm 8 sheet loại lỗi
├── run.bat                         # Kịch bản khởi chạy ứng dụng tự động trên Windows
├── build.bat                       # Kịch bản đóng gói ứng dụng thành file thực thi (.exe)
├── HTA.spec                        # Cấu hình PyInstaller phân phối ứng dụng
├── requirements.txt                # Danh sách thư viện Python cần thiết
└── pyproject.toml                  # Khai báo cấu hình dự án Python & setuptools
```

### Trách nhiệm các module chính:

- **`core.config`**: Định nghĩa thư mục gốc `ROOT_PATH` (hỗ trợ cả môi trường dev lẫn `_MEIPASS` khi đóng gói), cấu hình logging tập trung và lưu trữ các hằng số Shewhart cho cỡ nhóm $n = 10$ ($A_2 = 0.308$, $D_3 = 0.223$, $D_4 = 1.777$, $d_2 = 3.078$).
- **`core.spc_calculator`**: Động cơ toán học độc lập hoàn toàn với FastAPI, tính toán chính xác các giới hạn kiểm soát Shewhart, chỉ số năng lực quá trình ($\hat{\sigma} = \bar{R} / d_2$, $C_p$, $C_{pk}$), kiểm tra quy tắc chuỗi 7 điểm liên tiếp một phía và phân loại trạng thái an toàn.
- **`core.data_loader`**: Xử lý nạp dữ liệu từ các sheet Excel, chuẩn hóa định dạng LSL/USL, đọc các lô ảo từ SQLite và hợp nhất dữ liệu trước khi tính toán.
- **`core.cache_manager`**: Quản lý bộ đệm kết quả tính toán SPC với thời gian sống 5.0 giây, hạn chế tối đa tải đọc ghi đĩa và hỗ trợ xóa cache tức thời khi phát sinh sự kiện mô phỏng.
- **`core.websocket_manager`**: Theo dõi danh sách client WebSocket trực tuyến, tự động dọn kết nối chết và hỗ trợ phát tin đồng loạt (broadcast).
- **`api.routes`**: Quản lý các endpoint REST API và WebSocket, tách biệt rõ ràng với phần cấu hình ứng dụng.
- **`main.py`**: Điểm lắp ráp ứng dụng tinh gọn, xử lý vòng đời `lifespan` (tự động xóa lô ảo còn sót khi khởi động/kết thúc), áp dụng middleware chuẩn hóa đường dẫn và phục vụ các tệp tĩnh.

---

## Yêu cầu sử dụng

### Chạy từ mã nguồn

- Hệ điều hành Windows.
- Python 3.13 trở lên được khuyến nghị.
- Kết nối Internet trong lần đầu để tải các thư viện Python cần thiết.
- Giữ nguyên cấu trúc thư mục của dự án (`core`, `api`, `css`, `js`, `lib`, `template`, `ER_TABLE.xlsx`).

### Chạy bản đóng gói

- Người dùng cuối **không cần cài Python**.
- Chạy trực tiếp từ thư mục `dist\HTA` đã đóng gói (chạy tệp `HTA.exe`).
- Không tách riêng `HTA.exe` khỏi thư mục chứa các thư viện và tệp đi kèm.

---

## Chạy ứng dụng từ mã nguồn

1. Mở thư mục dự án trên máy tính Windows.
2. Nhấp đúp vào tệp `run.bat`.
3. Trong lần đầu, kịch bản sẽ tự tạo môi trường ảo `.venv` và cài đặt các thư viện từ `requirements.txt`.
4. Khi máy chủ sẵn sàng, trình duyệt sẽ tự động mở trang dashboard tại:  
   `http://127.0.0.1:8000`
5. Giữ cửa sổ console mở trong suốt quá trình làm việc. Nhấn `Ctrl+C` trong console để dừng ứng dụng an toàn.

---

## Chạy bản đã đóng gói

Người tạo bản phân phối chạy `build.bat` để biên dịch ứng dụng. Sau khi quá trình đóng gói hoàn tất, sản phẩm nằm trong thư mục:  
`dist\HTA`

Để chuyển sang máy khác sử dụng:

1. Sao chép **toàn bộ thư mục** `dist\HTA` sang máy đích.
2. Nhấp đúp chạy `HTA.exe`.
3. Trình duyệt sẽ tự động mở dashboard.

---

## Sử dụng dashboard

### Tab Tổng quan

Tab **Tổng quan** cung cấp góc nhìn toàn cảnh về tình trạng chất lượng của nhà máy:

- Thẻ tóm tắt số lượng loại lỗi: **Ổn định**, **Cần theo dõi**, **Nguy hiểm** hoặc **Chưa có dữ liệu**.
- **Biểu đồ tương quan các lỗi**: Trục kép kết hợp giữa chỉ số năng lực quá trình $C_{pk}$ (cột) và tỷ lệ vượt ngưỡng quy chuẩn OOS (đường nét uốn cong mượt mà), có đường tham chiếu mục tiêu chuẩn $C_{pk} = 1.33$.
- Bộ chuyển đổi nhanh chế độ xem biểu đồ tổng quan: $C_{pk}$ & OOS, Trạng thái phân loại, Tỷ trọng phế phẩm.
- Nhật ký các cảnh báo và vi phạm mới nhất theo dòng thời gian thực.

### Xem chi tiết từng loại lỗi (E1 – E8)

Nhấp vào từng tab loại lỗi cụ thể để kiểm tra chuyên sâu:

- **Chỉ số năng lực**: Hiển thị chi tiết $C_p$, $C_{pk}$, độ lệch chuẩn ước tính $\hat{\sigma}$, giá trị trung bình $\bar{\bar{X}}$, và khoảng biến thiên trung bình $\bar{R}$.
- **Bộ 4 biểu đồ kiểm soát SPC chuyên sâu**:
  1. **Biểu đồ $\bar{X}$ (Trung bình nhóm)** kèm các đường $UCL, CL, LCL$.
  2. **Biểu đồ $R$ (Khoảng biến thiên)** theo dõi độ phân tán mẫu.
  3. **Biểu đồ $P$ (Tỷ lệ phế phẩm)** với giới hạn kiểm soát biến thiên theo cỡ mẫu.
  4. **Biểu đồ $C$ (Số lượng khuyết tật)** đếm số điểm vi phạm quy chuẩn.
- **Bảng số liệu đo theo lô**: Liệt kê đầy đủ 10 giá trị đo $X_1 \rightarrow X_{10}$, giá trị trung bình, khoảng biến thiên, số mẫu OOS và dấu hiệu nhận biết lô ảo.
- **Nhật ký vi phạm SPC**: Lưu vết mọi điểm vượt giới hạn kiểm soát hoặc chuỗi vi phạm quy tắc thống kê.

### Bật / Dừng dữ liệu mô phỏng

- Nhấn nút **Bắt đầu dữ liệu ảo** trên thanh điều khiển để tạo dữ liệu thử nghiệm.
- Lô đầu tiên được sinh ngay lập tức; các lô tiếp theo được tự động sinh định kỳ mỗi 60 giây.
- Trong khi mô phỏng hoạt động, nút chuyển thành **Dừng dữ liệu ảo**.
- Khi nhấn dừng, toàn bộ các lô mô phỏng trong phiên sẽ được tự động xóa sạch khỏi hệ thống và dashboard lập tức trở về trạng thái đo lường thực tế từ tệp Excel.

---

## Ý nghĩa các chỉ số và trạng thái

### Giới hạn kỹ thuật và chỉ số năng lực

- **LSL (Lower Specification Limit)**: Giới hạn quy chuẩn dưới từ yêu cầu kỹ thuật.
- **USL (Upper Specification Limit)**: Giới hạn quy chuẩn trên từ yêu cầu kỹ thuật.
- **CL (Center Line)**: Đường tâm trung bình của quá trình.
- **UCL / LCL (Upper / Lower Control Limits)**: Giới hạn kiểm soát trên và dưới theo phương pháp thống kê Shewhart 3-sigma.
- **$C_p$**: Chỉ số năng lực tiềm năng của quá trình: $C_p = \frac{USL - LSL}{6\hat{\sigma}}$.
- **$C_{pk}$**: Chỉ số năng lực thực tế có xét đến độ lệch tâm: $C_{pk} = \min\left(\frac{USL - \bar{\bar{X}}}{3\hat{\sigma}}, \frac{\bar{\bar{X}} - LSL}{3\hat{\sigma}}\right)$.
- **OOS (Out of Specification)**: Số lượng mẫu đo nằm ngoài khoảng $[LSL, USL]$. Mẫu nằm đúng tại ngưỡng $LSL$ hoặc $USL$ vẫn được tính là đạt.

### Tiêu chí phân loại trạng thái quá trình

- 🔴 **Nguy hiểm (DANGER) / Không ổn định**:
  - $C_{pk} < 1.00$, hoặc
  - Có ít nhất một điểm vượt ngoài giới hạn kiểm soát ($UCL$ hoặc $LCL$), hoặc
  - Vi phạm quy tắc chuỗi: có 7 điểm liên tiếp nằm cùng một phía so với đường tâm $\bar{\bar{X}}$, hoặc
  - Phát sinh ít nhất một mẫu vượt quy chuẩn kỹ thuật (OOS).
- 🟡 **Cảnh báo (WARNING) / Cần theo dõi**:
  - Không vi phạm các điều kiện nguy hiểm trên, và
  - Chỉ số $1.00 \le C_{pk} < 1.33$.
- 🟢 **Ổn định (SUCCESS)**:
  - Không vi phạm giới hạn kiểm soát hoặc quy tắc chuỗi, không có mẫu OOS, và
  - Chỉ số $C_{pk} \ge 1.33$.
- ⚪ **Chưa có dữ liệu (NO_DATA)**:
  - Sheet không có dữ liệu số đo hợp lệ hoặc định dạng bị lỗi.

---

## Dữ liệu Excel đầu vào

Tệp nguồn dữ liệu là `ER_TABLE.xlsx` đặt tại thư mục gốc của dự án. Mỗi sheet tương ứng với một loại lỗi và có cấu trúc tiêu chuẩn:

- **Ô A1**: Tên loại lỗi (ví dụ: *Lỗi cần cong biến dạng sau nung*).
- **Hàng 2 (Cột B, C)**: Giới hạn quy chuẩn kỹ thuật `LSL` (ô B2) và `USL` (ô C2).
- **Hàng 5**: Dòng tiêu đề của bảng số đo, chứa các cột nhận diện bắt buộc từ `X1` đến `X10`, cùng các cột bổ trợ tùy chọn như `TIME` và `ID`.
- **Hàng 6 trở đi**: Dữ liệu đo lường theo từng lô sản xuất.

**Lưu ý quan trọng:**
- Mỗi lô cần ít nhất 2 mẫu hợp lệ để tính toán trung bình và khoảng biến thiên.
- Các giá trị đo phải ở dạng số (hỗ trợ cả dấu chấm `.` và dấu phẩy `,` cho phần thập phân).

---

## Dữ liệu mô phỏng

Trình giả lập (`simulator.py`) hoạt động hoàn toàn độc lập:
- Lấy mẫu dựa trên dữ liệu thực tế trong workbook, bổ sung nhiễu ngẫu nhiên và làm tròn số thập phân.
- Các lô ảo được gán mã nhận diện dạng `LOT-000001`, `LOT-000002`...
- Dữ liệu mô phỏng được lưu trong tệp SQLite tạm thời `virtual_spc_data.sqlite3`. Khi chạy bản đóng gói `.exe`, tệp này nằm an toàn trong thư mục `%LOCALAPPDATA%\HTA` để tránh lỗi phân quyền ghi đĩa.
- Hệ thống tự động dọn sạch các bản ghi mô phỏng cũ mỗi khi khởi động hoặc tắt dashboard.

---

## Dữ liệu và quyền riêng tư

- Toàn bộ quá trình tính toán và lưu trữ diễn ra **100% nội bộ (Offline)** trên máy tính của bạn.
- Mặc định máy chủ chỉ mở kết nối trên card mạng nội bộ `127.0.0.1:8000`.
- Không gửi bất kỳ dữ liệu sản xuất hay thông tin đo lường nào ra Internet.

Nếu cổng 8000 bị chiếm dụng bởi ứng dụng khác, bạn có thể chỉ định cổng mới qua biến môi trường `HTA_PORT`:

```cmd
set HTA_PORT=8080
run.bat
```

---

## Khắc phục sự cố

| Hiện tượng | Nguyên nhân có thể | Cách khắc phục |
| :--- | :--- | :--- |
| **Báo cổng 8000 đang được sử dụng** | Có một phiên HTA khác đang chạy ngầm hoặc ứng dụng khác chiếm cổng | Kiểm tra Task Manager để đóng tiến trình cũ, hoặc đổi cổng qua lệnh `set HTA_PORT=8080`. |
| **Lỗi cài đặt thư viện ở lần đầu chạy** | Mất kết nối Internet hoặc lỗi kết nối pip | Đảm bảo kết nối mạng ổn định và chạy lại `run.bat`. |
| **Loại lỗi hiển thị "Chưa có dữ liệu"** | Cấu hình ô LSL/USL hoặc tên cột trong `ER_TABLE.xlsx` sai định dạng | Kiểm tra lại cấu trúc hàng 1, 2 và hàng 5 của sheet tương ứng trong file Excel. |
| **Biểu đồ không tự làm mới** | Kết nối WebSocket bị ngắt hoặc máy chủ đã dừng | Tải lại trang (F5) hoặc kiểm tra cửa sổ console xem máy chủ còn hoạt động không. |

---

## Câu hỏi thường gặp

**1. Chạy mô phỏng có làm hỏng hoặc thay đổi file Excel gốc không?**  
*Hoàn toàn không.* Quá trình mô phỏng chỉ ghi vào cơ sở dữ liệu SQLite tạm thời và xử lý trên bộ nhớ đệm RAM. Tệp Excel gốc không bao giờ bị ghi đè.

**2. Tại sao sau khi đóng và mở lại ứng dụng thì các lô ảo biến mất?**  
*Đây là thiết kế tiêu chuẩn.* Dữ liệu ảo chỉ phục vụ kiểm thử phiên làm việc hiện tại và sẽ tự động được dọn dẹp sạch sẽ để dashboard luôn phản ánh đúng hiện trạng thực tế từ file Excel.

**3. Làm sao để cập nhật dữ liệu sản xuất mới?**  
Chỉ cần mở `ER_TABLE.xlsx`, thêm các hàng số đo mới vào các sheet tương ứng, lưu lại tệp Excel. Dashboard sẽ tự động tính toán lại và hiển thị số liệu mới trong vòng vài giây.
