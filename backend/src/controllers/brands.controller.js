const { getActiveBrands } = require('../services/brands.service');

async function listBrands(req, res) {
  try {
    const brands = await getActiveBrands();

    return res.json({
      success: true,
      count: brands.length,
      data: brands,
    });
  } catch (error) {
    console.error('GET /api/brands failed:', error.message);

    return res.status(500).json({
      success: false,
      count: 0,
      data: [],
      message: 'Không thể tải danh sách thương hiệu.',
    });
  }
}

module.exports = { listBrands };
