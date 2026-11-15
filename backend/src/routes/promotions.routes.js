const express = require('express');
const { listPromotions } = require('../controllers/promotions.controller');

const router = express.Router();

router.get('/', listPromotions);

module.exports = router;
