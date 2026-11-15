const { getActiveProducts } = require('../services/products.service');

async function listProducts(req, res) {
  try {
    const products = await getActiveProducts();

    return res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('GET /api/products failed:', error.message);

    return res.status(500).json({
      success: false,
      count: 0,
      data: [],
      message: 'Không thể tải danh sách sản phẩm.',
    });
  }
}

module.exports = { listProducts };
