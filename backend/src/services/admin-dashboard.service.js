const { sql, createPool } = require('../config/database');

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

async function getAdminDashboard() {
  const pool = await getPool();
  const [products, categories, brands, orders, revenue, recentOrders] = await Promise.all([
    pool.request().query(`
      SELECT CONVERT(INT, COUNT_BIG(*)) AS total,
             CONVERT(INT, COALESCE(SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END), 0)) AS active,
             CONVERT(INT, COALESCE(SUM(CASE WHEN IsActive = 0 THEN 1 ELSE 0 END), 0)) AS inactive
      FROM dbo.Products;
    `),
    pool.request().query(`
      SELECT CONVERT(INT, COUNT_BIG(*)) AS total,
             CONVERT(INT, COALESCE(SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END), 0)) AS active,
             CONVERT(INT, COALESCE(SUM(CASE WHEN IsActive = 0 THEN 1 ELSE 0 END), 0)) AS inactive
      FROM dbo.Categories;
    `),
    pool.request().query(`
      SELECT CONVERT(INT, COUNT_BIG(*)) AS total,
             CONVERT(INT, COALESCE(SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END), 0)) AS active,
             CONVERT(INT, COALESCE(SUM(CASE WHEN IsActive = 0 THEN 1 ELSE 0 END), 0)) AS inactive
      FROM dbo.Brands;
    `),
    pool.request().query(`
      SELECT CONVERT(INT, COUNT_BIG(*)) AS total,
             CONVERT(INT, COALESCE(SUM(CASE WHEN OrderStatus = 'PENDING_CONFIRMATION' THEN 1 ELSE 0 END), 0)) AS pendingConfirmation,
             CONVERT(INT, COALESCE(SUM(CASE WHEN OrderStatus = 'CONFIRMED' THEN 1 ELSE 0 END), 0)) AS confirmed,
             CONVERT(INT, COALESCE(SUM(CASE WHEN OrderStatus = 'CANCELLED' THEN 1 ELSE 0 END), 0)) AS cancelled
      FROM dbo.Orders;
    `),
    pool.request().query(`
      SELECT COALESCE(SUM(CASE WHEN OrderStatus <> 'CANCELLED' THEN TotalAmount ELSE 0 END), 0) AS total
      FROM dbo.Orders;
    `),
    pool.request().query(`
      SELECT TOP (5)
             orderHeader.OrderId AS orderId,
             orderHeader.OrderNumber AS orderNumber,
             orderHeader.UserId AS userId,
             account.FullName AS customerName,
             orderHeader.TotalAmount AS totalAmount,
             orderHeader.OrderStatus AS status,
             orderHeader.CreatedAt AS createdAt
      FROM dbo.Orders AS orderHeader
      LEFT JOIN dbo.Users AS account ON account.UserId = orderHeader.UserId
      ORDER BY orderHeader.CreatedAt DESC, orderHeader.OrderId DESC;
    `),
  ]);

  return {
    products: products.recordset[0],
    categories: categories.recordset[0],
    brands: brands.recordset[0],
    orders: orders.recordset[0],
    revenue: revenue.recordset[0],
    recentOrders: recentOrders.recordset,
  };
}

module.exports = { getAdminDashboard };
