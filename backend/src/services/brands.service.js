const { createPool } = require('../config/database');

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

async function getActiveBrands() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      BrandId AS brandId,
      BrandName AS brandName,
      Slug AS slug,
      Description AS description
    FROM dbo.Brands
    WHERE IsActive = 1
    ORDER BY BrandName ASC, BrandId ASC;
  `);

  return result.recordset;
}

module.exports = { getActiveBrands };
