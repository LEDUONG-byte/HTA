# Chạy dashboard SPC và bộ nạp dữ liệu ảo

Nhấp đúp vào `CHAY_SPC.bat` để mở dashboard. Lần chạy đầu tiên, script sẽ tạo môi trường Python và cài các thư viện cần thiết; cần kết nối Internet trong bước này. Dashboard mở ra nhưng bộ nạp dữ liệu ảo vẫn tắt.

Để tạo bản phân phối không yêu cầu người dùng cài Python, chạy `DONG_GOI.bat` trên máy Windows có Python 3.13 trở lên và kết nối Internet. Sau khi đóng gói hoàn tất, sao chép toàn bộ thư mục `dist/HTA` sang máy đích rồi chạy `HTA.exe`; không chỉ sao chép riêng file EXE. Python và thư viện ứng dụng được đóng gói cùng bản phân phối, nên máy đích không cần cài Python. Ứng dụng mặc định dùng cổng 8000; có thể đặt biến môi trường `HTA_PORT` để đổi cổng nếu cổng này đang được dùng.

Nhấn **Bắt đầu dữ liệu ảo** trên trang để tạo ngay một lô được đánh số `LOT-000001`, kiểm tra lần lượt qua các lỗi E1-E8; mỗi bước lỗi có 10 mẫu. Sau đó tạo lô `LOT-000002` và tiếp tục tăng số mỗi 60 giây. Giá trị mô phỏng được lấy quanh các nhóm đo trong `ER_TABLE.xlsx` và làm tròn đến 2 chữ số thập phân. Nhấn **Dừng dữ liệu ảo** để ngừng tạo và xóa các lô của phiên đó.

Dữ liệu từng loại lỗi gồm các biểu đồ X-bar, R, P và C. P Chart theo dõi tỷ lệ số đo ngoài quy chuẩn trên số mẫu thực tế của mỗi lô (giới hạn kiểm soát được điều chỉnh theo cỡ mẫu); C Chart theo dõi số đo ngoài quy chuẩn trên mỗi lô.

Dữ liệu ảo được lưu trong `virtual_spc_data.sqlite3` khi chạy từ mã nguồn hoặc trong `%LOCALAPPDATA%/HTA/virtual_spc_data.sqlite3` khi chạy bản đóng gói; workbook gốc không bị sửa đổi. Dashboard đọc dữ liệu mới tối đa sau khoảng 5 giây. Mỗi lần khởi động dashboard, dữ liệu ảo còn sót của phiên trước và cache trong bộ nhớ sẽ được xóa, trang sẽ chỉ tải lại dữ liệu gốc từ workbook. Nhấn `Ctrl+C` trong cửa sổ dashboard để dừng và xóa dữ liệu ảo trước khi đóng. Dữ liệu gốc trong workbook được giữ nguyên.
