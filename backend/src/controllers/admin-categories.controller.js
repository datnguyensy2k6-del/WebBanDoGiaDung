const {
  AdminCategoryServiceError,
  createAdminCategory,
  getAdminCategory,
  listAdminCategories,
  setAdminCategoryStatus,
  updateAdminCategory,
} = require('../services/admin-categories.service');

const MAX_INT = 2147483647;

class AdminCategoryRequestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readObject(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AdminCategoryRequestError(400, 'INVALID_BODY', 'Request body phải là một object JSON.');
  }
  const unknown = Object.keys(body).find((field) => !allowed.includes(field));
  if (unknown) throw new AdminCategoryRequestError(400, 'UNKNOWN_FIELDS', `Trường '${unknown}' không được hỗ trợ.`);
  return body;
}

function parseId(value, field = 'categoryId') {
  if (!/^\d+$/.test(value || '')) throw new AdminCategoryRequestError(400, 'INVALID_ID', `${field} phải là số nguyên dương.`);
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0 || id > MAX_INT) throw new AdminCategoryRequestError(400, 'INVALID_ID', `${field} nằm ngoài giới hạn.`);
  return id;
}

function parseName(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new AdminCategoryRequestError(400, 'INVALID_INPUT', `${field} là bắt buộc và tối đa ${maxLength} ký tự.`);
  }
  return value.trim();
}

function parseSlug(value) {
  const slug = parseName(value, 'slug', 140);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new AdminCategoryRequestError(400, 'INVALID_SLUG', 'slug chỉ gồm chữ thường không dấu, số và dấu gạch nối đơn.');
  }
  return slug;
}

function parseDescription(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 500) {
    throw new AdminCategoryRequestError(400, 'INVALID_DESCRIPTION', 'description phải là chuỗi tối đa 500 ký tự hoặc null.');
  }
  return value.trim() || null;
}

function parseParentId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_INT) {
    throw new AdminCategoryRequestError(400, 'INVALID_PARENT_CATEGORY', 'parentCategoryId phải là số nguyên dương hoặc null.');
  }
  return value;
}

function parseSortOrder(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_INT) {
    throw new AdminCategoryRequestError(400, 'INVALID_SORT_ORDER', 'sortOrder phải là số nguyên từ 0 đến 2147483647.');
  }
  return value;
}

function parseIsActive(value) {
  if (typeof value !== 'boolean') throw new AdminCategoryRequestError(400, 'INVALID_STATUS', 'isActive phải là true hoặc false.');
  return value;
}

function parseListQuery(query) {
  const allowed = new Set(['page', 'pageSize', 'search', 'isActive']);
  if (Object.keys(query).some((field) => !allowed.has(field))) {
    throw new AdminCategoryRequestError(400, 'UNKNOWN_QUERY_FIELDS', 'Chỉ hỗ trợ page, pageSize, search và isActive.');
  }
  function pagination(value, fallback, field, max) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AdminCategoryRequestError(400, 'INVALID_PAGINATION', `${field} phải là số nguyên dương.`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > max) throw new AdminCategoryRequestError(400, 'INVALID_PAGINATION', `${field} nằm ngoài giới hạn.`);
    return parsed;
  }
  const page = pagination(query.page, 1, 'page', MAX_INT);
  const pageSize = pagination(query.pageSize, 20, 'pageSize', 100);
  if ((page - 1) * pageSize > MAX_INT) throw new AdminCategoryRequestError(400, 'INVALID_PAGINATION', 'page nằm ngoài giới hạn.');
  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.trim().length > 250)) {
    throw new AdminCategoryRequestError(400, 'INVALID_SEARCH', 'search tối đa 250 ký tự.');
  }
  let isActive;
  if (query.isActive !== undefined) {
    if (query.isActive !== 'true' && query.isActive !== 'false') throw new AdminCategoryRequestError(400, 'INVALID_STATUS', 'isActive chỉ nhận true hoặc false.');
    isActive = query.isActive === 'true';
  }
  return { page, pageSize, search: query.search?.trim(), isActive };
}

function parseCreate(body) {
  readObject(body, ['categoryName', 'slug', 'description', 'parentCategoryId', 'sortOrder', 'isActive']);
  return {
    categoryName: parseName(body.categoryName, 'categoryName', 120),
    slug: parseSlug(body.slug),
    description: parseDescription(body.description),
    parentCategoryId: parseParentId(body.parentCategoryId),
    sortOrder: body.sortOrder === undefined ? 0 : parseSortOrder(body.sortOrder),
    isActive: body.isActive === undefined ? true : parseIsActive(body.isActive),
  };
}

function parseUpdate(body) {
  readObject(body, ['categoryName', 'slug', 'description', 'parentCategoryId', 'sortOrder']);
  const changes = {};
  if (Object.hasOwn(body, 'categoryName')) changes.categoryName = parseName(body.categoryName, 'categoryName', 120);
  if (Object.hasOwn(body, 'slug')) changes.slug = parseSlug(body.slug);
  if (Object.hasOwn(body, 'description')) changes.description = parseDescription(body.description);
  if (Object.hasOwn(body, 'parentCategoryId')) changes.parentCategoryId = parseParentId(body.parentCategoryId);
  if (Object.hasOwn(body, 'sortOrder')) changes.sortOrder = parseSortOrder(body.sortOrder);
  if (!Object.keys(changes).length) throw new AdminCategoryRequestError(400, 'EMPTY_UPDATE', 'Cần cung cấp ít nhất một trường để cập nhật.');
  return changes;
}

function handleError(res, error) {
  if (error instanceof AdminCategoryRequestError || error instanceof AdminCategoryServiceError) {
    return res.status(error.status || 400).json({ success: false, code: error.code, message: error.message });
  }
  console.error('Admin categories API failed:', error.number || error.code || error.name || 'UNKNOWN_ERROR');
  return res.status(500).json({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại.' });
}

async function listCategories(req, res) {
  try {
    const result = await listAdminCategories(parseListQuery(req.query));
    return res.json({ success: true, ...result });
  } catch (error) { return handleError(res, error); }
}

async function getCategory(req, res) {
  try { return res.json({ success: true, data: await getAdminCategory(parseId(req.params.categoryId)) }); }
  catch (error) { return handleError(res, error); }
}

async function createCategory(req, res) {
  try { return res.status(201).json({ success: true, data: await createAdminCategory(parseCreate(req.body)) }); }
  catch (error) { return handleError(res, error); }
}

async function updateCategory(req, res) {
  try { return res.json({ success: true, data: await updateAdminCategory(parseId(req.params.categoryId), parseUpdate(req.body)) }); }
  catch (error) { return handleError(res, error); }
}

async function setCategoryStatus(req, res) {
  try {
    readObject(req.body, ['isActive']);
    const isActive = parseIsActive(req.body.isActive);
    return res.json({ success: true, data: await setAdminCategoryStatus(parseId(req.params.categoryId), isActive) });
  } catch (error) { return handleError(res, error); }
}

module.exports = { createCategory, getCategory, listCategories, setCategoryStatus, updateCategory };
