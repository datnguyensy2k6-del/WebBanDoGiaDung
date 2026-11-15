const {
  addProduct,
  clearUserCart,
  getUserCart,
  removeProduct,
  updateProductQuantity,
} = require('../services/cart.service');

class CartRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function validateObjectBody(body, allowedKeys) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new CartRequestError('INVALID_BODY', 'Request body phải là một object JSON.');
  }
  const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new CartRequestError('UNKNOWN_FIELDS', 'Request body chứa trường không được hỗ trợ.');
  }
}

function parsePositiveInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new CartRequestError('INVALID_INPUT', `${fieldName} phải là số nguyên dương.`);
  }
  return value;
}

function parseProductId(value) {
  if (!/^\d+$/.test(value || '')) {
    throw new CartRequestError('INVALID_PRODUCT_ID', 'productId phải là số nguyên dương.');
  }
  return parsePositiveInteger(Number(value), 'productId');
}

function handleCartError(res, error) {
  if (error instanceof CartRequestError) {
    return res.status(400).json({ success: false, code: error.code, message: error.message });
  }
  if (error && error.status && error.code) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }

  console.error('Cart API request failed:', error.number || error.code || error.name || 'UNKNOWN_ERROR');
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.',
  });
}

async function getCart(req, res) {
  try {
    return res.json({ success: true, data: await getUserCart(req.auth.userId) });
  } catch (error) {
    return handleCartError(res, error);
  }
}

async function addItem(req, res) {
  try {
    validateObjectBody(req.body, ['productId', 'quantity']);
    const productId = parsePositiveInteger(req.body.productId, 'productId');
    const quantity = parsePositiveInteger(req.body.quantity, 'quantity');
    const data = await addProduct(req.auth.userId, productId, quantity);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleCartError(res, error);
  }
}

async function setItemQuantity(req, res) {
  try {
    const productId = parseProductId(req.params.productId);
    validateObjectBody(req.body, ['quantity']);
    const quantity = parsePositiveInteger(req.body.quantity, 'quantity');
    const data = await updateProductQuantity(req.auth.userId, productId, quantity);
    return res.json({ success: true, data });
  } catch (error) {
    return handleCartError(res, error);
  }
}

async function removeItem(req, res) {
  try {
    const productId = parseProductId(req.params.productId);
    const data = await removeProduct(req.auth.userId, productId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleCartError(res, error);
  }
}

async function clearCart(req, res) {
  try {
    return res.json({ success: true, data: await clearUserCart(req.auth.userId) });
  } catch (error) {
    return handleCartError(res, error);
  }
}

module.exports = { addItem, clearCart, getCart, removeItem, setItemQuantity };
