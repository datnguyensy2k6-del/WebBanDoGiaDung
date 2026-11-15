const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const {
  createCategory,
  getCategory,
  listCategories,
  setCategoryStatus,
  updateCategory,
} = require('../controllers/admin-categories.controller');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/', listCategories);
router.get('/:categoryId', getCategory);
router.post('/', createCategory);
router.patch('/:categoryId', updateCategory);
router.patch('/:categoryId/status', setCategoryStatus);

module.exports = router;
