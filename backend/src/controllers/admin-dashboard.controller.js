const { getAdminDashboard } = require('../services/admin-dashboard.service');

async function getDashboard(req, res) {
  try {
    const data = await getAdminDashboard();
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Admin dashboard API failed:', error.number || error.code || error.name || 'UNKNOWN_ERROR');
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Không thể tải dữ liệu tổng quan lúc này.',
    });
  }
}

module.exports = { getDashboard };
