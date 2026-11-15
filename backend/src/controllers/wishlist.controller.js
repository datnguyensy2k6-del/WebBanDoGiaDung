const {
  addProductToWishlist,
  getUserWishlist,
  removeProductFromWishlist,
} = require('../services/wishlist.service');

class WishlistRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function validateProductId(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new WishlistRequestError('INVALID_PRODUCT_ID', 'productId phải là số nguyên dương.');
  }
  return value;
}

function parsePathProductId(value) {
  if (!/^\d+$/.test(value || '')) {
    throw new WishlistRequestError('INVALID_PRODUCT_ID', 'productId phải là số nguyên dương.');
  }
  return validateProductId(Number(value));
}

function validateAddBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new WishlistRequestError('INVALID_BODY', 'Request body phải là một object JSON.');
  }
  const keys = Object.keys(body);
  if (keys.some((key) => key !== 'productId')) {
    throw new WishlistRequestError('UNKNOWN_FIELDS', 'Request body chỉ được chứa productId.');
  }
  return validateProductId(body.productId);
}

function handleWishlistError(res, error) {
  if (error instanceof WishlistRequestError) {
    return res.status(400).json({ success: false, code: error.code, message: error.message });
  }
  if (error && error.status && error.code) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }

  console.error('Wishlist API request failed:', error.number || error.code || error.name || 'UNKNOWN_ERROR');
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.',
  });
}

async function getWishlist(req, res) {
  try {
    const items = await getUserWishlist(req.auth.userId);
    return res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    return handleWishlistError(res, error);
  }
}

async function addWishlistItem(req, res) {
  try {
    const productId = validateAddBody(req.body);
    const item = await addProductToWishlist(req.auth.userId, productId);
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    return handleWishlistError(res, error);
  }
}

async function removeWishlistItem(req, res) {
  try {
    const productId = parsePathProductId(req.params.productId);
    const result = await removeProductFromWishlist(req.auth.userId, productId);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleWishlistError(res, error);
  }
}

module.exports = { addWishlistItem, getWishlist, removeWishlistItem };
