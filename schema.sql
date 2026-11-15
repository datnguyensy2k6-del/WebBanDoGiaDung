/* HomeNest schema proposal for SQL Server. Design only: do not run before review. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

/* Fail closed when any target name already exists; this script never alters or drops it. */
IF OBJECT_ID(N'dbo.Roles', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.UserRoles', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.UserAddresses', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.Categories', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.Brands', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.Products', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.ProductImages', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.Promotions', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.ProductPromotions', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.Carts', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.CartItems', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.Wishlists', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.Orders', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.OrderItems', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.OrderStatusHistory', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.Payments', N'U') IS NOT NULL
 OR OBJECT_ID(N'dbo.InventoryTransactions', N'U') IS NOT NULL
BEGIN
    ;THROW 51000, 'A HomeNest target table already exists in dbo. Inspect the existing schema and prepare a reviewed migration; no changes were made.', 1;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    CREATE TABLE dbo.Roles (
        RoleId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
        RoleCode NVARCHAR(30) NOT NULL,
        RoleName NVARCHAR(80) NOT NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Roles_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Roles_RoleCode UNIQUE (RoleCode)
    );

    CREATE TABLE dbo.Users (
        UserId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
        Email NVARCHAR(320) NOT NULL,
        PasswordHash NVARCHAR(255) NOT NULL,
        FullName NVARCHAR(150) NOT NULL,
        Phone NVARCHAR(30) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Users_Email UNIQUE (Email)
    );

    CREATE TABLE dbo.UserRoles (
        UserId INT NOT NULL,
        RoleId INT NOT NULL,
        AssignedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserRoles_AssignedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
        CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId)
    );

    CREATE TABLE dbo.UserAddresses (
        AddressId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserAddresses PRIMARY KEY,
        UserId INT NOT NULL,
        RecipientName NVARCHAR(150) NOT NULL,
        Phone NVARCHAR(30) NOT NULL,
        Province NVARCHAR(100) NOT NULL,
        District NVARCHAR(100) NOT NULL,
        Ward NVARCHAR(100) NOT NULL,
        AddressLine NVARCHAR(250) NOT NULL,
        IsDefault BIT NOT NULL CONSTRAINT DF_UserAddresses_IsDefault DEFAULT (0),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserAddresses_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserAddresses_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_UserAddresses_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
    );
    CREATE UNIQUE INDEX UX_UserAddresses_DefaultPerUser ON dbo.UserAddresses(UserId) WHERE IsDefault = 1;

    CREATE TABLE dbo.Categories (
        CategoryId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Categories PRIMARY KEY,
        ParentCategoryId INT NULL,
        CategoryName NVARCHAR(120) NOT NULL,
        Slug NVARCHAR(140) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Categories_IsActive DEFAULT (1),
        SortOrder INT NOT NULL CONSTRAINT DF_Categories_SortOrder DEFAULT (0),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Categories_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Categories_Slug UNIQUE (Slug),
        CONSTRAINT FK_Categories_Parent FOREIGN KEY (ParentCategoryId) REFERENCES dbo.Categories(CategoryId),
        CONSTRAINT CK_Categories_NotSelfParent CHECK (ParentCategoryId IS NULL OR ParentCategoryId <> CategoryId)
    );

    CREATE TABLE dbo.Brands (
        BrandId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Brands PRIMARY KEY,
        BrandName NVARCHAR(120) NOT NULL,
        Slug NVARCHAR(140) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Brands_IsActive DEFAULT (1),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Brands_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Brands_BrandName UNIQUE (BrandName),
        CONSTRAINT UQ_Brands_Slug UNIQUE (Slug)
    );

    CREATE TABLE dbo.Products (
        ProductId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Products PRIMARY KEY,
        SKU NVARCHAR(60) NOT NULL,
        ProductName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        CategoryId INT NOT NULL,
        BrandId INT NOT NULL,
        UnitPrice DECIMAL(18,2) NOT NULL,
        StockQuantity INT NOT NULL CONSTRAINT DF_Products_StockQuantity DEFAULT (0),
        IsActive BIT NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT (1),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Products_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Products_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Products_SKU UNIQUE (SKU),
        CONSTRAINT CK_Products_UnitPrice CHECK (UnitPrice >= 0),
        CONSTRAINT CK_Products_StockQuantity CHECK (StockQuantity >= 0),
        CONSTRAINT FK_Products_Categories FOREIGN KEY (CategoryId) REFERENCES dbo.Categories(CategoryId),
        CONSTRAINT FK_Products_Brands FOREIGN KEY (BrandId) REFERENCES dbo.Brands(BrandId)
    );
    CREATE INDEX IX_Products_CategoryActive ON dbo.Products(CategoryId, IsActive);
    CREATE INDEX IX_Products_BrandActive ON dbo.Products(BrandId, IsActive);

    CREATE TABLE dbo.ProductImages (
        ProductImageId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductImages PRIMARY KEY,
        ProductId INT NOT NULL,
        ImageUrl NVARCHAR(500) NOT NULL,
        AltText NVARCHAR(250) NULL,
        SortOrder INT NOT NULL CONSTRAINT DF_ProductImages_SortOrder DEFAULT (0),
        IsPrimary BIT NOT NULL CONSTRAINT DF_ProductImages_IsPrimary DEFAULT (0),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ProductImages_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ProductImages_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId)
    );
    CREATE INDEX IX_ProductImages_ProductSort ON dbo.ProductImages(ProductId, SortOrder);
    CREATE UNIQUE INDEX UX_ProductImages_PrimaryPerProduct ON dbo.ProductImages(ProductId) WHERE IsPrimary = 1;

    CREATE TABLE dbo.Promotions (
        PromotionId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Promotions PRIMARY KEY,
        PromotionCode NVARCHAR(50) NOT NULL,
        PromotionName NVARCHAR(150) NOT NULL,
        Description NVARCHAR(500) NULL,
        DiscountType VARCHAR(10) NOT NULL,
        DiscountValue DECIMAL(18,2) NOT NULL,
        StartsAt DATETIME2(0) NOT NULL,
        EndsAt DATETIME2(0) NOT NULL,
        MaxDiscountAmount DECIMAL(18,2) NULL,
        MaxUses INT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Promotions_IsActive DEFAULT (1),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Promotions_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Promotions_Code UNIQUE (PromotionCode),
        CONSTRAINT CK_Promotions_DiscountType CHECK (DiscountType IN ('PERCENT', 'AMOUNT')),
        CONSTRAINT CK_Promotions_DiscountValue CHECK ((DiscountType = 'PERCENT' AND DiscountValue > 0 AND DiscountValue <= 100) OR (DiscountType = 'AMOUNT' AND DiscountValue > 0)),
        CONSTRAINT CK_Promotions_Dates CHECK (EndsAt > StartsAt),
        CONSTRAINT CK_Promotions_Limits CHECK ((MaxDiscountAmount IS NULL OR MaxDiscountAmount >= 0) AND (MaxUses IS NULL OR MaxUses > 0))
    );

    CREATE TABLE dbo.ProductPromotions (
        ProductId INT NOT NULL,
        PromotionId INT NOT NULL,
        MaxDiscountAmount DECIMAL(18,2) NULL,
        CONSTRAINT PK_ProductPromotions PRIMARY KEY (ProductId, PromotionId),
        CONSTRAINT CK_ProductPromotions_MaxDiscount CHECK (MaxDiscountAmount IS NULL OR MaxDiscountAmount >= 0),
        CONSTRAINT FK_ProductPromotions_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId),
        CONSTRAINT FK_ProductPromotions_Promotions FOREIGN KEY (PromotionId) REFERENCES dbo.Promotions(PromotionId)
    );
    CREATE INDEX IX_ProductPromotions_Promotion ON dbo.ProductPromotions(PromotionId, ProductId);

    CREATE TABLE dbo.Carts (
        CartId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Carts PRIMARY KEY,
        UserId INT NOT NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Carts_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Carts_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Carts_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
    );
    CREATE UNIQUE INDEX UX_Carts_OnePerUser ON dbo.Carts(UserId);

    CREATE TABLE dbo.CartItems (
        CartId INT NOT NULL,
        ProductId INT NOT NULL,
        Quantity INT NOT NULL,
        AddedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CartItems_AddedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CartItems_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_CartItems PRIMARY KEY (CartId, ProductId),
        CONSTRAINT CK_CartItems_Quantity CHECK (Quantity > 0),
        CONSTRAINT FK_CartItems_Carts FOREIGN KEY (CartId) REFERENCES dbo.Carts(CartId),
        CONSTRAINT FK_CartItems_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId)
    );
    CREATE INDEX IX_CartItems_Product ON dbo.CartItems(ProductId);

    CREATE TABLE dbo.Wishlists (
        UserId INT NOT NULL,
        ProductId INT NOT NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Wishlists_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Wishlists PRIMARY KEY (UserId, ProductId),
        CONSTRAINT FK_Wishlists_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_Wishlists_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId)
    );
    CREATE INDEX IX_Wishlists_Product ON dbo.Wishlists(ProductId);

    CREATE TABLE dbo.Orders (
        OrderId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
        OrderNumber NVARCHAR(40) NOT NULL,
        UserId INT NOT NULL,
        OrderStatus VARCHAR(30) NOT NULL CONSTRAINT DF_Orders_OrderStatus DEFAULT ('PENDING_CONFIRMATION'),
        PaymentMethod VARCHAR(10) NOT NULL,
        RecipientName NVARCHAR(150) NOT NULL,
        RecipientPhone NVARCHAR(30) NOT NULL,
        ShippingProvince NVARCHAR(100) NOT NULL,
        ShippingDistrict NVARCHAR(100) NOT NULL,
        ShippingWard NVARCHAR(100) NOT NULL,
        ShippingAddressLine NVARCHAR(250) NOT NULL,
        CustomerNote NVARCHAR(1000) NULL,
        Subtotal DECIMAL(18,2) NOT NULL,
        DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_DiscountAmount DEFAULT (0),
        ShippingFee DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_ShippingFee DEFAULT (0),
        TotalAmount DECIMAL(18,2) NOT NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Orders_OrderNumber UNIQUE (OrderNumber),
        CONSTRAINT CK_Orders_Status CHECK (OrderStatus IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED')),
        CONSTRAINT CK_Orders_PaymentMethod CHECK (PaymentMethod IN ('COD', 'ONLINE')),
        CONSTRAINT CK_Orders_Amounts CHECK (Subtotal >= 0 AND DiscountAmount >= 0 AND ShippingFee >= 0 AND TotalAmount >= 0 AND TotalAmount = Subtotal - DiscountAmount + ShippingFee),
        CONSTRAINT FK_Orders_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId)
    );
    CREATE INDEX IX_Orders_UserCreated ON dbo.Orders(UserId, CreatedAt DESC);
    CREATE INDEX IX_Orders_StatusCreated ON dbo.Orders(OrderStatus, CreatedAt DESC);

    CREATE TABLE dbo.OrderItems (
        OrderItemId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderItems PRIMARY KEY,
        OrderId INT NOT NULL,
        ProductId INT NULL,
        SKUSnapshot NVARCHAR(60) NOT NULL,
        ProductNameSnapshot NVARCHAR(200) NOT NULL,
        UnitPrice DECIMAL(18,2) NOT NULL,
        Quantity INT NOT NULL,
        DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_OrderItems_DiscountAmount DEFAULT (0),
        LineTotal DECIMAL(18,2) NOT NULL,
        CONSTRAINT CK_OrderItems_Amounts CHECK (UnitPrice >= 0 AND Quantity > 0 AND DiscountAmount >= 0 AND DiscountAmount <= UnitPrice AND LineTotal = (UnitPrice - DiscountAmount) * Quantity),
        CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId),
        CONSTRAINT FK_OrderItems_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId) ON DELETE SET NULL
    );
    CREATE INDEX IX_OrderItems_Order ON dbo.OrderItems(OrderId);
    CREATE INDEX IX_OrderItems_Product ON dbo.OrderItems(ProductId);

    CREATE TABLE dbo.OrderStatusHistory (
        OrderStatusHistoryId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderStatusHistory PRIMARY KEY,
        OrderId INT NOT NULL,
        OldStatus VARCHAR(30) NULL,
        NewStatus VARCHAR(30) NOT NULL,
        Note NVARCHAR(500) NULL,
        ChangedByUserId INT NULL,
        ChangedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OrderStatusHistory_ChangedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_OrderStatusHistory_NewStatus CHECK (NewStatus IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED')),
        CONSTRAINT CK_OrderStatusHistory_OldStatus CHECK (OldStatus IS NULL OR OldStatus IN ('PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'CANCELLED')),
        CONSTRAINT FK_OrderStatusHistory_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId),
        CONSTRAINT FK_OrderStatusHistory_Users FOREIGN KEY (ChangedByUserId) REFERENCES dbo.Users(UserId)
    );
    CREATE INDEX IX_OrderStatusHistory_OrderChanged ON dbo.OrderStatusHistory(OrderId, ChangedAt);

    CREATE TABLE dbo.Payments (
        PaymentId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Payments PRIMARY KEY,
        OrderId INT NOT NULL,
        AttemptNumber INT NOT NULL,
        PaymentMethod VARCHAR(10) NOT NULL,
        PaymentStatus VARCHAR(10) NOT NULL CONSTRAINT DF_Payments_PaymentStatus DEFAULT ('PENDING'),
        Amount DECIMAL(18,2) NOT NULL,
        ProcessedByUserId INT NULL,
        ProcessedAt DATETIME2(0) NULL,
        Note NVARCHAR(500) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Payments_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Payments_OrderAttempt UNIQUE (OrderId, AttemptNumber),
        CONSTRAINT CK_Payments_Attempt CHECK (AttemptNumber > 0),
        CONSTRAINT CK_Payments_Method CHECK (PaymentMethod IN ('COD', 'ONLINE')),
        CONSTRAINT CK_Payments_Status CHECK (PaymentStatus IN ('PENDING', 'SUCCESS', 'FAILED')),
        CONSTRAINT CK_Payments_Amount CHECK (Amount >= 0),
        CONSTRAINT CK_Payments_CODSingleAttempt CHECK (PaymentMethod <> 'COD' OR AttemptNumber = 1),
        CONSTRAINT FK_Payments_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId),
        CONSTRAINT FK_Payments_Users FOREIGN KEY (ProcessedByUserId) REFERENCES dbo.Users(UserId)
    );
    CREATE INDEX IX_Payments_OrderStatus ON dbo.Payments(OrderId, PaymentStatus);

    CREATE TABLE dbo.InventoryTransactions (
        InventoryTransactionId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_InventoryTransactions PRIMARY KEY,
        ProductId INT NOT NULL,
        OrderId INT NULL,
        QuantityChange INT NOT NULL,
        Reason VARCHAR(20) NOT NULL,
        Note NVARCHAR(500) NULL,
        CreatedByUserId INT NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_InventoryTransactions_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_InventoryTransactions_Quantity CHECK (QuantityChange <> 0),
        CONSTRAINT CK_InventoryTransactions_Reason CHECK (Reason IN ('RESTOCK', 'ORDER', 'CANCEL_RETURN', 'ADJUSTMENT')),
        CONSTRAINT FK_InventoryTransactions_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId),
        CONSTRAINT FK_InventoryTransactions_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId),
        CONSTRAINT FK_InventoryTransactions_Users FOREIGN KEY (CreatedByUserId) REFERENCES dbo.Users(UserId)
    );
    CREATE INDEX IX_InventoryTransactions_ProductCreated ON dbo.InventoryTransactions(ProductId, CreatedAt DESC);
    CREATE INDEX IX_InventoryTransactions_Order ON dbo.InventoryTransactions(OrderId) WHERE OrderId IS NOT NULL;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
