/* HomeNest starter seed. Design only: run after schema.sql has been reviewed/applied. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL OR OBJECT_ID(N'dbo.Products', N'U') IS NULL
BEGIN
    ;THROW 51001, 'HomeNest tables are missing. Review and apply the schema before seeding.', 1;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    INSERT dbo.Roles (RoleCode, RoleName)
    SELECT src.RoleCode, src.RoleName
    FROM (VALUES (N'CUSTOMER', N'Khách hàng'), (N'ADMIN', N'Quản trị viên')) AS src(RoleCode, RoleName)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Roles r WHERE r.RoleCode = src.RoleCode);

    INSERT dbo.Categories (CategoryName, Slug, Description, SortOrder)
    SELECT src.CategoryName, src.Slug, src.Description, src.SortOrder
    FROM (VALUES
        (N'Nhà bếp', N'nha-bep', N'Thiết bị và đồ dùng nhà bếp.', 1),
        (N'Chăm sóc nhà cửa', N'cham-soc-nha-cua', N'Thiết bị vệ sinh và chăm sóc nhà cửa.', 2),
        (N'Thiết bị làm mát', N'thiet-bi-lam-mat', N'Thiết bị làm mát cho gia đình.', 3),
        (N'Đồ dùng gia đình', N'do-dung-gia-dinh', N'Đồ dùng thiết thực cho gia đình.', 4),
        (N'Máy lọc không khí', N'may-loc-khong-khi', N'Thiết bị lọc không khí.', 5)
    ) AS src(CategoryName, Slug, Description, SortOrder)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Categories c WHERE c.Slug = src.Slug);

    INSERT dbo.Brands (BrandName, Slug)
    SELECT src.BrandName, src.Slug
    FROM (VALUES
        (N'Philips', N'philips'), (N'Electrolux', N'electrolux'), (N'Toshiba', N'toshiba'),
        (N'Panasonic', N'panasonic'), (N'Xiaomi', N'xiaomi'), (N'Sharp', N'sharp'),
        (N'LocknLock', N'locknlock')
    ) AS src(BrandName, Slug)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Brands b WHERE b.Slug = src.Slug);

    INSERT dbo.Products (SKU, ProductName, Description, CategoryId, BrandId, UnitPrice, StockQuantity)
    SELECT src.SKU, src.ProductName, src.Description, c.CategoryId, b.BrandId, src.UnitPrice, 0
    FROM (VALUES
        (N'HN-AIR-001', N'Nồi chiên không dầu 6.2L RapidAir', N'Nồi chiên không dầu dung tích 6.2L.', N'nha-bep', N'philips', CAST(3990000 AS DECIMAL(18,2)), N'/images/air-fryer.jpg', N'Thiết bị gia dụng nhà bếp hiện đại', CAST(3290000 AS DECIMAL(18,2))),
        (N'HN-VAC-001', N'Máy hút bụi không dây PowerClean', N'Máy hút bụi không dây dùng trong gia đình.', N'cham-soc-nha-cua', N'electrolux', CAST(5290000 AS DECIMAL(18,2)), N'/images/vacuum.jpg', N'Máy hút bụi không dây dùng trong gia đình', CAST(4590000 AS DECIMAL(18,2))),
        (N'HN-COF-001', N'Máy pha cà phê bán tự động', N'Thiết bị pha cà phê gia đình.', N'nha-bep', N'toshiba', CAST(890000 AS DECIMAL(18,2)), N'/images/kettle.jpg', N'Máy pha cà phê gia đình trên quầy bếp', CAST(690000 AS DECIMAL(18,2))),
        (N'HN-BLD-001', N'Máy xay sinh tố đa năng 600W', N'Máy xay sinh tố đa năng công suất 600W.', N'nha-bep', N'panasonic', CAST(1190000 AS DECIMAL(18,2)), N'/images/cookware.jpg', N'Máy xay sinh tố gia đình', CAST(0 AS DECIMAL(18,2))),
        (N'HN-RBT-001', N'Robot hút bụi thông minh S10', N'Robot hút bụi tự động cho gia đình.', N'cham-soc-nha-cua', N'xiaomi', CAST(6990000 AS DECIMAL(18,2)), N'/images/robot-vacuum.jpg', N'Robot hút bụi tự động cho gia đình', CAST(5990000 AS DECIMAL(18,2))),
        (N'HN-COO-001', N'Bếp điện mini đa năng', N'Bếp điện mini và nồi nấu đa năng.', N'nha-bep', N'sharp', CAST(1890000 AS DECIMAL(18,2)), N'/images/electric-cooker.jpg', N'Bếp điện mini và nồi nấu đa năng', CAST(0 AS DECIMAL(18,2))),
        (N'HN-AIR-002', N'Máy lọc không khí phòng 30m²', N'Máy lọc không khí phù hợp phòng 30 mét vuông.', N'may-loc-khong-khi', N'xiaomi', CAST(3190000 AS DECIMAL(18,2)), N'/images/air-purifier-real.jpg', N'Máy lọc không khí gia đình', CAST(2790000 AS DECIMAL(18,2))),
        (N'HN-BOX-001', N'Bộ hộp bảo quản thực phẩm 10 món', N'Bộ hộp đựng và bảo quản thực phẩm.', N'do-dung-gia-dinh', N'locknlock', CAST(650000 AS DECIMAL(18,2)), N'/images/food-container.jpg', N'Đồ dùng nhà bếp và hộp đựng thực phẩm', CAST(520000 AS DECIMAL(18,2))),
        (N'HN-FAN-001', N'Quạt đứng inverter 5 cánh êm ái', N'Quạt điện gia đình thiết kế hiện đại.', N'thiet-bi-lam-mat', N'panasonic', CAST(2190000 AS DECIMAL(18,2)), N'/images/fan-real.jpg', N'Quạt điện gia đình thiết kế hiện đại', CAST(1790000 AS DECIMAL(18,2)))
    ) AS src(SKU, ProductName, Description, CategorySlug, BrandSlug, UnitPrice, ImageUrl, AltText, SalePrice)
    JOIN dbo.Categories c ON c.Slug = src.CategorySlug
    JOIN dbo.Brands b ON b.Slug = src.BrandSlug
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.SKU = src.SKU);

    INSERT dbo.ProductImages (ProductId, ImageUrl, AltText, SortOrder, IsPrimary)
    SELECT p.ProductId, src.ImageUrl, src.AltText, 0, 1
    FROM (VALUES
        (N'HN-AIR-001', N'/images/air-fryer.jpg', N'Thiết bị gia dụng nhà bếp hiện đại'),
        (N'HN-VAC-001', N'/images/vacuum.jpg', N'Máy hút bụi không dây dùng trong gia đình'),
        (N'HN-COF-001', N'/images/kettle.jpg', N'Máy pha cà phê gia đình trên quầy bếp'),
        (N'HN-BLD-001', N'/images/cookware.jpg', N'Máy xay sinh tố gia đình'),
        (N'HN-RBT-001', N'/images/robot-vacuum.jpg', N'Robot hút bụi tự động cho gia đình'),
        (N'HN-COO-001', N'/images/electric-cooker.jpg', N'Bếp điện mini và nồi nấu đa năng'),
        (N'HN-AIR-002', N'/images/air-purifier-real.jpg', N'Máy lọc không khí gia đình'),
        (N'HN-BOX-001', N'/images/food-container.jpg', N'Đồ dùng nhà bếp và hộp đựng thực phẩm'),
        (N'HN-FAN-001', N'/images/fan-real.jpg', N'Quạt điện gia đình thiết kế hiện đại')
    ) AS src(SKU, ImageUrl, AltText)
    JOIN dbo.Products p ON p.SKU = src.SKU
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ProductImages i WHERE i.ProductId = p.ProductId AND i.ImageUrl = src.ImageUrl);

    INSERT dbo.Promotions (PromotionCode, PromotionName, Description, DiscountType, DiscountValue, StartsAt, EndsAt, IsActive)
    SELECT src.PromotionCode, src.PromotionName, src.Description, 'AMOUNT', src.DiscountValue,
           CONVERT(DATETIME2(0), '2020-01-01T00:00:00'), CONVERT(DATETIME2(0), '2099-12-31T23:59:59'), 1
    FROM (VALUES
        (N'HN-SEED-AIR-001', N'Ưu đãi Nồi chiên RapidAir', N'Khuyến mãi minh họa theo dữ liệu frontend.', CAST(700000 AS DECIMAL(18,2))),
        (N'HN-SEED-VAC-001', N'Ưu đãi Máy hút bụi PowerClean', N'Khuyến mãi minh họa theo dữ liệu frontend.', CAST(700000 AS DECIMAL(18,2))),
        (N'HN-SEED-COF-001', N'Ưu đãi Máy pha cà phê', N'Khuyến mãi minh họa theo dữ liệu frontend.', CAST(200000 AS DECIMAL(18,2))),
        (N'HN-SEED-RBT-001', N'Ưu đãi Robot hút bụi S10', N'Khuyến mãi minh họa theo dữ liệu frontend.', CAST(1000000 AS DECIMAL(18,2))),
        (N'HN-SEED-AIR-002', N'Ưu đãi Máy lọc không khí', N'Khuyến mãi minh họa theo dữ liệu frontend.', CAST(400000 AS DECIMAL(18,2))),
        (N'HN-SEED-BOX-001', N'Ưu đãi Bộ hộp bảo quản', N'Khuyến mãi minh họa theo dữ liệu frontend.', CAST(130000 AS DECIMAL(18,2))),
        (N'HN-SEED-FAN-001', N'Ưu đãi Quạt đứng inverter', N'Khuyến mãi minh họa theo dữ liệu frontend.', CAST(400000 AS DECIMAL(18,2)))
    ) AS src(PromotionCode, PromotionName, Description, DiscountValue)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Promotions p WHERE p.PromotionCode = src.PromotionCode);

    INSERT dbo.ProductPromotions (ProductId, PromotionId)
    SELECT p.ProductId, pr.PromotionId
    FROM (VALUES
        (N'HN-AIR-001', N'HN-SEED-AIR-001'), (N'HN-VAC-001', N'HN-SEED-VAC-001'),
        (N'HN-COF-001', N'HN-SEED-COF-001'), (N'HN-RBT-001', N'HN-SEED-RBT-001'),
        (N'HN-AIR-002', N'HN-SEED-AIR-002'), (N'HN-BOX-001', N'HN-SEED-BOX-001'),
        (N'HN-FAN-001', N'HN-SEED-FAN-001')
    ) AS src(SKU, PromotionCode)
    JOIN dbo.Products p ON p.SKU = src.SKU
    JOIN dbo.Promotions pr ON pr.PromotionCode = src.PromotionCode
    WHERE NOT EXISTS (SELECT 1 FROM dbo.ProductPromotions pp WHERE pp.ProductId = p.ProductId AND pp.PromotionId = pr.PromotionId);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
