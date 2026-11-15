const { sql, createPool } = require('../config/database');
const { UserApiError } = require('../utils/user-api-error');

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

function addAddressInputs(request, userId, address) {
  return request
    .input('userId', sql.Int, userId)
    .input('recipientName', sql.NVarChar(150), address.recipientName)
    .input('phone', sql.NVarChar(30), address.phone)
    .input('province', sql.NVarChar(100), address.province)
    .input('district', sql.NVarChar(100), address.district)
    .input('ward', sql.NVarChar(100), address.ward)
    .input('addressLine', sql.NVarChar(250), address.addressLine);
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
    throw new UserApiError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng đang hoạt động.');
  }
}

async function getAddresses(userId) {
  const pool = await getPool();
  const owner = await pool.request()
    .input('userId', sql.Int, userId)
    .query('SELECT UserId FROM dbo.Users WHERE UserId = @userId AND IsActive = 1;');
  if (owner.recordset.length === 0) {
    throw new UserApiError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng đang hoạt động.');
  }

  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT
        AddressId AS addressId,
        RecipientName AS recipientName,
        Phone AS phone,
        Province AS province,
        District AS district,
        Ward AS ward,
        AddressLine AS addressLine,
        IsDefault AS isDefault,
        CreatedAt AS createdAt,
        UpdatedAt AS updatedAt
      FROM dbo.UserAddresses
      WHERE UserId = @userId
      ORDER BY IsDefault DESC, CreatedAt DESC, AddressId DESC;
    `);
  return result.recordset;
}

async function createAddress(userId, address) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    await lockActiveUser(transaction, userId);

    if (address.isDefault) {
      await transaction.request()
        .input('userId', sql.Int, userId)
        .query(`
          UPDATE dbo.UserAddresses
          SET IsDefault = 0, UpdatedAt = SYSUTCDATETIME()
          WHERE UserId = @userId AND IsDefault = 1;
        `);
    }

    const result = await addAddressInputs(transaction.request(), userId, address)
      .input('isDefault', sql.Bit, address.isDefault)
      .query(`
        INSERT INTO dbo.UserAddresses
          (UserId, RecipientName, Phone, Province, District, Ward, AddressLine, IsDefault)
        OUTPUT
          INSERTED.AddressId AS addressId,
          INSERTED.RecipientName AS recipientName,
          INSERTED.Phone AS phone,
          INSERTED.Province AS province,
          INSERTED.District AS district,
          INSERTED.Ward AS ward,
          INSERTED.AddressLine AS addressLine,
          INSERTED.IsDefault AS isDefault,
          INSERTED.CreatedAt AS createdAt,
          INSERTED.UpdatedAt AS updatedAt
        VALUES
          (@userId, @recipientName, @phone, @province, @district, @ward, @addressLine, @isDefault);
      `);

    await transaction.commit();
    return result.recordset[0];
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

async function updateAddress(userId, addressId, address) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    await lockActiveUser(transaction, userId);

    const current = await transaction.request()
      .input('userId', sql.Int, userId)
      .input('addressId', sql.Int, addressId)
      .query(`
        SELECT IsDefault AS isDefault
        FROM dbo.UserAddresses WITH (UPDLOCK, HOLDLOCK)
        WHERE AddressId = @addressId AND UserId = @userId;
      `);
    if (current.recordset.length === 0) {
      throw new UserApiError(404, 'ADDRESS_NOT_FOUND', 'Không tìm thấy địa chỉ thuộc tài khoản này.');
    }

    const isDefault = address.isDefault === undefined ? current.recordset[0].isDefault : address.isDefault;
    if (isDefault) {
      await transaction.request()
        .input('userId', sql.Int, userId)
        .input('addressId', sql.Int, addressId)
        .query(`
          UPDATE dbo.UserAddresses
          SET IsDefault = 0, UpdatedAt = SYSUTCDATETIME()
          WHERE UserId = @userId AND AddressId <> @addressId AND IsDefault = 1;
        `);
    }

    const result = await addAddressInputs(transaction.request(), userId, address)
      .input('addressId', sql.Int, addressId)
      .input('isDefault', sql.Bit, isDefault)
      .query(`
        UPDATE dbo.UserAddresses
        SET RecipientName = @recipientName,
            Phone = @phone,
            Province = @province,
            District = @district,
            Ward = @ward,
            AddressLine = @addressLine,
            IsDefault = @isDefault,
            UpdatedAt = SYSUTCDATETIME()
        OUTPUT
          INSERTED.AddressId AS addressId,
          INSERTED.RecipientName AS recipientName,
          INSERTED.Phone AS phone,
          INSERTED.Province AS province,
          INSERTED.District AS district,
          INSERTED.Ward AS ward,
          INSERTED.AddressLine AS addressLine,
          INSERTED.IsDefault AS isDefault,
          INSERTED.CreatedAt AS createdAt,
          INSERTED.UpdatedAt AS updatedAt
        WHERE AddressId = @addressId AND UserId = @userId;
      `);

    await transaction.commit();
    return result.recordset[0];
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

async function deleteAddress(userId, addressId) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    await lockActiveUser(transaction, userId);

    const current = await transaction.request()
      .input('userId', sql.Int, userId)
      .input('addressId', sql.Int, addressId)
      .query(`
        SELECT IsDefault AS isDefault
        FROM dbo.UserAddresses WITH (UPDLOCK, HOLDLOCK)
        WHERE AddressId = @addressId AND UserId = @userId;
      `);
    if (current.recordset.length === 0) {
      throw new UserApiError(404, 'ADDRESS_NOT_FOUND', 'Không tìm thấy địa chỉ thuộc tài khoản này.');
    }

    await transaction.request()
      .input('userId', sql.Int, userId)
      .input('addressId', sql.Int, addressId)
      .query('DELETE FROM dbo.UserAddresses WHERE AddressId = @addressId AND UserId = @userId;');

    let replacementAddressId = null;
    if (current.recordset[0].isDefault) {
      const replacement = await transaction.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT TOP (1) AddressId AS addressId
          FROM dbo.UserAddresses
          WHERE UserId = @userId
          ORDER BY CreatedAt DESC, AddressId DESC;
        `);
      replacementAddressId = replacement.recordset[0]?.addressId ?? null;

      if (replacementAddressId !== null) {
        await transaction.request()
          .input('userId', sql.Int, userId)
          .input('addressId', sql.Int, replacementAddressId)
          .query(`
            UPDATE dbo.UserAddresses
            SET IsDefault = 1, UpdatedAt = SYSUTCDATETIME()
            WHERE UserId = @userId AND AddressId = @addressId;
          `);
      }
    }

    await transaction.commit();
    return { addressId, replacementAddressId };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

module.exports = { createAddress, deleteAddress, getAddresses, updateAddress };
