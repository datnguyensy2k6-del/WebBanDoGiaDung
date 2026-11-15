const { sql, createPool } = require('../config/database');

class AdminBrandServiceError extends Error {
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

const BRAND_SELECT = `
  SELECT BrandId AS brandId,
         BrandName AS brandName,
         Slug AS slug,
         Description AS description,
         IsActive AS isActive,
         CreatedAt AS createdAt
  FROM dbo.Brands
`;

async function listAdminBrands({ page, pageSize, search, isActive }) {
  const pool = await getPool();
  const offset = (page - 1) * pageSize;
  const conditions = [];
  const countRequest = pool.request();
  const listRequest = pool.request()
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, pageSize);
  if (search) {
    const escaped = search.replace(/[%_~]/g, '~$&').replace(/\[/g, '~[');
    const pattern = `%${escaped}%`;
    conditions.push("(BrandName LIKE @search ESCAPE '~' OR Slug LIKE @search ESCAPE '~')");
    countRequest.input('search', sql.NVarChar(300), pattern);
    listRequest.input('search', sql.NVarChar(300), pattern);
  }
  if (isActive !== undefined) {
    conditions.push('IsActive = @isActive');
    countRequest.input('isActive', sql.Bit, isActive);
    listRequest.input('isActive', sql.Bit, isActive);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total, brands] = await Promise.all([
    countRequest.query(`SELECT COUNT_BIG(*) AS totalCount FROM dbo.Brands ${whereClause};`),
    listRequest.query(`${BRAND_SELECT} ${whereClause} ORDER BY BrandName, BrandId OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;`),
  ]);
  return { page, pageSize, totalCount: Number(total.recordset[0].totalCount), data: brands.recordset };
}

async function getAdminBrand(brandId) {
  const pool = await getPool();
  const result = await pool.request().input('brandId', sql.Int, brandId)
    .query(`${BRAND_SELECT} WHERE BrandId = @brandId;`);
  if (!result.recordset.length) throw new AdminBrandServiceError(404, 'BRAND_NOT_FOUND', 'Không tìm thấy thương hiệu.');
  return result.recordset[0];
}

async function createAdminBrand(input) {
  const pool = await getPool();
  try {
    const result = await pool.request()
      .input('brandName', sql.NVarChar(120), input.brandName)
      .input('slug', sql.NVarChar(140), input.slug)
      .input('description', sql.NVarChar(500), input.description)
      .input('isActive', sql.Bit, input.isActive)
      .query(`
        INSERT INTO dbo.Brands (BrandName, Slug, Description, IsActive)
        OUTPUT INSERTED.BrandId AS brandId
        VALUES (@brandName, @slug, @description, @isActive);
      `);
    return getAdminBrand(result.recordset[0].brandId);
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      throw new AdminBrandServiceError(409, 'BRAND_ALREADY_EXISTS', 'Tên hoặc slug thương hiệu đã được sử dụng.');
    }
    throw error;
  }
}

async function updateAdminBrand(brandId, changes) {
  const pool = await getPool();
  try {
    const request = pool.request().input('brandId', sql.Int, brandId);
    const assignments = [];
    if (Object.hasOwn(changes, 'brandName')) {
      request.input('brandName', sql.NVarChar(120), changes.brandName);
      assignments.push('BrandName = @brandName');
    }
    if (Object.hasOwn(changes, 'slug')) {
      request.input('slug', sql.NVarChar(140), changes.slug);
      assignments.push('Slug = @slug');
    }
    if (Object.hasOwn(changes, 'description')) {
      request.input('description', sql.NVarChar(500), changes.description);
      assignments.push('Description = @description');
    }
    const updated = await request.query(`UPDATE dbo.Brands SET ${assignments.join(', ')} WHERE BrandId = @brandId;`);
    if (!updated.rowsAffected[0]) throw new AdminBrandServiceError(404, 'BRAND_NOT_FOUND', 'Không tìm thấy thương hiệu.');
    return getAdminBrand(brandId);
  } catch (error) {
    if (error instanceof AdminBrandServiceError) throw error;
    if (error.number === 2601 || error.number === 2627) {
      throw new AdminBrandServiceError(409, 'BRAND_ALREADY_EXISTS', 'Tên hoặc slug thương hiệu đã được sử dụng.');
    }
    throw error;
  }
}

async function setAdminBrandStatus(brandId, isActive) {
  const pool = await getPool();
  const result = await pool.request()
    .input('brandId', sql.Int, brandId)
    .input('isActive', sql.Bit, isActive)
    .query('UPDATE dbo.Brands SET IsActive = @isActive WHERE BrandId = @brandId;');
  if (!result.rowsAffected[0]) throw new AdminBrandServiceError(404, 'BRAND_NOT_FOUND', 'Không tìm thấy thương hiệu.');
  return getAdminBrand(brandId);
}

module.exports = { AdminBrandServiceError, createAdminBrand, getAdminBrand, listAdminBrands, setAdminBrandStatus, updateAdminBrand };
