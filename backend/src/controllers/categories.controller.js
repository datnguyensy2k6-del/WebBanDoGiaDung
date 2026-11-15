const { getActiveCategories } = require('../services/categories.service');

async function listCategories(req, res) {
  try {
    const categories = await getActiveCategories();

    return res.json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error('GET /api/categories failed:', error.message);

    return res.status(500).json({
      success: false,
      count: 0,
      data: [],
      message: 'Không thể tải danh sách danh mục.',
    });
  }
}

module.exports = { listCategories };
