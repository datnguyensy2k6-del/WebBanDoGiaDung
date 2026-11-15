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

async function requireAdmin(req, res, next) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, req.auth.userId)
      .query(`
        SELECT TOP (1) account.UserId
        FROM dbo.Users AS account
        INNER JOIN dbo.UserRoles AS userRole ON userRole.UserId = account.UserId
        INNER JOIN dbo.Roles AS role ON role.RoleId = userRole.RoleId
        WHERE account.UserId = @userId
          AND account.IsActive = 1
          AND role.RoleCode = 'ADMIN';
      `);

    if (result.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'ADMIN_REQUIRED',
        message: 'Tài khoản không có quyền quản trị.',
      });
    }

    return next();
  } catch (error) {
    console.error('Admin authorization failed:', error.number || error.code || error.name || 'UNKNOWN_ERROR');
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Không thể xác minh quyền quản trị lúc này.',
    });
  }
}

module.exports = { requireAdmin };
