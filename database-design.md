# Thiết kế cơ sở dữ liệu HomeNest

## Phạm vi và khảo sát

- Frontend React/Vite hiện dùng dữ liệu tĩnh gồm 9 sản phẩm. Mỗi sản phẩm có tên, thương hiệu, danh mục, giá hiện tại, giá cũ tùy chọn, nhãn, đường dẫn ảnh và mô tả ảnh. Danh mục và thương hiệu được lọc/tìm theo tên; trang khuyến mãi dùng `oldPrice` để nhận diện sản phẩm giảm giá.
- Giao diện hiện chưa triển khai tài khoản, địa chỉ, chi tiết sản phẩm, giỏ hàng, yêu thích, đặt hàng hoặc thanh toán. Các bảng tương ứng dưới đây là nền tảng cho chức năng được yêu cầu, không phải suy ra từ API frontend hiện có.
- Backend hiện chỉ có Express endpoint `/api` xác nhận dịch vụ hoạt động, chưa có kết nối cơ sở dữ liệu.
- Thư mục `database` và `documents` chưa có schema/seed hay tài liệu trước đó.
- Đã thử truy vấn `sys.tables` bằng `sqlcmd` với Windows authentication tới `WebBanDoGiaDung`. Dịch vụ `MSSQLSERVER` đang chạy, nhưng client lỗi mã hóa và không thiết lập được kết nối. Do đó chưa thể xác nhận bảng hiện hữu. Trước khi chạy script, cần kiểm tra catalog bằng một kết nối SQL Server được cấu hình phù hợp. `schema.sql` có chốt an toàn từ chối tạo nếu một bảng đích đã tồn tại.

## Quy ước chung

- Tạo bảng trong schema `dbo`, mã hóa chuỗi Unicode bằng `NVARCHAR`/`N'...'`; thời điểm lưu kiểu `DATETIME2(0)` theo UTC.
- Khóa chính dùng `INT IDENTITY(1,1)`. Giá tiền dùng `DECIMAL(18,2)` để biểu diễn VND mà không phụ thuộc kiểu `MONEY`; tồn kho và số lượng dùng `INT`.
- Các trạng thái lưu bằng chuỗi có `CHECK`, thuận tiện đọc và tránh phụ thuộc thứ tự mã số. Backend phải chỉ cho phép chuyển trạng thái hợp lệ.
- Tài khoản được vô hiệu hóa qua `IsActive`, không xóa cứng. Sản phẩm/danh mục/thương hiệu cũng có cờ hoạt động; sản phẩm đã xuất hiện trong đơn không nên bị xóa.
- Mật khẩu chỉ lưu `PasswordHash` do backend tạo bằng thuật toán băm mật khẩu phù hợp; không lưu mật khẩu gốc, token đăng nhập, dữ liệu thẻ hoặc tài khoản ngân hàng.

## Bảng và ràng buộc

| Bảng | Trường chính | Khóa/ràng buộc và mục đích |
|---|---|---|
| `Roles` | `RoleId`, `RoleCode`, `RoleName` | PK; `RoleCode` duy nhất (`CUSTOMER`, `ADMIN`). |
| `Users` | `UserId`, `Email`, `PasswordHash`, `FullName`, `Phone`, `IsActive`, thời điểm tạo/cập nhật | PK; email duy nhất; email lưu chuẩn hóa chữ thường ở backend. |
| `UserRoles` | `UserId`, `RoleId`, `AssignedAt` | PK ghép, FK tới người dùng/vai trò; hỗ trợ một tài khoản có nhiều vai trò. |
| `UserAddresses` | `AddressId`, `UserId`, tên người nhận, điện thoại, địa chỉ các cấp, `IsDefault` | PK/FK; filtered unique index bảo đảm mỗi người dùng nhiều nhất một địa chỉ mặc định. |
| `Categories` | `CategoryId`, `ParentCategoryId`, `CategoryName`, `Slug`, `IsActive` | PK; slug duy nhất; FK tự tham chiếu để hỗ trợ danh mục cha/con. |
| `Brands` | `BrandId`, `BrandName`, `Slug`, `IsActive` | PK; tên và slug duy nhất. |
| `Products` | `ProductId`, `SKU`, `ProductName`, `Description`, `CategoryId`, `BrandId`, `UnitPrice`, `StockQuantity`, `IsActive`, thời điểm | PK; SKU duy nhất; giá không âm; tồn không âm; FK danh mục và thương hiệu. `UnitPrice` là giá niêm yết trước khuyến mãi. |
| `ProductImages` | `ProductImageId`, `ProductId`, `ImageUrl`, `AltText`, `SortOrder`, `IsPrimary` | PK/FK; filtered unique index cho tối đa một ảnh chính mỗi sản phẩm. Ảnh là URL/path, không nhúng binary. |
| `Promotions` | `PromotionId`, mã/tên, `DiscountType`, `DiscountValue`, `StartsAt`, `EndsAt`, `IsActive`, giới hạn lượt áp dụng | PK; mã duy nhất; kiểu `PERCENT` hoặc `AMOUNT`; giá trị hợp lệ; thời gian kết thúc sau bắt đầu. |
| `ProductPromotions` | `ProductId`, `PromotionId`, giới hạn giảm tối đa tùy chọn | PK ghép/FK; bảng liên kết nhiều-nhiều giữa sản phẩm và chiến dịch. Backend xác định chiến dịch đang hiệu lực và giá cuối, không cộng dồn trừ khi nghiệp vụ sau này quy định. |
| `Carts` | `CartId`, `UserId`, `CreatedAt`, `UpdatedAt` | PK/FK; filtered unique index một giỏ cho mỗi người dùng. |
| `CartItems` | `CartId`, `ProductId`, `Quantity`, `AddedAt`, `UpdatedAt` | PK ghép; FK; số lượng dương. Giá giỏ được tính lại từ giá hiện hành khi xem/đặt hàng. |
| `Wishlists` | `UserId`, `ProductId`, `CreatedAt` | PK ghép/FK; cùng sản phẩm không bị lưu trùng trong danh sách một người. |
| `Orders` | `OrderId`, `OrderNumber`, `UserId`, trạng thái, phương thức thanh toán, snapshot người nhận/địa chỉ, các tổng tiền, ghi chú, thời điểm | PK; mã đơn duy nhất; FK người dùng; tổng tiền không âm. Snapshot giao hàng không FK tới địa chỉ để lịch sử không đổi khi khách sửa/xóa địa chỉ. |
| `OrderItems` | `OrderItemId`, `OrderId`, `ProductId` nullable, SKU/tên snapshot, `UnitPrice`, `Quantity`, giảm giá đơn vị, `LineTotal` | PK/FK; snapshot giữ nguyên nội dung và giá tại lúc mua; FK sản phẩm `ON DELETE SET NULL` nếu cần dọn dữ liệu danh mục. Không xóa cứng sản phẩm còn được tham chiếu. |
| `OrderStatusHistory` | `OrderStatusHistoryId`, `OrderId`, trạng thái cũ/mới, ghi chú, `ChangedByUserId`, `ChangedAt` | PK/FK; lưu dấu vết chuyển trạng thái và tác nhân; tác nhân nullable cho sự kiện hệ thống. |
| `Payments` | `PaymentId`, `OrderId`, `AttemptNumber`, `PaymentMethod`, `PaymentStatus`, `Amount`, thời điểm, `ProcessedByUserId`, ghi chú | PK/FK; duy nhất cặp đơn/lần thử; `COD` hoặc `ONLINE`; `PENDING`, `SUCCESS`, `FAILED`; không có trường thẻ/ngân hàng/nhà cung cấp thật. Cho phép nhiều lần thử ONLINE được mô phỏng. |
| `InventoryTransactions` | `InventoryTransactionId`, `ProductId`, `OrderId` nullable, `QuantityChange`, `Reason`, `CreatedByUserId`, `CreatedAt` | PK/FK; nhật ký nhập/xuất/đặt giữ/hoàn tồn để kiểm toán thay đổi tồn. Tồn hiện tại nằm trên `Products.StockQuantity`; cập nhật cả hai phải nằm trong cùng transaction backend. |

## Quan hệ

- `Users`–`Roles` là nhiều-nhiều qua `UserRoles`; `Users`–`UserAddresses`, `Carts`, `Orders` là một-nhiều (giỏ được giới hạn một bản ghi đang dùng/người dùng bằng filtered index).
- `Categories` có thể lồng cây; `Categories`–`Products` và `Brands`–`Products` là một-nhiều.
- `Products`–`ProductImages` là một-nhiều; `Products`–`Promotions` là nhiều-nhiều qua `ProductPromotions`.
- `Carts`–`Products` là nhiều-nhiều qua `CartItems`; `Users`–`Products` yêu thích là nhiều-nhiều qua `Wishlists`.
- `Orders`–`OrderItems` và `Orders`–`OrderStatusHistory` là một-nhiều; `Orders`–`Payments` là một-nhiều để lưu lần thử thanh toán. `InventoryTransactions` ghi biến động của sản phẩm và có thể tham chiếu đơn.

## Quy trình đặt hàng

1. Backend xác thực người dùng, kiểm tra giỏ còn sản phẩm hoạt động, giá/khuyến mãi hiệu lực, số lượng tồn và địa chỉ nhận hàng. Không tin tổng tiền gửi từ trình duyệt.
2. Trong một transaction SQL: khóa/kiểm tra các dòng tồn liên quan, tạo `Orders` với snapshot người nhận/địa chỉ và tổng tiền tính phía server; tạo `OrderItems` snapshot tên/SKU/đơn giá/giảm giá; giảm hoặc giữ tồn theo chính sách chốt đơn; ghi `InventoryTransactions`; ghi `OrderStatusHistory` từ rỗng sang `PENDING_CONFIRMATION`; tạo payment ban đầu; xóa các dòng giỏ đã mua. Nếu bước nào lỗi thì rollback toàn bộ.
3. Với `COD`, `Payments.PaymentStatus` bắt đầu `PENDING`. Quản trị viên chỉ chuyển sang `SUCCESS` khi xác nhận đã thu tiền; ghi người xử lý và thời điểm. Việc giao/hoàn tất đơn là trạng thái đơn riêng.
4. Với `ONLINE`, backend tạo lần thử mô phỏng `PENDING`, rồi tự cập nhật thành `SUCCESS` hoặc `FAILED` theo kết quả mô phỏng. Không gọi cổng thật, không ghi dữ liệu thẻ/tài khoản. Nếu thử lại, tạo `Payments` với `AttemptNumber` mới; giữ lịch sử các lần thử.
5. Hủy đơn dùng chuyển trạng thái có điều kiện ở backend (đề xuất chỉ cho phép khách hủy khi `PENDING_CONFIRMATION` hoặc `CONFIRMED`, trước khi giao); khóa đơn khi chuyển trạng thái để tránh đua đồng thời. Cập nhật lịch sử và hoàn tồn có nhật ký trong cùng transaction. Các điều kiện chính xác có thể điều chỉnh theo vận hành.

## Seed

`database/seed.sql` thêm vai trò CUSTOMER/ADMIN, bốn danh mục, các thương hiệu và chín mặt hàng mẫu lấy từ dữ liệu frontend. Seed dùng `IF NOT EXISTS` theo khóa tự nhiên để có thể chạy lại, không xóa hoặc cập nhật dữ liệu sẵn có; các SKU là SKU mẫu nội bộ. Giá cũ của frontend được dùng làm giá niêm yết, phần chênh với giá hiện tại được biểu diễn bằng chiến dịch giảm giá cố định. Mọi ảnh dùng đường dẫn tương đối hiện có trong frontend.

## Thứ tự chuẩn bị khi được duyệt

1. Kết nối vào đúng máy chủ/database và đọc `sys.tables`, cột, khóa/index/FK; sao lưu theo quy trình vận hành.
2. Nếu có bất kỳ bảng trùng tên nào, dừng và đối chiếu schema; lập migration có phiên bản/đổi tên rõ ràng, không chạy `schema.sql` nguyên trạng.
3. Nếu không có xung đột, xem xét/chạy `schema.sql`, rồi `seed.sql` trong môi trường được chỉ định. Các tệp trong bước này chỉ là thiết kế, chưa được thực thi.
