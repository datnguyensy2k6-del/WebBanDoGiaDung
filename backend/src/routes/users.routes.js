const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  addAddress,
  editAddress,
  listAddresses,
  removeAddress,
} = require('../controllers/addresses.controller');
const { getMe, updateMe } = require('../controllers/users.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/me/addresses', listAddresses);
router.post('/me/addresses', addAddress);
router.put('/me/addresses/:addressId', editAddress);
router.delete('/me/addresses/:addressId', removeAddress);
router.get('/me', getMe);
router.put('/me', updateMe);

module.exports = router;
