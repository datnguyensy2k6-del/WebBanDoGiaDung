const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  cancelOrder,
  createOrder,
  getOrder,
  listOrders,
} = require('../controllers/orders.controller');

const router = express.Router();

router.use(requireAuth);

router.post('/', createOrder);
router.get('/', listOrders);
router.patch('/:orderId/cancel', cancelOrder);
router.get('/:orderId', getOrder);

module.exports = router;
