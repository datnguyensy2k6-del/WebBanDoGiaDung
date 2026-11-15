const { sql, createPool } = require('../config/database');

class AdminOrderServiceError extends Error {
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

const ORDER_HEADER_SELECT = `
  SELECT
    ord.OrderId AS orderId,
    ord.OrderNumber AS orderNumber,
    ord.UserId AS userId,
    account.FullName AS customerName,
    account.Email AS customerEmail,
    ord.OrderStatus AS orderStatus,
    ord.PaymentMethod AS paymentMethod,
    ord.RecipientName AS recipientName,
    ord.RecipientPhone AS recipientPhone,
    ord.ShippingProvince AS shippingProvince,
    ord.ShippingDistrict AS shippingDistrict,
    ord.ShippingWard AS shippingWard,
    ord.ShippingAddressLine AS shippingAddressLine,
    ord.CustomerNote AS customerNote,
    ord.Subtotal AS subtotal,
    ord.DiscountAmount AS discountAmount,
    ord.ShippingFee AS shippingFee,
    ord.TotalAmount AS totalAmount,
    ord.CreatedAt AS createdAt,
    ord.UpdatedAt AS updatedAt
  FROM dbo.Orders AS ord
  INNER JOIN dbo.Users AS account ON account.UserId = ord.UserId
`;

async function listAdminOrders({ page, pageSize, orderStatus, orderNumber }) {
  const pool = await getPool();
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset) || offset > 2147483647) {
    throw new AdminOrderServiceError(400, 'INVALID_PAGINATION', 'Trang nằm ngoài giới hạn cho phép.');
  }

  const conditions = [];
  const countRequest = pool.request();
  const listRequest = pool.request()
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, pageSize);

  if (orderStatus) {
    conditions.push('ord.OrderStatus = @orderStatus');
    countRequest.input('orderStatus', sql.VarChar(30), orderStatus);
    listRequest.input('orderStatus', sql.VarChar(30), orderStatus);
  }
  if (orderNumber) {
    conditions.push('ord.OrderNumber LIKE @orderNumber');
    const searchPattern = `%${orderNumber}%`;
    countRequest.input('orderNumber', sql.NVarChar(122), searchPattern);
    listRequest.input('orderNumber', sql.NVarChar(122), searchPattern);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const totalResult = await countRequest.query(`
    SELECT COUNT_BIG(*) AS totalCount
    FROM dbo.Orders AS ord
    ${whereClause};
  `);
  const orders = await listRequest.query(`
    ${ORDER_HEADER_SELECT}
    ${whereClause}
    ORDER BY ord.CreatedAt DESC, ord.OrderId DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
  `);

  return {
    page,
    pageSize,
    totalCount: Number(totalResult.recordset[0].totalCount),
    data: orders.recordset,
  };
}

async function readAdminOrderDetail(request, orderId) {
  const header = await request
    .input('orderId', sql.Int, orderId)
    .query(`${ORDER_HEADER_SELECT} WHERE ord.OrderId = @orderId;`);

  if (header.recordset.length === 0) {
    throw new AdminOrderServiceError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  }

  const items = await request
    .input('itemsOrderId', sql.Int, orderId)
    .query(`
      SELECT
        OrderItemId AS orderItemId,
        ProductId AS productId,
        SKUSnapshot AS sku,
        ProductNameSnapshot AS productName,
        UnitPrice AS unitPrice,
        Quantity AS quantity,
        DiscountAmount AS discountAmount,
        LineTotal AS lineTotal
      FROM dbo.OrderItems
      WHERE OrderId = @itemsOrderId
      ORDER BY OrderItemId ASC;
    `);

  const history = await request
    .input('historyOrderId', sql.Int, orderId)
    .query(`
      SELECT
        history.OldStatus AS oldStatus,
        history.NewStatus AS newStatus,
        history.Note AS note,
        history.ChangedByUserId AS changedByUserId,
        actor.FullName AS changedByName,
        history.ChangedAt AS changedAt
      FROM dbo.OrderStatusHistory AS history
      LEFT JOIN dbo.Users AS actor ON actor.UserId = history.ChangedByUserId
      WHERE history.OrderId = @historyOrderId
      ORDER BY history.ChangedAt ASC, history.OrderStatusHistoryId ASC;
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
        ProcessedByUserId AS processedByUserId,
        ProcessedAt AS processedAt,
        Note AS note,
        CreatedAt AS createdAt
      FROM dbo.Payments
      WHERE OrderId = @paymentsOrderId
      ORDER BY AttemptNumber ASC;
    `);

  const inventoryTransactions = await request
    .input('inventoryOrderId', sql.Int, orderId)
    .query(`
      SELECT
        inventory.InventoryTransactionId AS inventoryTransactionId,
        inventory.ProductId AS productId,
        product.SKU AS sku,
        product.ProductName AS productName,
        inventory.QuantityChange AS quantityChange,
        inventory.Reason AS reason,
        inventory.Note AS note,
        inventory.CreatedByUserId AS createdByUserId,
        inventory.CreatedAt AS createdAt
      FROM dbo.InventoryTransactions AS inventory
      INNER JOIN dbo.Products AS product ON product.ProductId = inventory.ProductId
      WHERE inventory.OrderId = @inventoryOrderId
      ORDER BY inventory.CreatedAt ASC, inventory.InventoryTransactionId ASC;
    `);

  return {
    ...header.recordset[0],
    items: items.recordset,
    statusHistory: history.recordset,
    payments: payments.recordset,
    inventoryTransactions: inventoryTransactions.recordset,
  };
}

async function getAdminOrder(orderId) {
  const pool = await getPool();
  return readAdminOrderDetail(pool.request(), orderId);
}

async function confirmAdminOrder(orderId, adminUserId) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;

  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;

    const order = await transaction.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        SELECT OrderStatus AS orderStatus
        FROM dbo.Orders WITH (UPDLOCK, HOLDLOCK)
        WHERE OrderId = @orderId;
      `);

    if (order.recordset.length === 0) {
      throw new AdminOrderServiceError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
    }
    if (order.recordset[0].orderStatus !== 'PENDING_CONFIRMATION') {
      throw new AdminOrderServiceError(409, 'ORDER_CANNOT_BE_CONFIRMED', 'Chỉ đơn đang chờ xác nhận mới có thể được xác nhận.');
    }

    const update = await transaction.request()
      .input('orderId', sql.Int, orderId)
      .query(`
        UPDATE dbo.Orders
        SET OrderStatus = 'CONFIRMED', UpdatedAt = SYSUTCDATETIME()
        WHERE OrderId = @orderId AND OrderStatus = 'PENDING_CONFIRMATION';
      `);
    if (update.rowsAffected[0] !== 1) {
      throw new AdminOrderServiceError(409, 'ORDER_CANNOT_BE_CONFIRMED', 'Trạng thái đơn hàng đã thay đổi; không thể xác nhận.');
    }

    await transaction.request()
      .input('orderId', sql.Int, orderId)
      .input('adminUserId', sql.Int, adminUserId)
      .query(`
        INSERT INTO dbo.OrderStatusHistory (OrderId, OldStatus, NewStatus, Note, ChangedByUserId)
        VALUES (@orderId, 'PENDING_CONFIRMATION', 'CONFIRMED', N'Confirmed by admin.', @adminUserId);
      `);

    const detail = await readAdminOrderDetail(transaction.request(), orderId);
    await transaction.commit();
    return detail;
  } catch (error) {
    if (transactionStarted) await transaction.rollback().catch(() => {});
    if (error.number === 1205) {
      throw new AdminOrderServiceError(409, 'ORDER_CONFLICT', 'Đơn hàng đang được xử lý đồng thời. Vui lòng thử lại.');
    }
    throw error;
  }
}

module.exports = {
  AdminOrderServiceError,
  confirmAdminOrder,
  getAdminOrder,
  listAdminOrders,
};
