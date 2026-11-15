const {
  AdminBrandServiceError,
  createAdminBrand,
  getAdminBrand,
  listAdminBrands,
  setAdminBrandStatus,
  updateAdminBrand,
} = require('../services/admin-brands.service');

const MAX_INT = 2147483647;

class AdminBrandRequestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readObject(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AdminBrandRequestError(400, 'INVALID_BODY', 'Request body phải là một object JSON.');
  const unknown = Object.keys(body).find((field) => !allowed.includes(field));
  if (unknown) throw new AdminBrandRequestError(400, 'UNKNOWN_FIELDS', `Trường '${unknown}' không được hỗ trợ.`);
  return body;
}

function parseId(value) {
  if (!/^\d+$/.test(value || '')) throw new AdminBrandRequestError(400, 'INVALID_ID', 'brandId phải là số nguyên dương.');
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0 || id > MAX_INT) throw new AdminBrandRequestError(400, 'INVALID_ID', 'brandId nằm ngoài giới hạn.');
  return id;
}

function parseName(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) throw new AdminBrandRequestError(400, 'INVALID_INPUT', `${field} là bắt buộc và tối đa ${maxLength} ký tự.`);
  return value.trim();
}

function parseSlug(value) {
  const slug = parseName(value, 'slug', 140);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new AdminBrandRequestError(400, 'INVALID_SLUG', 'slug chỉ gồm chữ thường không dấu, số và dấu gạch nối đơn.');
  return slug;
}

function parseDescription(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 500) throw new AdminBrandRequestError(400, 'INVALID_DESCRIPTION', 'description phải là chuỗi tối đa 500 ký tự hoặc null.');
  return value.trim() || null;
}

function parseIsActive(value) {
  if (typeof value !== 'boolean') throw new AdminBrandRequestError(400, 'INVALID_STATUS', 'isActive phải là true hoặc false.');
  return value;
}

function parseListQuery(query) {
  const allowed = new Set(['page', 'pageSize', 'search', 'isActive']);
  if (Object.keys(query).some((field) => !allowed.has(field))) throw new AdminBrandRequestError(400, 'UNKNOWN_QUERY_FIELDS', 'Chỉ hỗ trợ page, pageSize, search và isActive.');
  function pagination(value, fallback, field, max) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AdminBrandRequestError(400, 'INVALID_PAGINATION', `${field} phải là số nguyên dương.`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > max) throw new AdminBrandRequestError(400, 'INVALID_PAGINATION', `${field} nằm ngoài giới hạn.`);
    return parsed;
  }
  const page = pagination(query.page, 1, 'page', MAX_INT);
  const pageSize = pagination(query.pageSize, 20, 'pageSize', 100);
  if ((page - 1) * pageSize > MAX_INT) throw new AdminBrandRequestError(400, 'INVALID_PAGINATION', 'page nằm ngoài giới hạn.');
  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.trim().length > 250)) throw new AdminBrandRequestError(400, 'INVALID_SEARCH', 'search tối đa 250 ký tự.');
  let isActive;
  if (query.isActive !== undefined) {
    if (query.isActive !== 'true' && query.isActive !== 'false') throw new AdminBrandRequestError(400, 'INVALID_STATUS', 'isActive chỉ nhận true hoặc false.');
    isActive = query.isActive === 'true';
  }
  return { page, pageSize, search: query.search?.trim(), isActive };
}

function parseCreate(body) {
  readObject(body, ['brandName', 'slug', 'description', 'isActive']);
  return {
    brandName: parseName(body.brandName, 'brandName', 120),
    slug: parseSlug(body.slug),
    description: parseDescription(body.description),
    isActive: body.isActive === undefined ? true : parseIsActive(body.isActive),
  };
}

function parseUpdate(body) {
  readObject(body, ['brandName', 'slug', 'description']);
  const changes = {};
  if (Object.hasOwn(body, 'brandName')) changes.brandName = parseName(body.brandName, 'brandName', 120);
  if (Object.hasOwn(body, 'slug')) changes.slug = parseSlug(body.slug);
  if (Object.hasOwn(body, 'description')) changes.description = parseDescription(body.description);
  if (!Object.keys(changes).length) throw new AdminBrandRequestError(400, 'EMPTY_UPDATE', 'Cần cung cấp ít nhất một trường để cập nhật.');
  return changes;
}

function handleError(res, error) {
  if (error instanceof AdminBrandRequestError || error instanceof AdminBrandServiceError) return res.status(error.status || 400).json({ success: false, code: error.code, message: error.message });
  console.error('Admin brands API failed:', error.number || error.code || error.name || 'UNKNOWN_ERROR');
  return res.status(500).json({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại.' });
}

async function listBrands(req, res) {
  try { return res.json({ success: true, ...await listAdminBrands(parseListQuery(req.query)) }); }
  catch (error) { return handleError(res, error); }
}

async function getBrand(req, res) {
  try { return res.json({ success: true, data: await getAdminBrand(parseId(req.params.brandId)) }); }
  catch (error) { return handleError(res, error); }
}

async function createBrand(req, res) {
  try { return res.status(201).json({ success: true, data: await createAdminBrand(parseCreate(req.body)) }); }
  catch (error) { return handleError(res, error); }
}

async function updateBrand(req, res) {
  try { return res.json({ success: true, data: await updateAdminBrand(parseId(req.params.brandId), parseUpdate(req.body)) }); }
  catch (error) { return handleError(res, error); }
}

async function setBrandStatus(req, res) {
  try {
    readObject(req.body, ['isActive']);
    const isActive = parseIsActive(req.body.isActive);
    return res.json({ success: true, data: await setAdminBrandStatus(parseId(req.params.brandId), isActive) });
  } catch (error) { return handleError(res, error); }
}

module.exports = { createBrand, getBrand, listBrands, setBrandStatus, updateBrand };
