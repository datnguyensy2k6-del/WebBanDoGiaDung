const { randomUUID } = require('node:crypto');
const { sql, createPool } = require('../config/database');

class OrderServiceError extends Error {
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

async function lockActiveUser(transaction, userId) {
  const result = await transaction.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT UserId
      FROM dbo.Users WITH (UPDLOCK, HOLDLOCK)
      WHERE UserId = @userId AND IsActive = 1;
    `);
  if (result.recordset.length === 0) {
    throw new OrderServiceError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng đang hoạt động.');
  }
}

function orderHeaderQuery(whereClause) {
  return `
    SELECT
      OrderId AS orderId,
      OrderNumber AS orderNumber,
      OrderStatus AS orderStatus,
      PaymentMethod AS paymentMethod,
      RecipientName AS recipientName,
      RecipientPhone AS recipientPhone,
      ShippingProvince AS shippingProvince,
      ShippingDistrict AS shippingDistrict,
      ShippingWard AS shippingWard,
      ShippingAddressLine AS shippingAddressLine,
      CustomerNote AS customerNote,
      Subtotal AS subtotal,
      DiscountAmount AS discountAmount,
      ShippingFee AS shippingFee,
      TotalAmount AS totalAmount,
      CreatedAt AS createdAt,
      UpdatedAt AS updatedAt
    FROM dbo.Orders
    ${whereClause};
  `;
}

async function getOrderDetail(request, userId, orderId) {
  const header = await request
    .input('userId', sql.Int, userId)
    .input('orderId', sql.Int, orderId)
    .query(orderHeaderQuery('WHERE UserId = @userId AND OrderId = @orderId'));

  if (header.recordset.length === 0) {
    throw new OrderServiceError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng thuộc tài khoản này.');
  }

  const items = await request
    .input('itemsOrderId', sql.Int, orderId)
    .query(`
      SELECT
        orderItem.OrderItemId AS orderItemId,
        orderItem.ProductId AS productId,
        orderItem.SKUSnapshot AS sku,
        orderItem.ProductNameSnapshot AS productName,
        productImage.ImageUrl AS imageUrl,
        orderItem.UnitPrice AS unitPrice,
        orderItem.Quantity AS quantity,
        orderItem.DiscountAmount AS discountAmount,
        orderItem.LineTotal AS lineTotal
      FROM dbo.OrderItems AS orderItem
      OUTER APPLY (
        SELECT TOP (1) image.ImageUrl
        FROM dbo.ProductImages AS image
        WHERE image.ProductId = orderItem.ProductId
        ORDER BY image.IsPrimary DESC, image.SortOrder ASC, image.ProductImageId ASC
      ) AS productImage
      WHERE orderItem.OrderId = @itemsOrderId
      ORDER BY orderItem.OrderItemId ASC;
    `);

  const history = await request
    .input('historyOrderId', sql.Int, orderId)
    .query(`
      SELECT OldStatus AS oldStatus, NewStatus AS newStatus, ChangedAt AS changedAt
      FROM dbo.OrderStatusHistory
      WHERE OrderId = @historyOrderId
      ORDER BY ChangedAt ASC, OrderStatusHistoryId ASC;
    `);

  const payments = await request
    .input('paymentsOrderId', sql.Int, orderId)
    .query(`
      SELECT
        PaymentId AS paymentId,
        AttemptNumber AS attemptNumber,
        PaymentMethod AS paymentMethod,
        PaymentStatus AS paymentStatus,
        Amount AS amount,
        ProcessedAt AS processedAt,
        CreatedAt AS createdAt
      FROM dbo.Payments
      WHERE OrderId = @paymentsOrderId
      ORDER BY AttemptNumber ASC;
    `);

  return {
    ...header.recordset[0],
    items: items.recordset,
    statusHistory: history.recordset,
    payments: payments.recordset,
  };
}

async function createCustomerOrder(userId, input) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;

    // Keep lock order aligned with Cart and Addresses APIs to serialize operations per user.
    await lockActiveUser(transaction, userId);

    const address = await transaction.request()
      .input('userId', sql.Int, userId)
      .input('addressId', sql.Int, input.addressId)
      .query(`
        SELECT RecipientName AS recipientName, Phone AS phone,
               Province AS province, District AS district, Ward AS ward,
               AddressLine AS addressLine
        FROM dbo.UserAddresses WITH (UPDLOCK, HOLDLOCK)
        WHERE AddressId = @addressId AND UserId = @userId;
      `);
    if (address.recordset.length === 0) {
      throw new OrderServiceError(404, 'ADDRESS_NOT_FOUND', 'Không tìm thấy địa chỉ thuộc tài khoản này.');
    }

    const cart = await transaction.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT CartId AS cartId
        FROM dbo.Carts WITH (UPDLOCK, HOLDLOCK, INDEX(UX_Carts_OnePerUser))
        WHERE UserId = @userId;
      `);
    if (cart.recordset.length === 0) {
      throw new OrderServiceError(409, 'CART_EMPTY', 'Giỏ hàng đang trống.');
    }
    const cartId = cart.recordset[0].cartId;

    const cartItemsResult = await transaction.request()
      .input('cartId', sql.Int, cartId)
      .query(`
        SELECT ProductId AS productId, Quantity AS quantity
        FROM dbo.CartItems WITH (UPDLOCK, HOLDLOCK, INDEX(PK_CartItems))
        WHERE CartId = @cartId
        ORDER BY ProductId ASC;
      `);
    if (cartItemsResult.recordset.length === 0) {
      throw new OrderServiceError(409, 'CART_EMPTY', 'Giỏ hàng đang trống.');
    }

    // Lock products in a stable order and validate current activity and stock before writing.
    for (const item of cartItemsResult.recordset) {
      const product = await transaction.request()
        .input('productId', sql.Int, item.productId)
        .query(`
          SELECT ProductId, IsActive AS isActive, StockQuantity AS stockQuantity
          FROM dbo.Products WITH (UPDLOCK, HOLDLOCK)
          WHERE ProductId = @productId;
        `);
      if (product.recordset.length === 0) {
        throw new OrderServiceError(409, 'CART_PRODUCT_UNAVAILABLE', 'Một sản phẩm trong giỏ không còn tồn tại.');
      }
      if (!product.recordset[0].isActive) {
        throw new OrderServiceError(409, 'PRODUCT_INACTIVE', 'Một sản phẩm trong giỏ đã ngừng hoạt động.');
      }
      if (product.recordset[0].stockQuantity < item.quantity) {
        throw new OrderServiceError(409, 'INSUFFICIENT_STOCK', 'Tồn kho không đủ cho số lượng trong giỏ hàng.');
      }
    }

    // Calculate exact monetary values in SQL from the locked database prices.
    const subtotalResult = await transaction.request()
      .input('cartId', sql.Int, cartId)
      .query(`
        SELECT CONVERT(varchar(40), CONVERT(decimal(18,2), SUM(p.UnitPrice * ci.Quantity))) AS subtotal
        FROM dbo.CartItems AS ci
        INNER JOIN dbo.Products AS p ON p.ProductId = ci.ProductId
        WHERE ci.CartId = @cartId;
      `);
    const subtotal = subtotalResult.recordset[0].subtotal;
    if (subtotal === null) {
      throw new OrderServiceError(409, 'CART_EMPTY', 'Giỏ hàng đang trống.');
    }

    const orderNumber = `HN-${randomUUID()}`;
    const addressData = address.recordset[0];
    const created = await transaction.request()
      .input('orderNumber', sql.NVarChar(40), orderNumber)
      .input('userId', sql.Int, userId)
      .input('paymentMethod', sql.VarChar(10), input.paymentMethod)
      .input('recipientName', sql.NVarChar(150), addressData.recipientName)
      .input('recipientPhone', sql.NVarChar(30), addressData.phone)
      .input('province', sql.NVarChar(100), addressData.province)
      .input('district', sql.NVarChar(100), addressData.district)
      .input('ward', sql.NVarChar(100), addressData.ward)
      .input('addressLine', sql.NVarChar(250), addressData.addressLine)
      .input('customerNote', sql.NVarChar(1000), input.customerNote)
      .input('subtotal', sql.Decimal(18, 2), subtotal)
      .query(`
        INSERT INTO dbo.Orders (
          OrderNumber, UserId, OrderStatus, PaymentMethod,
          RecipientName, RecipientPhone, ShippingProvince, ShippingDistrict,
          ShippingWard, ShippingAddressLine, CustomerNote,
          Subtotal, DiscountAmount, ShippingFee, TotalAmount
        )
        OUTPUT INSERTED.OrderId AS orderId
        VALUES (
          @orderNumber, @userId, 'PENDING_CONFIRMATION', @paymentMethod,
          @recipientName, @recipientPhone, @province, @district,
          @ward, @addressLine, @customerNote,
          @subtotal, 0, 0, @subtotal
        );
      `);
    const orderId = created.recordset[0].orderId;

    for (const item of cartItemsResult.recordset) {
      const insertedItem = await transaction.request()
        .input('orderId', sql.Int, orderId)
        .input('productId', sql.Int, item.productId)
        .input('quantity', sql.Int, item.quantity)
        .query(`
          INSERT INTO dbo.OrderItems (
            OrderId, ProductId, SKUSnapshot, ProductNameSnapshot,
            UnitPrice, Quantity, DiscountAmount, LineTotal
          )
          SELECT @orderId, p.ProductId, p.SKU, p.ProductName,
                 p.UnitPrice, @quantity, 0,
                 CONVERT(decimal(18,2), p.UnitPrice * @quantity)
          FROM dbo.Products AS p
          WHERE p.ProductId = @productId AND p.IsActive = 1;
        `);
      if (insertedItem.rowsAffected[0] !== 1) {
        throw new OrderServiceError(409, 'PRODUCT_UNAVAILABLE', 'Không thể lưu một sản phẩm trong đơn hàng.');
      }

      const stockUpdate = await transaction.request()
        .input('productId', sql.Int, item.productId)
        .input('quantity', sql.Int, item.quantity)
        .query(`
          UPDATE dbo.Products
          SET StockQuantity = StockQuantity - @quantity,
              UpdatedAt = SYSUTCDATETIME()
          WHERE ProductId = @productId
            AND IsActive = 1
            AND StockQuantity >= @quantity;
        `);
      if (stockUpdate.rowsAffected[0] !== 1) {
        throw new OrderServiceError(409, 'INSUFFICIENT_STOCK', 'Tồn kho đã thay đổi; vui lòng kiểm tra lại giỏ hàng.');
      }

      await transaction.request()
        .input('productId', sql.Int, item.productId)
        .input('orderId', sql.Int, orderId)
        .input('quantityChange', sql.Int, -item.quantity)
        .input('userId', sql.Int, userId)
        .query(`
          INSERT INTO dbo.InventoryTransactions (ProductId, OrderId, QuantityChange, Reason, CreatedByUserId)
          VALUES (@productId, @orderId, @quantityChange, 'ORDER', @userId);
        `);
    }

    await transaction.request()
      .input('orderId', sql.Int, orderId)
      .input('userId', sql.Int, userId)
      .input('paymentMethod', sql.VarChar(10), input.paymentMethod)
      .input('subtotal', sql.Decimal(18, 2), subtotal)
      .query(`
        INSERT INTO dbo.OrderStatusHistory (OrderId, OldStatus, NewStatus, Note, ChangedByUserId)
        VALUES (@orderId, NULL, 'PENDING_CONFIRMATION', N'Đơn hàng được tạo.', @userId);

        INSERT INTO dbo.Payments (OrderId, AttemptNumber, PaymentMethod, PaymentStatus, Amount)
        VALUES (@orderId, 1, @paymentMethod, 'PENDING', @subtotal);

        DELETE FROM dbo.CartItems WHERE CartId = (SELECT CartId FROM dbo.Carts WHERE UserId = @userId);
        UPDATE dbo.Carts SET UpdatedAt = SYSUTCDATETIME() WHERE UserId = @userId;
      `);

    const result = await getOrderDetail(transaction.request(), userId, orderId);
    await transaction.commit();
    return result;
  } catch (error) {
    if (transactionStarted) await transaction.rollback().catch(() => {});
    if (error.number === 1205) {
      throw new OrderServiceError(409, 'ORDER_CONFLICT', 'Đơn hàng đang được xử lý đồng thời. Vui lòng thử lại.');
    }
    if (error.number === 8115) {
      throw new OrderServiceError(409, 'ORDER_TOTAL_TOO_LARGE', 'Tổng tiền đơn hàng vượt quá giới hạn lưu trữ.');
    }
    throw error;
  }
}

async function getCustomerOrders(userId, { page, pageSize }) {
  const pool = await getPool();
  const owner = await pool.request()
    .input('userId', sql.Int, userId)
    .query('SELECT UserId FROM dbo.Users WHERE UserId = @userId AND IsActive = 1;');
  if (owner.recordset.length === 0) {
    throw new OrderServiceError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng đang hoạt động.');
  }

  const totalResult = await pool.request()
    .input('userId', sql.Int, userId)
    .query('SELECT COUNT_BIG(*) AS totalCount FROM dbo.Orders WHERE UserId = @userId;');
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset) || offset > 2147483647) {
    throw new OrderServiceError(400, 'INVALID_PAGINATION', 'page nằm ngoài giới hạn cho phép.');
  }

  const orders = await pool.request()
    .input('userId', sql.Int, userId)
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, pageSize)
    .query(`
      SELECT
        OrderId AS orderId, OrderNumber AS orderNumber,
        OrderStatus AS orderStatus, PaymentMethod AS paymentMethod,
        Subtotal AS subtotal, DiscountAmount AS discountAmount,
        ShippingFee AS shippingFee, TotalAmount AS totalAmount,
        CreatedAt AS createdAt, UpdatedAt AS updatedAt
      FROM dbo.Orders
      WHERE UserId = @userId
      ORDER BY CreatedAt DESC, OrderId DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
    `);

  return {
    page,
    pageSize,
    totalCount: Number(totalResult.recordset[0].totalCount),
    data: orders.recordset,
  };
}

async function getCustomerOrder(userId, orderId) {
  const pool = await getPool();
  const owner = await pool.request()
    .input('userId', sql.Int, userId)
    .query('SELECT UserId FROM dbo.Users WHERE UserId = @userId AND IsActive = 1;');
  if (owner.recordset.length === 0) {
    throw new OrderServiceError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng đang hoạt động.');
  }
  return getOrderDetail(pool.request(), userId, orderId);
}

async function cancelCustomerOrder(userId, orderId) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;
    await lockActiveUser(transaction, userId);

    const orderResult = await transaction.request()
      .input('userId', sql.Int, userId)
      .input('orderId', sql.Int, orderId)
      .query(`
        SELECT OrderStatus AS orderStatus, PaymentMethod AS paymentMethod
        FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK)
        WHERE OrderId = @orderId AND UserId = @userId;
      `);
    if (orderResult.recordset.length === 0) {
      throw new OrderServiceError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng thuộc tài khoản này.');
    }
    const order = orderResult.recordset[0];
    if (order.orderStatus !== 'PENDING_CONFIRMATION') {
      throw new OrderServiceError(409, 'ORDER_CANNOT_BE_CANCELLED', 'Chỉ có thể hủy đơn đang chờ xác nhận.');
    }

    if (order.paymentMethod === 'ONLINE') {
      const successfulPayment = await transaction.request()
        .input('orderId', sql.Int, orderId)
        .query(`
          SELECT PaymentId
          FROM dbo.Payments WITH (UPDLOCK, HOLDLOCK)
          WHERE OrderId = @orderId AND PaymentStatus = 'SUCCESS';
        `);
      if (successfulPayment.recordset.length > 0) {
        throw new OrderServiceError(409, 'ONLINE_PAYMENT_ALREADY_SUCCESSFUL', 'Đơn ONLINE đã thanh toán thành công không thể tự hủy.');
      }
    }

    const items = await transaction.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        SELECT ProductId AS productId, Quantity AS quantity
        FROM dbo.OrderItems WITH (UPDLOCK, HOLDLOCK, INDEX(IX_OrderItems_Order))
        WHERE OrderId = @orderId
        ORDER BY ProductId ASC;
      `);

    const stateChange = await transaction.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        UPDATE dbo.Orders
        SET OrderStatus = 'CANCELLED', UpdatedAt = SYSUTCDATETIME()
        WHERE OrderId = @orderId AND OrderStatus = 'PENDING_CONFIRMATION';
      `);
    if (stateChange.rowsAffected[0] !== 1) {
      throw new OrderServiceError(409, 'ORDER_CANNOT_BE_CANCELLED', 'Trạng thái đơn hàng đã thay đổi; không thể hủy.');
    }

    await transaction.request()
      .input('orderId', sql.Int, orderId)
      .input('userId', sql.Int, userId)
      .query(`
        INSERT INTO dbo.OrderStatusHistory (OrderId, OldStatus, NewStatus, Note, ChangedByUserId)
        VALUES (@orderId, 'PENDING_CONFIRMATION', 'CANCELLED', N'Khách hàng đã hủy đơn.', @userId);
      `);

    for (const item of items.recordset) {
      // ProductId is nullable because deleted products are detached by ON DELETE SET NULL.
      if (item.productId === null) continue;

      const stockUpdate = await transaction.request()
        .input('productId', sql.Int, item.productId)
        .input('quantity', sql.Int, item.quantity)
        .query(`
          UPDATE dbo.Products
          SET StockQuantity = StockQuantity + @quantity,
              UpdatedAt = SYSUTCDATETIME()
          WHERE ProductId = @productId;
        `);
      if (stockUpdate.rowsAffected[0] !== 1) {
        throw new OrderServiceError(409, 'PRODUCT_UNAVAILABLE', 'Không thể hoàn kho cho một sản phẩm của đơn hàng.');
      }

      await transaction.request()
        .input('productId', sql.Int, item.productId)
        .input('orderId', sql.Int, orderId)
        .input('quantityChange', sql.Int, item.quantity)
        .input('userId', sql.Int, userId)
        .query(`
          INSERT INTO dbo.InventoryTransactions (ProductId, OrderId, QuantityChange, Reason, CreatedByUserId)
          VALUES (@productId, @orderId, @quantityChange, 'CANCEL_RETURN', @userId);
        `);
    }

    const result = await getOrderDetail(transaction.request(), userId, orderId);
    await transaction.commit();
    return result;
  } catch (error) {
    if (transactionStarted) await transaction.rollback().catch(() => {});
    if (error.number === 1205) {
      throw new OrderServiceError(409, 'ORDER_CONFLICT', 'Đơn hàng đang được xử lý đồng thời. Vui lòng thử lại.');
    }
    throw error;
  }
}

module.exports = {
  cancelCustomerOrder,
  createCustomerOrder,
  getCustomerOrder,
  getCustomerOrders,
};
