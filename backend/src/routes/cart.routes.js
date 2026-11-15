const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  addItem,
  clearCart,
  getCart,
  removeItem,
  setItemQuantity,
} = require('../controllers/cart.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', getCart);
router.post('/items', addItem);
router.put('/items/:productId', setItemQuantity);
router.delete('/items/:productId', removeItem);
router.delete('/', clearCart);

module.exports = router;
