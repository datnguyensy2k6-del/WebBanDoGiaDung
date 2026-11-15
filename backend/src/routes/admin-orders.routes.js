const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const {
  confirmOrder,
  getOrder,
  listOrders,
} = require('../controllers/admin-orders.controller');

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get('/', listOrders);
router.get('/:orderId', getOrder);
router.patch('/:orderId/confirm', confirmOrder);

module.exports = router;
