# HTA - Dashboard giám sát chất lượng SPC

HTA là ứng dụng dashboard chạy trên máy tính Windows, dùng để theo dõi dữ liệu
kiểm soát chất lượng theo phương pháp **SPC (Statistical Process Control)**.
Ứng dụng đọc dữ liệu từ workbook Excel, tính các chỉ số và biểu đồ cho từng
loại lỗi, hiển thị cảnh báo theo thời gian thực, đồng thời có thể tạo thêm dữ
liệu mô phỏng để người dùng thử các chức năng.

Tài liệu này dành cho người dùng cuối: cách cài đặt, khởi động, đọc dashboard,
chạy dữ liệu ảo, xử lý sự cố và hiểu dữ liệu nào được lưu hoặc xóa.

## Mục lục

- [Tổng quan cách hoạt động](#tổng-quan-cách-hoạt-động)
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

## Tổng quan cách hoạt động

Ứng dụng hoạt động theo chuỗi sau:

1. Người dùng chạy ứng dụng bằng `CHAY_SPC.bat` hoặc `HTA.exe`.
2. HTA khởi động một máy chủ web cục bộ trên máy tính và mở trang dashboard
   trong trình duyệt.
3. Backend đọc từng sheet trong `ER_TABLE.xlsx`, lấy tên loại lỗi, giới hạn
   quy chuẩn và các nhóm số đo.
4. Backend làm sạch số liệu, tính các chỉ số SPC, trạng thái và lịch sử cảnh
   báo cho từng sheet.
5. Trình duyệt nhận dữ liệu ban đầu và được cập nhật khi dữ liệu thay đổi.
6. Nếu người dùng bật mô phỏng, các lô dữ liệu ảo được ghép với dữ liệu trong
   workbook để tính lại kết quả. Workbook gốc không bị sửa đổi.

Dashboard được thiết kế để giám sát trên chính máy đang chạy ứng dụng. Máy chủ
lắng nghe tại `127.0.0.1`, không phải dịch vụ triển khai để truy cập trực tiếp
từ Internet hoặc máy tính khác trong mạng.

## Yêu cầu sử dụng

### Chạy từ mã nguồn

- Windows.
- Python 3.13 trở lên được khuyến nghị để phù hợp với cấu hình dự án.
- Kết nối Internet trong lần chạy đầu để tải các thư viện Python.
- Giữ nguyên các tệp và thư mục đi cùng ứng dụng, đặc biệt là:
  `ER_TABLE.xlsx`, `main.py`, `simulator.py`, `launcher.py`, `css`, `js`, `lib`
  và `template`.

### Chạy bản đóng gói

- Người dùng cuối không cần cài Python.
- Cần chạy từ toàn bộ thư mục `dist\HTA` đã được đóng gói; không tách riêng
  `HTA.exe` khỏi các tệp đi kèm.

## Chạy ứng dụng từ mã nguồn

1. Giải nén hoặc đặt toàn bộ dự án vào một thư mục trên máy Windows.
2. Mở thư mục đó và nhấp đúp `CHAY_SPC.bat`.
3. Ở lần đầu, ứng dụng tạo môi trường Python riêng `.venv`. Nếu thiếu thư
   viện, ứng dụng cài chúng từ `requirements.txt`; cần có Internet và chờ quá
   trình cài đặt hoàn tất.
4. Khi máy chủ sẵn sàng, trình duyệt sẽ mở dashboard tại:
   `http://127.0.0.1:8000`
5. Giữ cửa sổ console đang chạy trong suốt thời gian sử dụng. Đóng cửa sổ này
   sẽ làm ứng dụng kết thúc.

Các lần sau thường không cần cài lại thư viện nếu môi trường `.venv` vẫn còn
đầy đủ.

## Chạy bản đã đóng gói

Người tạo bản phân phối cần chạy `DONG_GOI.bat` trên Windows, với Python 3.13
trở lên và kết nối Internet. Khi hoàn tất, ứng dụng nằm trong
`dist\HTA`.

Để sử dụng trên máy khác:

1. Sao chép **toàn bộ** thư mục `dist\HTA` sang máy đích.
2. Chạy `HTA.exe`.
3. Chờ trang dashboard mở trong trình duyệt và giữ cửa sổ ứng dụng hoạt động.

Không chỉ sao chép riêng `HTA.exe`, vì các thư viện và tài nguyên giao diện
được phân phối cùng thư mục.

## Sử dụng dashboard

### Tổng quan

Tab **Tổng quan** giúp xem nhanh tình trạng chung của các loại lỗi. Dashboard
hiển thị các biểu đồ tổng hợp về:

- Số loại lỗi đang ổn định, cần cảnh báo, nguy hiểm hoặc chưa có dữ liệu.
- Năng lực Cpk theo từng loại lỗi.
- Số lượng/tỷ lệ mẫu ngoài quy chuẩn (OOS).
- Tỷ trọng các lô có trạng thái nguy hiểm theo loại lỗi.
- Lịch sử cảnh báo và nguy hiểm gần đây.

Thời điểm cập nhật được hiển thị trên trang. Dashboard tự làm mới thông tin;
không cần tải lại trình duyệt mỗi khi có lô mới.

### Xem chi tiết một loại lỗi

Chọn tab có mã loại lỗi (ví dụ E1, E2...) để xem thông tin riêng cho sheet đó,
bao gồm:

- Trạng thái và Cpk hiện tại.
- Biểu đồ X-bar, R, P và C.
- Các giới hạn quy chuẩn LSL/USL và giới hạn kiểm soát UCL/CL/LCL.
- Lịch sử giá trị theo lô.
- Lịch sử vi phạm SPC và các mẫu OOS.

Biểu đồ mini chỉ hiển thị tối đa 12 nhóm gần nhất. Bảng lịch sử giúp xem các
lô, thời điểm, giá trị và cảnh báo chi tiết hơn.

### Bật hoặc tắt dữ liệu mô phỏng

Nút **Bắt đầu dữ liệu ảo** sẽ khởi chạy mô phỏng. Lô đầu tiên được tạo ngay;
những lô tiếp theo được tạo theo chu kỳ 60 giây. Trong khi mô phỏng chạy, nút
đổi thành **Dừng dữ liệu ảo**.

Khi nhấn **Dừng dữ liệu ảo**, ứng dụng dừng tác vụ mô phỏng và xóa các lô do
phiên đó tạo. Sau đó dashboard cập nhật lại theo dữ liệu còn lại trong
workbook.

Mô phỏng nhằm hỗ trợ xem hoạt động của dashboard và biểu đồ. Các số đo này là
dữ liệu tổng hợp, không phải kết quả đo thực tế và không nên dùng làm hồ sơ
chất lượng sản xuất.

## Ý nghĩa các chỉ số và trạng thái

### Giới hạn và chỉ số năng lực

- **LSL (Lower Specification Limit):** giới hạn quy chuẩn dưới.
- **USL (Upper Specification Limit):** giới hạn quy chuẩn trên.
- **UCL / LCL:** giới hạn kiểm soát trên / dưới của biểu đồ.
- **CL:** đường tâm của biểu đồ.
- **Cp:** chỉ số năng lực tiềm năng, so sánh độ rộng dung sai với độ phân tán
  của quá trình.
- **Cpk:** chỉ số năng lực có xét cả độ phân tán và vị trí trung bình so với
  giới hạn quy chuẩn. Cpk thấp hơn 1 nghĩa là năng lực không đạt theo ngưỡng
  đánh giá của dashboard.
- **OOS (Out of Specification):** mẫu thấp hơn LSL hoặc cao hơn USL. Mẫu đúng
  bằng LSL hoặc USL được tính trong giới hạn.

Cp/Cpk là chỉ số thống kê hỗ trợ theo dõi, không thay thế việc xác minh quy
trình, phương pháp đo hoặc quyết định chất lượng theo quy định của đơn vị.

### Các biểu đồ

- **X-bar Chart:** theo dõi trung bình của từng nhóm mẫu.
- **R Chart:** theo dõi khoảng biến thiên (giá trị lớn nhất trừ nhỏ nhất)
  trong từng nhóm.
- **P Chart:** theo dõi tỷ lệ mẫu OOS trong mỗi nhóm; giới hạn kiểm soát được
  điều chỉnh theo số mẫu hợp lệ của nhóm.
- **C Chart:** theo dõi số mẫu OOS trong mỗi nhóm.

### Trạng thái tổng thể của một loại lỗi

Dashboard dùng các ngưỡng và điều kiện sau:

- **Nguy hiểm / Không ổn định:** Cpk dưới 1.00, có vi phạm giới hạn kiểm soát,
  có chuỗi 7 điểm liên tiếp cùng phía đường tâm X-bar, hoặc có ít nhất một
  mẫu OOS.
- **Cảnh báo / Cần theo dõi:** không rơi vào điều kiện nguy hiểm và Cpk từ
  1.00 đến dưới 1.33.
- **Ổn định:** không có điều kiện nguy hiểm và Cpk từ 1.33 trở lên.
- **Chưa có dữ liệu:** sheet không có nhóm số đo hợp lệ hoặc phát sinh lỗi dữ
  liệu khi xử lý. Nếu thấy trạng thái này, hãy kiểm tra workbook và thông báo
  lỗi trong cửa sổ console.

Trạng thái tổng hợp không chỉ phụ thuộc vào Cpk. Một quá trình có Cpk cao vẫn
có thể bị đánh dấu nguy hiểm nếu phát hiện vi phạm SPC hoặc mẫu OOS.

## Dữ liệu Excel đầu vào

Workbook đầu vào là `ER_TABLE.xlsx`, đặt cùng cấp với ứng dụng khi chạy từ mã
nguồn. Mỗi sheet tương ứng với một loại lỗi. Backend đọc:

- Tên loại lỗi tại ô đầu tiên của sheet.
- LSL và USL ở hàng thứ hai, cột B và cột C.
- Bảng số đo bắt đầu với tiêu đề ở hàng thứ năm.
- Các cột mẫu nhận diện là `X1` đến `X10`.
- Có thể có cột `TIME` và `ID` để hiển thị thời điểm và mã lô.

Để dữ liệu được nhận đúng:

- Giữ nguyên cấu trúc và vị trí các trường nói trên.
- Các giá trị mẫu phải chuyển được thành số. Giá trị trống hoặc không phải số
  sẽ bị loại khi tính toán.
- Một nhóm cần ít nhất 2 mẫu hợp lệ để tính trung bình và khoảng biến thiên.
- LSL/USL phải là giá trị số hợp lệ; nếu dùng số thập phân, có thể dùng dấu
  chấm hoặc dấu phẩy.
- Sao lưu workbook trước khi thay thế hoặc chỉnh sửa.

Nếu không có cột mẫu hợp lệ hoặc không còn nhóm hợp lệ, loại lỗi đó sẽ không
thể được tính toán. Nếu giới hạn quy chuẩn không hợp lệ, việc tải dữ liệu có
thể thất bại.

## Dữ liệu mô phỏng

Mô phỏng lấy các nhóm mẫu từ workbook làm nguồn, thêm một lượng nhiễu nhỏ và
làm tròn các số đo đến 2 chữ số thập phân. Mỗi lô mô phỏng có 10 cột mẫu
`X1`-`X10` cho từng loại lỗi.

- Lô đầu tiên được tạo ngay khi bắt đầu.
- Mã lô có dạng `LOT-000001`, `LOT-000002`... và tăng dần trong phiên.
- Các lô tiếp theo được tạo mỗi 60 giây.
- Dữ liệu mô phỏng được đánh dấu riêng để phân biệt với dữ liệu gốc.
- Dừng mô phỏng sẽ xóa dữ liệu của phiên đang chạy.
- Tắt ứng dụng bình thường cũng yêu cầu dừng và dọn mô phỏng.
- Mỗi lần khởi động dashboard, ứng dụng xóa các lô mô phỏng còn sót từ phiên
  trước. Dữ liệu gốc trong workbook không bị xóa.

Dashboard dùng cache ngắn để tránh tính toán lại workbook liên tục. Khi có lô
mới, thay đổi thường xuất hiện trong vòng khoảng 5 giây.

## Dữ liệu và quyền riêng tư

- Dữ liệu gốc được đọc từ workbook; ứng dụng không ghi đè workbook.
- Tệp SQLite `virtual_spc_data.sqlite3` chỉ dùng lưu tạm các lô mô phỏng:
  - Chạy từ mã nguồn: nằm trong thư mục dự án.
  - Chạy bản đóng gói: nằm trong `%LOCALAPPDATA%\HTA`.
- Ứng dụng mặc định chỉ lắng nghe `127.0.0.1` trên cổng `8000`.
- Không có chức năng đăng nhập hay phân quyền người dùng; không mở cổng này ra
  mạng công cộng.
- Không nên coi dữ liệu mô phỏng là dữ liệu sản xuất hoặc dữ liệu lưu trữ dài
  hạn. Hãy lưu dữ liệu kiểm tra thực tế trong hệ thống có quy trình sao lưu
  riêng của đơn vị.

Nếu cổng 8000 đang được sử dụng, có thể đặt biến môi trường `HTA_PORT` sang
một cổng còn trống trước khi chạy ứng dụng. Ví dụ trong Command Prompt:

```bat
set HTA_PORT=8010
CHAY_SPC.bat
```

Sau đó dashboard sẽ ở `http://127.0.0.1:8010`. Nếu dùng bản đóng gói, đặt
`HTA_PORT` trong môi trường rồi chạy `HTA.exe`.

## Khắc phục sự cố

### Dashboard không mở hoặc báo cổng đang được sử dụng

- Kiểm tra xem một phiên HTA khác có đang chạy không.
- Đóng phiên cũ một cách bình thường rồi thử lại.
- Nếu một ứng dụng khác đang dùng cổng 8000, đổi `HTA_PORT` như hướng dẫn ở
  trên.

### Lần đầu chạy bị lỗi cài thư viện

- Kiểm tra kết nối Internet.
- Không đóng cửa sổ console trong lúc cài đặt.
- Chạy lại `CHAY_SPC.bat` sau khi kết nối mạng ổn định.
- Nếu vẫn lỗi, ghi lại nội dung thông báo trong console để gửi cho người hỗ
  trợ.

### Dashboard báo lỗi dữ liệu hoặc một loại lỗi hiện “Chưa có dữ liệu”

- Kiểm tra tệp `ER_TABLE.xlsx` có ở đúng thư mục và mở được bằng Excel.
- Kiểm tra tên sheet, hàng tiêu đề, các cột `X1`-`X10`, LSL và USL theo mục
  [Dữ liệu Excel đầu vào](#dữ-liệu-excel-đầu-vào).
- Kiểm tra các ô số đo có chứa ký tự hoặc định dạng không hợp lệ hay không.
- Đọc thông báo lỗi trong cửa sổ console.

### Nút mô phỏng bị khóa hoặc mô phỏng không chạy

- Chờ dashboard tải xong dữ liệu ban đầu.
- Kiểm tra workbook còn nguyên cấu trúc và có nhóm mẫu hợp lệ.
- Xem trạng thái/lỗi trong khu vực trạng thái mô phỏng và cửa sổ console.
- Thử dừng, sau đó bắt đầu lại phiên mô phỏng.

### Dashboard không cập nhật

- Chờ vài giây vì dữ liệu được làm mới theo chu kỳ.
- Kiểm tra cửa sổ console của ứng dụng còn hoạt động.
- Tải lại trang trình duyệt một lần. Nếu máy chủ đã dừng, hãy khởi chạy lại
  `CHAY_SPC.bat` hoặc `HTA.exe`.

### Thoát ứng dụng

- Khi chạy từ mã nguồn, nhấn `Ctrl+C` trong cửa sổ console.
- Khi chạy bản đóng gói, đóng ứng dụng theo cách thông thường và chờ thông báo
  dừng.
- Không tắt cưỡng bức tiến trình nếu có thể tránh được; ứng dụng cần cơ hội
  gọi API dừng mô phỏng và xóa các lô tạm.

## Câu hỏi thường gặp

### Bắt đầu mô phỏng có xóa dữ liệu Excel không?

Không. Mô phỏng ghi dữ liệu riêng vào SQLite và chỉ ghép dữ liệu đó khi tính
dashboard. Workbook gốc không bị sửa đổi.

### Vì sao dữ liệu mô phỏng biến mất sau khi khởi động lại?

Đây là chủ đích: dữ liệu mô phỏng được coi là tạm thời. Khi ứng dụng khởi động,
các lô còn sót từ phiên cũ được xóa để dashboard bắt đầu lại từ workbook.

### Tắt mô phỏng có xóa dữ liệu gốc không?

Không. Chỉ các bản ghi thuộc phiên mô phỏng đang chạy được xóa. Dữ liệu trong
`ER_TABLE.xlsx` vẫn được giữ nguyên.

### Dashboard có gửi dữ liệu lên Internet không?

Theo cấu hình hiện tại, backend chạy trên `127.0.0.1` và đọc workbook trên máy.
Quá trình cài thư viện lần đầu và đóng gói cần Internet, nhưng thao tác xem
dashboard thông thường được phục vụ cục bộ trên máy đang chạy ứng dụng.

### Có thể dùng để theo dõi dữ liệu thật trực tiếp từ dây chuyền không?

Dashboard hiện đọc workbook Excel và mô phỏng dữ liệu; tài liệu này không mô
tả một kết nối trực tiếp tới máy đo, PLC, MES hay cơ sở dữ liệu sản xuất. Hãy
kiểm tra và nạp dữ liệu vào workbook theo đúng cấu trúc trước khi sử dụng.

