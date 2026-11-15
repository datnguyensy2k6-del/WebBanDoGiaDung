const { sql, createPool } = require('../config/database');

class AdminProductServiceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let poolPromise;

function getPool() {
  if (!poolPromise) {
    const pool = createPool();
    poolPromise = pool.connect()
      .then(() => pool)
      .catch(async (error) => {
        poolPromise = undefined;
        await pool.close().catch(() => {});
        throw error;
      });
  }
  return poolPromise;
}

const PRODUCT_SELECT = `
  SELECT
    product.ProductId AS productId,
    product.SKU AS sku,
    product.ProductName AS productName,
    product.Description AS description,
    product.CategoryId AS categoryId,
    category.CategoryName AS categoryName,
    product.BrandId AS brandId,
    brand.BrandName AS brandName,
    productImage.ImageUrl AS imageUrl,
    product.UnitPrice AS unitPrice,
    product.StockQuantity AS stockQuantity,
    product.IsActive AS isActive,
    product.CreatedAt AS createdAt,
    product.UpdatedAt AS updatedAt
  FROM dbo.Products AS product
  INNER JOIN dbo.Categories AS category ON category.CategoryId = product.CategoryId
  INNER JOIN dbo.Brands AS brand ON brand.BrandId = product.BrandId
  OUTER APPLY (
    SELECT TOP (1) image.ImageUrl
    FROM dbo.ProductImages AS image
    WHERE image.ProductId = product.ProductId
    ORDER BY image.IsPrimary DESC, image.SortOrder ASC, image.ProductImageId ASC
  ) AS productImage
`;

async function savePrimaryProductImage(request, productId, imageUrl, altText) {
  const existing = await request
    .input('imageProductId', sql.Int, productId)
    .query(`
      SELECT TOP (1) ProductImageId AS productImageId
      FROM dbo.ProductImages WITH (UPDLOCK, HOLDLOCK)
      WHERE ProductId = @imageProductId AND IsPrimary = 1;
    `);

  if (imageUrl === null) {
    if (existing.recordset.length) {
      await request
        .input('primaryImageId', sql.Int, existing.recordset[0].productImageId)
        .query('DELETE FROM dbo.ProductImages WHERE ProductImageId = @primaryImageId;');
    }
    return;
  }

  if (existing.recordset.length) {
    await request
      .input('primaryImageId', sql.Int, existing.recordset[0].productImageId)
      .input('imageUrl', sql.NVarChar(500), imageUrl)
      .input('altText', sql.NVarChar(250), altText)
      .query(`
        UPDATE dbo.ProductImages
        SET ImageUrl = @imageUrl, AltText = @altText
        WHERE ProductImageId = @primaryImageId;
      `);
    return;
  }

  await request
    .input('imageUrl', sql.NVarChar(500), imageUrl)
    .input('altText', sql.NVarChar(250), altText)
    .query(`
      INSERT INTO dbo.ProductImages (ProductId, ImageUrl, AltText, SortOrder, IsPrimary)
      VALUES (@imageProductId, @imageUrl, @altText, 0, 1);
    `);
}

async function readProduct(request, productId) {
  const result = await request
    .input('productId', sql.Int, productId)
    .query(`${PRODUCT_SELECT} WHERE product.ProductId = @productId;`);
  if (result.recordset.length === 0) {
    throw new AdminProductServiceError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
  }
  return result.recordset[0];
}

async function assertActiveCategoryAndBrand(request, categoryId, brandId) {
  const category = await request
    .input('categoryId', sql.Int, categoryId)
    .query(`SELECT CategoryId FROM dbo.Categories WHERE CategoryId = @categoryId AND IsActive = 1;`);
  if (category.recordset.length === 0) {
    throw new AdminProductServiceError(400, 'INVALID_CATEGORY', 'Danh mục không tồn tại hoặc đã ngừng hoạt động.');
  }

  const brand = await request
    .input('brandId', sql.Int, brandId)
    .query(`SELECT BrandId FROM dbo.Brands WHERE BrandId = @brandId AND IsActive = 1;`);
  if (brand.recordset.length === 0) {
    throw new AdminProductServiceError(400, 'INVALID_BRAND', 'Thương hiệu không tồn tại hoặc đã ngừng hoạt động.');
  }
}

async function assertCategoryAndBrandForExistingProduct(request, categoryId, brandId, current) {
  const category = await request
    .input('categoryId', sql.Int, categoryId)
    .input('currentCategoryId', sql.Int, current.categoryId)
    .query(`SELECT CategoryId FROM dbo.Categories WHERE CategoryId = @categoryId AND (IsActive = 1 OR CategoryId = @currentCategoryId);`);
  if (category.recordset.length === 0) {
    throw new AdminProductServiceError(400, 'INVALID_CATEGORY', 'Danh mục không tồn tại hoặc đã ngừng hoạt động.');
  }

  const brand = await request
    .input('brandId', sql.Int, brandId)
    .input('currentBrandId', sql.Int, current.brandId)
    .query(`SELECT BrandId FROM dbo.Brands WHERE BrandId = @brandId AND (IsActive = 1 OR BrandId = @currentBrandId);`);
  if (brand.recordset.length === 0) {
    throw new AdminProductServiceError(400, 'INVALID_BRAND', 'Thương hiệu không tồn tại hoặc đã ngừng hoạt động.');
  }
}

async function listAdminProducts({ page, pageSize, search, isActive }) {
  const pool = await getPool();
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset) || offset > 2147483647) {
    throw new AdminProductServiceError(400, 'INVALID_PAGINATION', 'Trang nằm ngoài giới hạn cho phép.');
  }

  const conditions = [];
  const countRequest = pool.request();
  const listRequest = pool.request()
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, pageSize);

  if (search) {
    const escapedSearch = search.replace(/[%_~]/g, '~$&').replace(/\[/g, '~[');
    const pattern = `%${escapedSearch}%`;
    conditions.push("(product.ProductName LIKE @search ESCAPE '~' OR product.SKU LIKE @search ESCAPE '~')");
    countRequest.input('search', sql.NVarChar(520), pattern);
    listRequest.input('search', sql.NVarChar(520), pattern);
  }
  if (isActive !== undefined) {
    conditions.push('product.IsActive = @isActive');
    countRequest.input('isActive', sql.Bit, isActive);
    listRequest.input('isActive', sql.Bit, isActive);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = await countRequest.query(`
    SELECT COUNT_BIG(*) AS totalCount
    FROM dbo.Products AS product
    ${whereClause};
  `);
  const products = await listRequest.query(`
    ${PRODUCT_SELECT}
    ${whereClause}
    ORDER BY product.CreatedAt DESC, product.ProductId DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
  `);

  return {
    page,
    pageSize,
    totalCount: Number(total.recordset[0].totalCount),
    data: products.recordset,
  };
}

async function getAdminProduct(productId) {
  const pool = await getPool();
  return readProduct(pool.request(), productId);
}

async function createAdminProduct(input, adminUserId) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;
    await assertActiveCategoryAndBrand(transaction.request(), input.categoryId, input.brandId);

    const inserted = await transaction.request()
      .input('sku', sql.NVarChar(60), input.sku)
      .input('productName', sql.NVarChar(200), input.productName)
      .input('description', sql.NVarChar(sql.MAX), input.description)
      .input('categoryId', sql.Int, input.categoryId)
      .input('brandId', sql.Int, input.brandId)
      .input('unitPrice', sql.Decimal(18, 2), input.unitPrice)
      .input('stockQuantity', sql.Int, input.stockQuantity)
      .query(`
        INSERT INTO dbo.Products (SKU, ProductName, Description, CategoryId, BrandId, UnitPrice, StockQuantity)
        OUTPUT INSERTED.ProductId AS productId
        VALUES (@sku, @productName, @description, @categoryId, @brandId, @unitPrice, @stockQuantity);
      `);
    const productId = inserted.recordset[0].productId;

    if (input.imageUrl) {
      await savePrimaryProductImage(transaction.request(), productId, input.imageUrl, input.productName);
    }

    if (input.stockQuantity > 0) {
      await transaction.request()
        .input('productId', sql.Int, productId)
        .input('quantityChange', sql.Int, input.stockQuantity)
        .input('adminUserId', sql.Int, adminUserId)
        .query(`
          INSERT INTO dbo.InventoryTransactions (ProductId, QuantityChange, Reason, Note, CreatedByUserId)
          VALUES (@productId, @quantityChange, 'RESTOCK', N'Initial stock on product creation.', @adminUserId);
        `);
    }

    const product = await readProduct(transaction.request(), productId);
    await transaction.commit();
    return product;
  } catch (error) {
    if (transactionStarted) await transaction.rollback().catch(() => {});
    if (error.number === 2601 || error.number === 2627) {
      throw new AdminProductServiceError(409, 'SKU_ALREADY_EXISTS', 'SKU này đã được sử dụng.');
    }
    throw error;
  }
}

async function updateAdminProduct(productId, changes) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;

    if (changes.categoryId !== undefined || changes.brandId !== undefined) {
      const current = await transaction.request()
        .input('productId', sql.Int, productId)
        .query('SELECT CategoryId AS categoryId, BrandId AS brandId FROM dbo.Products WITH (UPDLOCK, HOLDLOCK) WHERE ProductId = @productId;');
      if (current.recordset.length === 0) {
        throw new AdminProductServiceError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
      }
      await assertCategoryAndBrandForExistingProduct(
        transaction.request(),
        changes.categoryId ?? current.recordset[0].categoryId,
        changes.brandId ?? current.recordset[0].brandId,
        current.recordset[0],
      );
    }

    if (changes.imageUrl !== undefined) {
      const product = await transaction.request()
        .input('productId', sql.Int, productId)
        .query('SELECT ProductName AS productName FROM dbo.Products WITH (UPDLOCK, HOLDLOCK) WHERE ProductId = @productId;');
      if (product.recordset.length === 0) {
        throw new AdminProductServiceError(404, 'PRODUCT_NOT_FOUND', 'KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m.');
      }
      await savePrimaryProductImage(
        transaction.request(),
        productId,
        changes.imageUrl,
        changes.productName ?? product.recordset[0].productName,
      );
    }

    const request = transaction.request().input('productId', sql.Int, productId);
    const assignments = [];
    if (changes.sku !== undefined) {
      request.input('sku', sql.NVarChar(60), changes.sku);
      assignments.push('SKU = @sku');
    }
    if (changes.productName !== undefined) {
      request.input('productName', sql.NVarChar(200), changes.productName);
      assignments.push('ProductName = @productName');
    }
    if (changes.description !== undefined) {
      request.input('description', sql.NVarChar(sql.MAX), changes.description);
      assignments.push('Description = @description');
    }
    if (changes.categoryId !== undefined) {
      request.input('categoryId', sql.Int, changes.categoryId);
      assignments.push('CategoryId = @categoryId');
    }
    if (changes.brandId !== undefined) {
      request.input('brandId', sql.Int, changes.brandId);
      assignments.push('BrandId = @brandId');
    }
    if (changes.unitPrice !== undefined) {
      request.input('unitPrice', sql.Decimal(18, 2), changes.unitPrice);
      assignments.push('UnitPrice = @unitPrice');
    }
    assignments.push('UpdatedAt = SYSUTCDATETIME()');

    const updated = await request.query(`
      UPDATE dbo.Products
      SET ${assignments.join(', ')}
      WHERE ProductId = @productId;
    `);
    if (updated.rowsAffected[0] === 0) {
      throw new AdminProductServiceError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
    }

    const product = await readProduct(transaction.request(), productId);
    await transaction.commit();
    return product;
  } catch (error) {
    if (transactionStarted) await transaction.rollback().catch(() => {});
    if (error.number === 2601 || error.number === 2627) {
      throw new AdminProductServiceError(409, 'SKU_ALREADY_EXISTS', 'SKU này đã được sử dụng.');
    }
    if (error.number === 1205) {
      throw new AdminProductServiceError(409, 'PRODUCT_CONFLICT', 'Sản phẩm đang được cập nhật đồng thời. Vui lòng thử lại.');
    }
    throw error;
  }
}

async function updateAdminProductStock(productId, stockQuantity, adminUserId) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;
    const current = await transaction.request()
      .input('productId', sql.Int, productId)
      .query('SELECT StockQuantity AS stockQuantity FROM dbo.Products WITH (UPDLOCK, HOLDLOCK) WHERE ProductId = @productId;');
    if (current.recordset.length === 0) {
      throw new AdminProductServiceError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
    }

    const oldQuantity = current.recordset[0].stockQuantity;
    const quantityChange = stockQuantity - oldQuantity;
    if (quantityChange !== 0) {
      await transaction.request()
        .input('productId', sql.Int, productId)
        .input('stockQuantity', sql.Int, stockQuantity)
        .input('quantityChange', sql.Int, quantityChange)
        .input('reason', sql.VarChar(20), quantityChange > 0 ? 'RESTOCK' : 'ADJUSTMENT')
        .input('adminUserId', sql.Int, adminUserId)
        .query(`
          UPDATE dbo.Products
          SET StockQuantity = @stockQuantity, UpdatedAt = SYSUTCDATETIME()
          WHERE ProductId = @productId;

          INSERT INTO dbo.InventoryTransactions (ProductId, QuantityChange, Reason, Note, CreatedByUserId)
          VALUES (@productId, @quantityChange, @reason, N'Admin stock adjustment.', @adminUserId);
        `);
    }

    const product = await readProduct(transaction.request(), productId);
    await transaction.commit();
    return product;
  } catch (error) {
    if (transactionStarted) await transaction.rollback().catch(() => {});
    if (error.number === 1205) {
      throw new AdminProductServiceError(409, 'PRODUCT_CONFLICT', 'Tồn kho đang được cập nhật đồng thời. Vui lòng thử lại.');
    }
    throw error;
  }
}

async function setAdminProductStatus(productId, isActive) {
  const pool = await getPool();
  const result = await pool.request()
    .input('productId', sql.Int, productId)
    .input('isActive', sql.Bit, isActive)
    .query(`
      UPDATE dbo.Products
      SET IsActive = @isActive, UpdatedAt = SYSUTCDATETIME()
      WHERE ProductId = @productId;
    `);
  if (result.rowsAffected[0] === 0) {
    throw new AdminProductServiceError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
  }
  return getAdminProduct(productId);
}

module.exports = {
  AdminProductServiceError,
  createAdminProduct,
  getAdminProduct,
  listAdminProducts,
  setAdminProductStatus,
  updateAdminProduct,
  updateAdminProductStock,
};
