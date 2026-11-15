const { sql, createPool } = require('../config/database');

class AdminCategoryServiceError extends Error {
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

const CATEGORY_SELECT = `
  SELECT category.CategoryId AS categoryId,
         category.ParentCategoryId AS parentCategoryId,
         parent.CategoryName AS parentCategoryName,
         category.CategoryName AS categoryName,
         category.Slug AS slug,
         category.Description AS description,
         category.IsActive AS isActive,
         category.SortOrder AS sortOrder,
         category.CreatedAt AS createdAt
  FROM dbo.Categories AS category
  LEFT JOIN dbo.Categories AS parent ON parent.CategoryId = category.ParentCategoryId
`;

async function listAdminCategories({ page, pageSize, search, isActive }) {
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
    conditions.push("(category.CategoryName LIKE @search ESCAPE '~' OR category.Slug LIKE @search ESCAPE '~')");
    countRequest.input('search', sql.NVarChar(300), pattern);
    listRequest.input('search', sql.NVarChar(300), pattern);
  }
  if (isActive !== undefined) {
    conditions.push('category.IsActive = @isActive');
    countRequest.input('isActive', sql.Bit, isActive);
    listRequest.input('isActive', sql.Bit, isActive);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [total, categories] = await Promise.all([
    countRequest.query(`SELECT COUNT_BIG(*) AS totalCount FROM dbo.Categories AS category ${whereClause};`),
    listRequest.query(`${CATEGORY_SELECT} ${whereClause} ORDER BY category.SortOrder, category.CategoryName, category.CategoryId OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;`),
  ]);
  return { page, pageSize, totalCount: Number(total.recordset[0].totalCount), data: categories.recordset };
}

async function getAdminCategory(categoryId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('categoryId', sql.Int, categoryId)
    .query(`${CATEGORY_SELECT} WHERE category.CategoryId = @categoryId;`);
  if (!result.recordset.length) throw new AdminCategoryServiceError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục.');
  return result.recordset[0];
}

async function validateParent(request, categoryId, parentCategoryId) {
  if (parentCategoryId === null) return;
  if (categoryId !== undefined && parentCategoryId === categoryId) {
    throw new AdminCategoryServiceError(400, 'CATEGORY_SELF_PARENT', 'Danh mục không thể tự làm danh mục cha.');
  }

  const parent = await request
    .input('parentCategoryId', sql.Int, parentCategoryId)
    .query('SELECT CategoryId FROM dbo.Categories WITH (UPDLOCK, HOLDLOCK) WHERE CategoryId = @parentCategoryId;');
  if (!parent.recordset.length) throw new AdminCategoryServiceError(400, 'PARENT_CATEGORY_NOT_FOUND', 'Danh mục cha không tồn tại.');

  if (categoryId !== undefined) {
    const descendant = await request
      .input('categoryId', sql.Int, categoryId)
      .query(`
        ;WITH parentChain AS (
          SELECT CategoryId, ParentCategoryId
          FROM dbo.Categories
          WHERE CategoryId = @parentCategoryId
          UNION ALL
          SELECT parent.CategoryId, parent.ParentCategoryId
          FROM dbo.Categories AS parent
          INNER JOIN parentChain AS child ON parent.CategoryId = child.ParentCategoryId
        )
        SELECT TOP (1) CategoryId FROM parentChain WHERE CategoryId = @categoryId
        OPTION (MAXRECURSION 32767);
      `);
    if (descendant.recordset.length) {
      throw new AdminCategoryServiceError(400, 'CATEGORY_PARENT_CYCLE', 'Không thể chọn danh mục con làm danh mục cha vì sẽ tạo vòng lặp.');
    }
  }
}

async function createAdminCategory(input) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let started = false;
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    started = true;
    await validateParent(transaction.request(), undefined, input.parentCategoryId);
    const result = await transaction.request()
      .input('categoryName', sql.NVarChar(120), input.categoryName)
      .input('slug', sql.NVarChar(140), input.slug)
      .input('description', sql.NVarChar(500), input.description)
      .input('parentCategoryId', sql.Int, input.parentCategoryId)
      .input('sortOrder', sql.Int, input.sortOrder)
      .input('isActive', sql.Bit, input.isActive)
      .query(`
        INSERT INTO dbo.Categories (CategoryName, Slug, Description, ParentCategoryId, SortOrder, IsActive)
        OUTPUT INSERTED.CategoryId AS categoryId
        VALUES (@categoryName, @slug, @description, @parentCategoryId, @sortOrder, @isActive);
      `);
    const categoryId = result.recordset[0].categoryId;
    const category = await readCategory(transaction.request(), categoryId);
    await transaction.commit();
    return category;
  } catch (error) {
    if (started) await transaction.rollback().catch(() => {});
    if (error.number === 2601 || error.number === 2627) {
      throw new AdminCategoryServiceError(409, 'CATEGORY_SLUG_EXISTS', 'Slug danh mục đã được sử dụng.');
    }
    throw error;
  }
}

async function readCategory(request, categoryId) {
  const result = await request.input('categoryId', sql.Int, categoryId)
    .query(`${CATEGORY_SELECT} WHERE category.CategoryId = @categoryId;`);
  if (!result.recordset.length) throw new AdminCategoryServiceError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục.');
  return result.recordset[0];
}

async function updateAdminCategory(categoryId, changes) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let started = false;
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    started = true;
    const currentResult = await transaction.request()
      .input('categoryId', sql.Int, categoryId)
      .query('SELECT CategoryId, ParentCategoryId FROM dbo.Categories WITH (UPDLOCK, HOLDLOCK) WHERE CategoryId = @categoryId;');
    if (!currentResult.recordset.length) throw new AdminCategoryServiceError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục.');

    if (Object.hasOwn(changes, 'parentCategoryId')) {
      await validateParent(transaction.request(), categoryId, changes.parentCategoryId);
    }
    const request = transaction.request().input('categoryId', sql.Int, categoryId);
    const assignments = [];
    for (const [field, column, type] of [
      ['categoryName', 'CategoryName', sql.NVarChar(120)],
      ['slug', 'Slug', sql.NVarChar(140)],
      ['description', 'Description', sql.NVarChar(500)],
      ['parentCategoryId', 'ParentCategoryId', sql.Int],
      ['sortOrder', 'SortOrder', sql.Int],
    ]) {
      if (!Object.hasOwn(changes, field)) continue;
      request.input(field, type, changes[field]);
      assignments.push(`${column} = @${field}`);
    }
    await request.query(`UPDATE dbo.Categories SET ${assignments.join(', ')} WHERE CategoryId = @categoryId;`);
    const category = await readCategory(transaction.request(), categoryId);
    await transaction.commit();
    return category;
  } catch (error) {
    if (started) await transaction.rollback().catch(() => {});
    if (error.number === 2601 || error.number === 2627) {
      throw new AdminCategoryServiceError(409, 'CATEGORY_SLUG_EXISTS', 'Slug danh mục đã được sử dụng.');
    }
    throw error;
  }
}

async function setAdminCategoryStatus(categoryId, isActive) {
  const pool = await getPool();
  const result = await pool.request()
    .input('categoryId', sql.Int, categoryId)
    .input('isActive', sql.Bit, isActive)
    .query('UPDATE dbo.Categories SET IsActive = @isActive WHERE CategoryId = @categoryId;');
  if (!result.rowsAffected[0]) throw new AdminCategoryServiceError(404, 'CATEGORY_NOT_FOUND', 'Không tìm thấy danh mục.');
  return getAdminCategory(categoryId);
}

module.exports = { AdminCategoryServiceError, createAdminCategory, getAdminCategory, listAdminCategories, setAdminCategoryStatus, updateAdminCategory };
