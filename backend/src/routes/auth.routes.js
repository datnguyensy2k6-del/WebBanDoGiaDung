const express = require('express');
const { getMe, loginAccount, registerAccount } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', registerAccount);
router.post('/login', loginAccount);
router.get('/me', requireAuth, getMe);

module.exports = router;
