const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const {
  createBrand,
  getBrand,
  listBrands,
  setBrandStatus,
  updateBrand,
} = require('../controllers/admin-brands.controller');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/', listBrands);
router.get('/:brandId', getBrand);
router.post('/', createBrand);
router.patch('/:brandId', updateBrand);
router.patch('/:brandId/status', setBrandStatus);

module.exports = router;
