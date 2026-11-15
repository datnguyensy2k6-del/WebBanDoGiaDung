const { getCurrentPromotions } = require('../services/promotions.service');

async function listPromotions(req, res) {
  try {
    const promotions = await getCurrentPromotions();

    return res.json({
      success: true,
      count: promotions.length,
      data: promotions,
    });
  } catch (error) {
    console.error('GET /api/promotions failed:', error.message);

    return res.status(500).json({
      success: false,
      count: 0,
      data: [],
      message: 'Không thể tải danh sách khuyến mãi.',
    });
  }
}

module.exports = { listPromotions };
