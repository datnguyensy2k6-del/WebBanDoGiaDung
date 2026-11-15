const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const {
  createProduct,
  getProduct,
  listProducts,
  setProductStatus,
  updateProduct,
  updateProductStock,
} = require('../controllers/admin-products.controller');

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get('/', listProducts);
router.get('/:productId', getProduct);
router.post('/', createProduct);
router.patch('/:productId', updateProduct);
router.patch('/:productId/stock', updateProductStock);
router.patch('/:productId/status', setProductStatus);

module.exports = router;
