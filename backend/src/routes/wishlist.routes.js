const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  addWishlistItem,
  getWishlist,
  removeWishlistItem,
} = require('../controllers/wishlist.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', getWishlist);
router.post('/items', addWishlistItem);
router.delete('/items/:productId', removeWishlistItem);

module.exports = router;
