const { sql, createPool } = require('../config/database');

class CartServiceError extends Error {
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

async function getOrCreateCart(transaction, userId) {
  const user = await transaction.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT UserId
      FROM dbo.Users WITH (UPDLOCK, HOLDLOCK)
      WHERE UserId = @userId AND IsActive = 1;
    `);

  if (user.recordset.length === 0) {
    throw new CartServiceError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng đang hoạt động.');
  }

  // HOLDLOCK takes a serializable key-range lock on the unique UserId index,
  // so concurrent requests cannot create duplicate carts for this user.
  const current = await transaction.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT CartId AS cartId
      FROM dbo.Carts WITH (UPDLOCK, HOLDLOCK, INDEX(UX_Carts_OnePerUser))
      WHERE UserId = @userId;
    `);

  if (current.recordset.length > 0) return current.recordset[0].cartId;

  const created = await transaction.request()
    .input('userId', sql.Int, userId)
    .query(`
      INSERT INTO dbo.Carts (UserId)
      OUTPUT INSERTED.CartId AS cartId
      VALUES (@userId);
    `);

  return created.recordset[0].cartId;
}

async function withUserCart(userId, action) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;
    const cartId = await getOrCreateCart(transaction, userId);
    const result = await action(transaction, cartId);
    await transaction.commit();
    return result;
  } catch (error) {
    if (transactionStarted) await transaction.rollback().catch(() => {});
    throw error;
  }
}

async function getProductForCart(transaction, productId) {
  const result = await transaction.request()
    .input('productId', sql.Int, productId)
    .query(`
      SELECT ProductId AS productId,
             IsActive AS isActive,
             StockQuantity AS stockQuantity
      FROM dbo.Products WITH (UPDLOCK, HOLDLOCK)
      WHERE ProductId = @productId;
    `);

  if (result.recordset.length === 0) {
    throw new CartServiceError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
  }

  const product = result.recordset[0];
  if (!product.isActive) {
    throw new CartServiceError(409, 'PRODUCT_INACTIVE', 'Sản phẩm đã ngừng hoạt động và không thể thêm hoặc cập nhật trong giỏ.');
  }
  return product;
}

async function getUserCart(userId) {
  return withUserCart(userId, async (transaction, cartId) => {
    const result = await transaction.request()
      .input('cartId', sql.Int, cartId)
      .query(`
        SELECT
          c.CartId AS cartId,
          c.UpdatedAt AS updatedAt,
          ci.ProductId AS productId,
          p.SKU AS sku,
          p.ProductName AS productName,
          p.UnitPrice AS unitPrice,
          productImage.ImageUrl AS imageUrl,
          p.IsActive AS isActive,
          p.StockQuantity AS stockQuantity,
          ci.Quantity AS quantity,
          CAST(p.UnitPrice * ci.Quantity AS DECIMAL(18,2)) AS subtotal,
          ci.AddedAt AS addedAt,
          ci.UpdatedAt AS itemUpdatedAt
        FROM dbo.Carts AS c
        LEFT JOIN dbo.CartItems AS ci ON ci.CartId = c.CartId
        LEFT JOIN dbo.Products AS p ON p.ProductId = ci.ProductId
        OUTER APPLY (
          SELECT TOP (1) image.ImageUrl
          FROM dbo.ProductImages AS image
          WHERE image.ProductId = p.ProductId
          ORDER BY image.IsPrimary DESC, image.SortOrder ASC, image.ProductImageId ASC
        ) AS productImage
        WHERE c.CartId = @cartId
        ORDER BY ci.AddedAt ASC, ci.ProductId ASC;
      `);
    const totalResult = await transaction.request()
      .input('cartId', sql.Int, cartId)
      .query(`
        SELECT COALESCE(SUM(CAST(p.UnitPrice * ci.Quantity AS DECIMAL(18,2))), 0) AS subtotal
        FROM dbo.CartItems AS ci
        INNER JOIN dbo.Products AS p ON p.ProductId = ci.ProductId
        WHERE ci.CartId = @cartId;
      `);

    const first = result.recordset[0];
    const items = result.recordset
      .filter((row) => row.productId !== null)
      .map((row) => ({
        productId: row.productId,
        sku: row.sku,
        productName: row.productName,
        unitPrice: row.unitPrice,
        imageUrl: row.imageUrl,
        isActive: row.isActive,
        stockQuantity: row.stockQuantity,
        quantity: row.quantity,
        subtotal: row.subtotal,
        addedAt: row.addedAt,
        updatedAt: row.itemUpdatedAt,
      }));

    return {
      cartId: first.cartId,
      updatedAt: first.updatedAt,
      items,
      subtotal: totalResult.recordset[0].subtotal,
    };
  });
}

async function addProduct(userId, productId, quantity) {
  return withUserCart(userId, async (transaction, cartId) => {
    const product = await getProductForCart(transaction, productId);
    const existing = await transaction.request()
      .input('cartId', sql.Int, cartId)
      .input('productId', sql.Int, productId)
      .query(`
        SELECT Quantity AS quantity
        FROM dbo.CartItems WITH (UPDLOCK, HOLDLOCK)
        WHERE CartId = @cartId AND ProductId = @productId;
      `);

    const nextQuantity = (existing.recordset[0]?.quantity || 0) + quantity;
    if (!Number.isSafeInteger(nextQuantity) || nextQuantity > product.stockQuantity) {
      throw new CartServiceError(409, 'INSUFFICIENT_STOCK', 'Số lượng yêu cầu vượt quá tồn kho hiện tại.');
    }

    if (existing.recordset.length > 0) {
      await transaction.request()
        .input('cartId', sql.Int, cartId)
        .input('productId', sql.Int, productId)
        .input('quantity', sql.Int, nextQuantity)
        .query(`
          UPDATE dbo.CartItems
          SET Quantity = @quantity, UpdatedAt = SYSUTCDATETIME()
          WHERE CartId = @cartId AND ProductId = @productId;
        `);
    } else {
      await transaction.request()
        .input('cartId', sql.Int, cartId)
        .input('productId', sql.Int, productId)
        .input('quantity', sql.Int, quantity)
        .query(`INSERT INTO dbo.CartItems (CartId, ProductId, Quantity) VALUES (@cartId, @productId, @quantity);`);
    }

    await touchCart(transaction, cartId);
    return getCartItem(transaction, cartId, productId);
  });
}

async function updateProductQuantity(userId, productId, quantity) {
  return withUserCart(userId, async (transaction, cartId) => {
    const product = await getProductForCart(transaction, productId);
    if (quantity > product.stockQuantity) {
      throw new CartServiceError(409, 'INSUFFICIENT_STOCK', 'Số lượng yêu cầu vượt quá tồn kho hiện tại.');
    }

    const result = await transaction.request()
      .input('cartId', sql.Int, cartId)
      .input('productId', sql.Int, productId)
      .input('quantity', sql.Int, quantity)
      .query(`
        UPDATE dbo.CartItems WITH (UPDLOCK, HOLDLOCK)
        SET Quantity = @quantity, UpdatedAt = SYSUTCDATETIME()
        WHERE CartId = @cartId AND ProductId = @productId;
      `);

    if (result.rowsAffected[0] === 0) {
      throw new CartServiceError(404, 'CART_ITEM_NOT_FOUND', 'Sản phẩm không có trong giỏ hàng.');
    }

    await touchCart(transaction, cartId);
    return getCartItem(transaction, cartId, productId);
  });
}

async function getCartItem(transaction, cartId, productId) {
  const result = await transaction.request()
    .input('cartId', sql.Int, cartId)
    .input('productId', sql.Int, productId)
    .query(`
      SELECT
        ci.ProductId AS productId,
        p.SKU AS sku,
        p.ProductName AS productName,
        p.UnitPrice AS unitPrice,
        productImage.ImageUrl AS imageUrl,
        p.IsActive AS isActive,
        p.StockQuantity AS stockQuantity,
        ci.Quantity AS quantity,
        CAST(p.UnitPrice * ci.Quantity AS DECIMAL(18,2)) AS subtotal,
        ci.AddedAt AS addedAt,
        ci.UpdatedAt AS updatedAt
      FROM dbo.CartItems AS ci
      INNER JOIN dbo.Products AS p ON p.ProductId = ci.ProductId
      OUTER APPLY (
        SELECT TOP (1) image.ImageUrl
        FROM dbo.ProductImages AS image
        WHERE image.ProductId = p.ProductId
        ORDER BY image.IsPrimary DESC, image.SortOrder ASC, image.ProductImageId ASC
      ) AS productImage
      WHERE ci.CartId = @cartId AND ci.ProductId = @productId;
    `);
    return result.recordset[0];
}

async function touchCart(transaction, cartId) {
  await transaction.request()
    .input('cartId', sql.Int, cartId)
    .query('UPDATE dbo.Carts SET UpdatedAt = SYSUTCDATETIME() WHERE CartId = @cartId;');
}

async function removeProduct(userId, productId) {
  return withUserCart(userId, async (transaction, cartId) => {
    const result = await transaction.request()
      .input('cartId', sql.Int, cartId)
      .input('productId', sql.Int, productId)
      .query('DELETE FROM dbo.CartItems WHERE CartId = @cartId AND ProductId = @productId;');

    if (result.rowsAffected[0] === 0) {
      throw new CartServiceError(404, 'CART_ITEM_NOT_FOUND', 'Sản phẩm không có trong giỏ hàng.');
    }
    await touchCart(transaction, cartId);
    return { productId, removed: true };
  });
}

async function clearUserCart(userId) {
  return withUserCart(userId, async (transaction, cartId) => {
    const result = await transaction.request()
      .input('cartId', sql.Int, cartId)
      .query('DELETE FROM dbo.CartItems WHERE CartId = @cartId;');
    await touchCart(transaction, cartId);
    return { removedCount: result.rowsAffected[0] || 0 };
  });
}

module.exports = { addProduct, clearUserCart, getUserCart, removeProduct, updateProductQuantity };
