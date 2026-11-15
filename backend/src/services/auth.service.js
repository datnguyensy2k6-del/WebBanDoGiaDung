const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sql, createPool } = require('../config/database');

const BCRYPT_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
let poolPromise;

class AuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

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

function validateCredentials(email, password) {
  if (typeof email !== 'string' || !email.trim() || email.trim().length > 320 || !EMAIL_PATTERN.test(email.trim())) {
    throw new AuthError(400, 'INVALID_EMAIL', 'Vui lòng cung cấp địa chỉ email hợp lệ.');
  }

  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new AuthError(400, 'INVALID_PASSWORD', 'Mật khẩu phải có ít nhất 8 ký tự và không vượt quá 72 byte UTF-8.');
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is missing or too short.');
  }
  return secret;
}

function createToken(userId, secret = getJwtSecret()) {
  return jwt.sign(
    { sub: String(userId) },
    secret,
    { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
  );
}

function toPublicUser(row, roleCodes) {
  return {
    userId: row.userId,
    email: row.email,
    fullName: row.fullName,
    phone: row.phone,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    roles: [...new Set(roleCodes)],
  };
}

async function register({ email, password, fullName, phone, role, roles, roleCode }) {
  validateCredentials(email, password);
  const jwtSecret = getJwtSecret();
  if (role !== undefined || roles !== undefined || roleCode !== undefined) {
    throw new AuthError(400, 'ROLE_ASSIGNMENT_NOT_ALLOWED', 'Vai trò được hệ thống gán tự động khi đăng ký.');
  }

  if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 150) {
    throw new AuthError(400, 'INVALID_FULL_NAME', 'Họ tên là bắt buộc và tối đa 150 ký tự.');
  }

  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    throw new AuthError(400, 'INVALID_PHONE', 'Số điện thoại phải là chuỗi ký tự.');
  }

  const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
  if (normalizedPhone.length > 30) {
    throw new AuthError(400, 'INVALID_PHONE', 'Số điện thoại tối đa 30 ký tự.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = fullName.trim();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const existingUser = await transaction.request()
      .input('email', sql.NVarChar(320), normalizedEmail)
      .query('SELECT UserId FROM dbo.Users WHERE Email = @email;');

    if (existingUser.recordset.length > 0) {
      throw new AuthError(409, 'EMAIL_ALREADY_REGISTERED', 'Email này đã được đăng ký.');
    }

    const customerRole = await transaction.request()
      .input('roleCode', sql.NVarChar(30), 'CUSTOMER')
      .query('SELECT RoleId FROM dbo.Roles WHERE RoleCode = @roleCode;');

    if (customerRole.recordset.length === 0) {
      throw new AuthError(500, 'CUSTOMER_ROLE_NOT_CONFIGURED', 'Hệ thống chưa cấu hình vai trò khách hàng.');
    }

    const insertedUser = await transaction.request()
      .input('email', sql.NVarChar(320), normalizedEmail)
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .input('fullName', sql.NVarChar(150), normalizedName)
      .input('phone', sql.NVarChar(30), normalizedPhone || null)
      .query(`
        INSERT INTO dbo.Users (Email, PasswordHash, FullName, Phone, IsActive)
        OUTPUT
          INSERTED.UserId AS userId,
          INSERTED.Email AS email,
          INSERTED.FullName AS fullName,
          INSERTED.Phone AS phone,
          INSERTED.IsActive AS isActive,
          INSERTED.CreatedAt AS createdAt,
          INSERTED.UpdatedAt AS updatedAt
        VALUES (@email, @passwordHash, @fullName, @phone, 1);
      `);

    const user = insertedUser.recordset[0];
    const roleId = customerRole.recordset[0].RoleId;

    await transaction.request()
      .input('userId', sql.Int, user.userId)
      .input('roleId', sql.Int, roleId)
      .query('INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@userId, @roleId);');

    const publicUser = toPublicUser(user, ['CUSTOMER']);
    const token = createToken(user.userId, jwtSecret);
    await transaction.commit();
    return { user: publicUser, token };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    if (error instanceof AuthError) throw error;
    if (error.number === 2601 || error.number === 2627) {
      throw new AuthError(409, 'EMAIL_ALREADY_REGISTERED', 'Email này đã được đăng ký.');
    }
    throw error;
  }
}

async function login({ email, password }) {
  validateCredentials(email, password);
  const jwtSecret = getJwtSecret();
  const normalizedEmail = email.trim().toLowerCase();
  const pool = await getPool();
  const result = await pool.request()
    .input('email', sql.NVarChar(320), normalizedEmail)
    .query(`
      SELECT
        account.UserId AS userId,
        account.Email AS email,
        account.PasswordHash AS passwordHash,
        account.FullName AS fullName,
        account.Phone AS phone,
        account.IsActive AS isActive,
        account.CreatedAt AS createdAt,
        account.UpdatedAt AS updatedAt,
        role.RoleCode AS roleCode
      FROM dbo.Users AS account
      LEFT JOIN dbo.UserRoles AS userRole ON userRole.UserId = account.UserId
      LEFT JOIN dbo.Roles AS role ON role.RoleId = userRole.RoleId
      WHERE account.Email = @email;
    `);

  if (result.recordset.length === 0) {
    throw new AuthError(404, 'ACCOUNT_NOT_FOUND', 'Không tìm thấy tài khoản với email này.');
  }

  const account = result.recordset[0];
  if (!account.isActive) {
    throw new AuthError(403, 'ACCOUNT_INACTIVE', 'Tài khoản hiện không hoạt động.');
  }

  const passwordMatches = await bcrypt.compare(password, account.passwordHash);
  if (!passwordMatches) {
    throw new AuthError(401, 'INVALID_PASSWORD', 'Mật khẩu không chính xác.');
  }

  const user = toPublicUser(account, result.recordset.map((row) => row.roleCode).filter(Boolean));
  return { user, token: createToken(user.userId, jwtSecret) };
}

async function getCurrentUser(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT
        account.UserId AS userId,
        account.Email AS email,
        account.FullName AS fullName,
        account.Phone AS phone,
        account.IsActive AS isActive,
        account.CreatedAt AS createdAt,
        account.UpdatedAt AS updatedAt,
        role.RoleCode AS roleCode
      FROM dbo.Users AS account
      LEFT JOIN dbo.UserRoles AS userRole ON userRole.UserId = account.UserId
      LEFT JOIN dbo.Roles AS role ON role.RoleId = userRole.RoleId
      WHERE account.UserId = @userId;
    `);

  if (result.recordset.length === 0 || !result.recordset[0].isActive) {
    return null;
  }

  return toPublicUser(result.recordset[0], result.recordset.map((row) => row.roleCode).filter(Boolean));
}

module.exports = { AuthError, createToken, getCurrentUser, login, register };
