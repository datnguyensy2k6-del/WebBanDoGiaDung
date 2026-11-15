const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');
const { getDashboard } = require('../controllers/admin-dashboard.controller');

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get('/', getDashboard);

module.exports = router;
