const {
  AdminProductServiceError,
  createAdminProduct,
  getAdminProduct,
  listAdminProducts,
  setAdminProductStatus,
  updateAdminProduct,
  updateAdminProductStock,
} = require('../services/admin-products.service');

const MAX_INT = 2147483647;
const MAX_PRICE = 10000000000000000;

class AdminProductRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function readObject(body, allowedFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AdminProductRequestError('INVALID_BODY', 'Request body phải là một object JSON.');
  }
  const unknown = Object.keys(body).find((field) => !allowedFields.includes(field));
  if (unknown) {
    throw new AdminProductRequestError('UNKNOWN_FIELDS', `Trường '${unknown}' không được hỗ trợ.`);
  }
  return body;
}

function parseProductId(value) {
  if (!/^\d+$/.test(value || '')) {
    throw new AdminProductRequestError('INVALID_PRODUCT_ID', 'productId phải là số nguyên dương.');
  }
  const productId = Number(value);
  if (!Number.isSafeInteger(productId) || productId <= 0 || productId > MAX_INT) {
    throw new AdminProductRequestError('INVALID_PRODUCT_ID', 'productId nằm ngoài giới hạn cho phép.');
  }
  return productId;
}

function parsePositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_INT) {
    throw new AdminProductRequestError('INVALID_INPUT', `${field} phải là số nguyên dương hợp lệ.`);
  }
  return value;
}

function parseStock(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_INT) {
    throw new AdminProductRequestError('INVALID_STOCK', 'Tồn kho phải là số nguyên từ 0 đến 2147483647.');
  }
  return value;
}

function parsePrice(value) {
  if (typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
    || value >= MAX_PRICE
    || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) {
    throw new AdminProductRequestError('INVALID_PRICE', 'Giá phải là số không âm, tối đa 2 chữ số thập phân và phù hợp DECIMAL(18,2).');
  }
  return value;
}

function parseRequiredText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new AdminProductRequestError('INVALID_INPUT', `${field} là bắt buộc và tối đa ${maxLength} ký tự.`);
  }
  return value.trim();
}

function parseDescription(value) {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new AdminProductRequestError('INVALID_DESCRIPTION', 'description phải là chuỗi hoặc null.');
  }
  return value;
}

function parseImageUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new AdminProductRequestError('INVALID_IMAGE_URL', 'imageUrl pháº£i lÃ  URL chuá»—i há»£p lá»‡.');
  }

  const imageUrl = value.trim();
  if (!imageUrl || imageUrl.length > 500) {
    throw new AdminProductRequestError('INVALID_IMAGE_URL', 'imageUrl khÃ´ng Ä‘Æ°á»£c rá»—ng vÃ  tá»‘i Ä‘a 500 kÃ½ tá»±.');
  }

  const isLocalPath = /^\/(?!\/)[^\s]*$/.test(imageUrl);
  let isHttpUrl = false;
  try {
    const parsed = new URL(imageUrl);
    isHttpUrl = (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && Boolean(parsed.hostname)
      && !parsed.username
      && !parsed.password;
  } catch {
    // Relative site paths are accepted separately.
  }

  if (!isLocalPath && !isHttpUrl) {
    throw new AdminProductRequestError('INVALID_IMAGE_URL', 'imageUrl chá»‰ há»— trá»£ URL HTTP(S) hoáº·c Ä‘Æ°á»ng dáº«n ná»™i bá»™ báº¯t Ä‘áº§u báº±ng /.');
  }
  return imageUrl;
}

function parseListQuery(query) {
  const allowed = new Set(['page', 'pageSize', 'search', 'isActive']);
  if (Object.keys(query).some((key) => !allowed.has(key))) {
    throw new AdminProductRequestError('UNKNOWN_QUERY_FIELDS', 'Chỉ hỗ trợ page, pageSize, search và isActive.');
  }

  function paginationValue(value, fallback, field, max) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
      throw new AdminProductRequestError('INVALID_PAGINATION', `${field} phải là số nguyên dương.`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > max) {
      throw new AdminProductRequestError('INVALID_PAGINATION', `${field} nằm ngoài giới hạn cho phép.`);
    }
    return parsed;
  }

  const page = paginationValue(query.page, 1, 'page', MAX_INT);
  const pageSize = paginationValue(query.pageSize, 20, 'pageSize', 100);
  if ((page - 1) * pageSize > MAX_INT) {
    throw new AdminProductRequestError('INVALID_PAGINATION', 'page nằm ngoài giới hạn cho phép.');
  }

  const search = query.search;
  if (search !== undefined && (typeof search !== 'string' || search.trim().length > 200)) {
    throw new AdminProductRequestError('INVALID_SEARCH', 'search tối đa 200 ký tự.');
  }

  let isActive;
  if (query.isActive !== undefined) {
    if (query.isActive !== 'true' && query.isActive !== 'false') {
      throw new AdminProductRequestError('INVALID_STATUS', 'isActive chỉ nhận true hoặc false.');
    }
    isActive = query.isActive === 'true';
  }

  return { page, pageSize, search: search?.trim(), isActive };
}

function validateCreateBody(body) {
  readObject(body, ['sku', 'productName', 'description', 'categoryId', 'brandId', 'unitPrice', 'stockQuantity', 'imageUrl']);
  return {
    sku: parseRequiredText(body.sku, 'sku', 60),
    productName: parseRequiredText(body.productName, 'productName', 200),
    description: body.description === undefined ? null : parseDescription(body.description),
    categoryId: parsePositiveInteger(body.categoryId, 'categoryId'),
    brandId: parsePositiveInteger(body.brandId, 'brandId'),
    unitPrice: parsePrice(body.unitPrice),
    stockQuantity: body.stockQuantity === undefined ? 0 : parseStock(body.stockQuantity),
    imageUrl: parseImageUrl(body.imageUrl),
  };
}

function validateUpdateBody(body) {
  readObject(body, ['sku', 'productName', 'description', 'categoryId', 'brandId', 'unitPrice', 'imageUrl']);
  const changes = {};
  if (Object.hasOwn(body, 'sku')) changes.sku = parseRequiredText(body.sku, 'sku', 60);
  if (Object.hasOwn(body, 'productName')) changes.productName = parseRequiredText(body.productName, 'productName', 200);
  if (Object.hasOwn(body, 'description')) changes.description = parseDescription(body.description);
  if (Object.hasOwn(body, 'categoryId')) changes.categoryId = parsePositiveInteger(body.categoryId, 'categoryId');
  if (Object.hasOwn(body, 'brandId')) changes.brandId = parsePositiveInteger(body.brandId, 'brandId');
  if (Object.hasOwn(body, 'unitPrice')) changes.unitPrice = parsePrice(body.unitPrice);
  if (Object.hasOwn(body, 'imageUrl')) changes.imageUrl = parseImageUrl(body.imageUrl);
  if (Object.keys(changes).length === 0) {
    throw new AdminProductRequestError('EMPTY_UPDATE', 'Cần cung cấp ít nhất một trường để cập nhật.');
  }
  return changes;
}

function handleAdminProductError(res, error) {
  if (error instanceof AdminProductRequestError || error instanceof AdminProductServiceError) {
    return res.status(error.status || 400).json({ success: false, code: error.code, message: error.message });
  }
  console.error('Admin products API failed:', error.number || error.code || error.name || 'UNKNOWN_ERROR');
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.',
  });
}

async function listProducts(req, res) {
  try {
    const result = await listAdminProducts(parseListQuery(req.query));
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleAdminProductError(res, error);
  }
}

async function getProduct(req, res) {
  try {
    const product = await getAdminProduct(parseProductId(req.params.productId));
    return res.json({ success: true, data: product });
  } catch (error) {
    return handleAdminProductError(res, error);
  }
}

async function createProduct(req, res) {
  try {
    const product = await createAdminProduct(validateCreateBody(req.body), req.auth.userId);
    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    return handleAdminProductError(res, error);
  }
}

async function updateProduct(req, res) {
  try {
    const product = await updateAdminProduct(parseProductId(req.params.productId), validateUpdateBody(req.body));
    return res.json({ success: true, data: product });
  } catch (error) {
    return handleAdminProductError(res, error);
  }
}

async function updateProductStock(req, res) {
  try {
    readObject(req.body, ['stockQuantity']);
    const stockQuantity = parseStock(req.body.stockQuantity);
    const product = await updateAdminProductStock(parseProductId(req.params.productId), stockQuantity, req.auth.userId);
    return res.json({ success: true, data: product });
  } catch (error) {
    return handleAdminProductError(res, error);
  }
}

async function setProductStatus(req, res) {
  try {
    readObject(req.body, ['isActive']);
    if (typeof req.body.isActive !== 'boolean') {
      throw new AdminProductRequestError('INVALID_STATUS', 'isActive phải là true hoặc false.');
    }
    const product = await setAdminProductStatus(parseProductId(req.params.productId), req.body.isActive);
    return res.json({ success: true, data: product });
  } catch (error) {
    return handleAdminProductError(res, error);
  }
}

module.exports = { createProduct, getProduct, listProducts, setProductStatus, updateProduct, updateProductStock };
