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

async function getActiveCategories() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      category.CategoryId AS categoryId,
      CASE
        WHEN parent.CategoryId IS NULL THEN NULL
        ELSE category.ParentCategoryId
      END AS parentCategoryId,
      parent.CategoryName AS parentCategoryName,
      category.CategoryName AS categoryName,
      category.Slug AS slug,
      category.Description AS description,
      category.SortOrder AS sortOrder
    FROM dbo.Categories AS category
    LEFT JOIN dbo.Categories AS parent
      ON parent.CategoryId = category.ParentCategoryId
      AND parent.IsActive = 1
    WHERE category.IsActive = 1
    ORDER BY
      CASE WHEN parent.CategoryId IS NULL THEN 0 ELSE 1 END,
      COALESCE(parent.SortOrder, category.SortOrder),
      parent.CategoryName,
      category.SortOrder,
      category.CategoryName,
      category.CategoryId;
  `);

  return result.recordset;
}

module.exports = { getActiveCategories };
