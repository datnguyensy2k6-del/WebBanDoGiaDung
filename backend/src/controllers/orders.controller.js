const {
  cancelCustomerOrder,
  createCustomerOrder,
  getCustomerOrder,
  getCustomerOrders,
} = require('../services/orders.service');

class OrderRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const MAX_INT = 2147483647;

function validateObjectBody(body, allowedKeys) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new OrderRequestError('INVALID_BODY', 'Request body phải là một object JSON.');
  }
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    throw new OrderRequestError('UNKNOWN_FIELDS', 'Request body chứa trường không được hỗ trợ.');
  }
}

function parsePositiveInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_INT) {
    throw new OrderRequestError('INVALID_INPUT', `${fieldName} phải là số nguyên dương hợp lệ.`);
  }
  return value;
}

function parsePathOrderId(value) {
  if (!/^\d+$/.test(value || '')) {
    throw new OrderRequestError('INVALID_ORDER_ID', 'orderId phải là số nguyên dương.');
  }
  return parsePositiveInteger(Number(value), 'orderId');
}

function validateCreateBody(body) {
  validateObjectBody(body, ['addressId', 'paymentMethod', 'customerNote']);
  const addressId = parsePositiveInteger(body.addressId, 'addressId');
  if (!['COD', 'ONLINE'].includes(body.paymentMethod)) {
    throw new OrderRequestError('INVALID_PAYMENT_METHOD', 'paymentMethod chỉ nhận COD hoặc ONLINE.');
  }

  let customerNote = null;
  if (body.customerNote !== undefined && body.customerNote !== null) {
    if (typeof body.customerNote !== 'string') {
      throw new OrderRequestError('INVALID_CUSTOMER_NOTE', 'customerNote phải là chuỗi hoặc null.');
    }
    customerNote = body.customerNote.trim() || null;
    if (customerNote && customerNote.length > 1000) {
      throw new OrderRequestError('INVALID_CUSTOMER_NOTE', 'customerNote tối đa 1000 ký tự.');
    }
  }
  return { addressId, paymentMethod: body.paymentMethod, customerNote };
}

function parsePagination(query) {
  const allowed = ['page', 'pageSize'];
  if (Object.keys(query).some((key) => !allowed.includes(key))) {
    throw new OrderRequestError('UNKNOWN_QUERY_FIELDS', 'Chỉ hỗ trợ query page và pageSize.');
  }

  function parse(value, fallback, fieldName, max) {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
      throw new OrderRequestError('INVALID_PAGINATION', `${fieldName} phải là số nguyên dương.`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > max) {
      throw new OrderRequestError('INVALID_PAGINATION', `${fieldName} nằm ngoài giới hạn cho phép.`);
    }
    return parsed;
  }

  const page = parse(query.page, 1, 'page', MAX_INT);
  const pageSize = parse(query.pageSize, 20, 'pageSize', 100);
  if ((page - 1) * pageSize > MAX_INT) {
    throw new OrderRequestError('INVALID_PAGINATION', 'page nằm ngoài giới hạn cho phép.');
  }
  return {
    page,
    pageSize,
  };
}

function handleOrderError(res, error) {
  if (error instanceof OrderRequestError) {
    return res.status(400).json({ success: false, code: error.code, message: error.message });
  }
  if (error && error.status && error.code) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }

  // Log only a non-sensitive SQL/application error identifier, never request data or tokens.
  console.error('Orders API request failed:', error.number || error.code || error.name || 'UNKNOWN_ERROR');
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.',
  });
}

async function createOrder(req, res) {
  try {
    const input = validateCreateBody(req.body);
    const order = await createCustomerOrder(req.auth.userId, input);
    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    return handleOrderError(res, error);
  }
}

async function listOrders(req, res) {
  try {
    const pagination = parsePagination(req.query);
    const result = await getCustomerOrders(req.auth.userId, pagination);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleOrderError(res, error);
  }
}

async function getOrder(req, res) {
  try {
    const orderId = parsePathOrderId(req.params.orderId);
    const order = await getCustomerOrder(req.auth.userId, orderId);
    return res.json({ success: true, data: order });
  } catch (error) {
    return handleOrderError(res, error);
  }
}

async function cancelOrder(req, res) {
  try {
    const orderId = parsePathOrderId(req.params.orderId);
    const order = await cancelCustomerOrder(req.auth.userId, orderId);
    return res.json({ success: true, data: order });
  } catch (error) {
    return handleOrderError(res, error);
  }
}

module.exports = { cancelOrder, createOrder, getOrder, listOrders };
