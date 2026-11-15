const {
  AdminOrderServiceError,
  confirmAdminOrder,
  getAdminOrder,
  listAdminOrders,
} = require('../services/admin-orders.service');

const MAX_INT = 2147483647;
const ORDER_STATUSES = new Set([
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPING',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
]);

class AdminOrderRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function parsePositiveInteger(value, fieldName, max = MAX_INT) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new AdminOrderRequestError('INVALID_INPUT', `${fieldName} phải là số nguyên dương.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new AdminOrderRequestError('INVALID_INPUT', `${fieldName} nằm ngoài giới hạn cho phép.`);
  }
  return parsed;
}

function parseOrderId(value) {
  return parsePositiveInteger(value, 'orderId');
}

function parseListQuery(query) {
  const allowed = new Set(['page', 'pageSize', 'orderStatus', 'orderNumber']);
  if (Object.keys(query).some((key) => !allowed.has(key))) {
    throw new AdminOrderRequestError('UNKNOWN_QUERY_FIELDS', 'Chỉ hỗ trợ page, pageSize, orderStatus và orderNumber.');
  }

  const page = query.page === undefined ? 1 : parsePositiveInteger(query.page, 'page');
  const pageSize = query.pageSize === undefined ? 20 : parsePositiveInteger(query.pageSize, 'pageSize', 100);
  if ((page - 1) * pageSize > MAX_INT) {
    throw new AdminOrderRequestError('INVALID_PAGINATION', 'Trang nằm ngoài giới hạn cho phép.');
  }

  const orderStatus = query.orderStatus;
  if (orderStatus !== undefined && (typeof orderStatus !== 'string' || !ORDER_STATUSES.has(orderStatus))) {
    throw new AdminOrderRequestError('INVALID_ORDER_STATUS', 'orderStatus không hợp lệ.');
  }

  const orderNumber = query.orderNumber;
  if (orderNumber !== undefined && (typeof orderNumber !== 'string' || !orderNumber.trim() || orderNumber.trim().length > 40)) {
    throw new AdminOrderRequestError('INVALID_ORDER_NUMBER', 'orderNumber phải có từ 1 đến 40 ký tự.');
  }

  return {
    page,
    pageSize,
    orderStatus,
    orderNumber: orderNumber?.trim(),
  };
}

function handleAdminOrderError(res, error) {
  if (error instanceof AdminOrderRequestError || error instanceof AdminOrderServiceError) {
    return res.status(error.status || 400).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }

  console.error('Admin orders API failed:', error.number || error.code || error.name || 'UNKNOWN_ERROR');
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.',
  });
}

async function listOrders(req, res) {
  try {
    const result = await listAdminOrders(parseListQuery(req.query));
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleAdminOrderError(res, error);
  }
}

async function getOrder(req, res) {
  try {
    const order = await getAdminOrder(parseOrderId(req.params.orderId));
    return res.json({ success: true, data: order });
  } catch (error) {
    return handleAdminOrderError(res, error);
  }
}

async function confirmOrder(req, res) {
  try {
    const order = await confirmAdminOrder(parseOrderId(req.params.orderId), req.auth.userId);
    return res.json({ success: true, data: order });
  } catch (error) {
    return handleAdminOrderError(res, error);
  }
}

module.exports = { confirmOrder, getOrder, listOrders };
