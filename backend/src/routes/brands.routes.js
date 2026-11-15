const express = require('express');
const { listBrands } = require('../controllers/brands.controller');

const router = express.Router();

router.get('/', listBrands);

module.exports = router;
