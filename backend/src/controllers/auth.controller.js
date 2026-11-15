const { AuthError, getCurrentUser, login, register } = require('../services/auth.service');

function handleAuthError(res, error) {
  if (error instanceof AuthError) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }

  console.error('Auth request failed:', error.code || error.name || 'UNKNOWN_ERROR');
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.',
  });
}

async function registerAccount(req, res) {
  try {
    const result = await register(req.body || {});
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    return handleAuthError(res, error);
  }
}

async function loginAccount(req, res) {
  try {
    const result = await login(req.body || {});
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleAuthError(res, error);
  }
}

async function getMe(req, res) {
  try {
    const user = await getCurrentUser(req.auth.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'ACCOUNT_UNAVAILABLE',
        message: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.',
      });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    return handleAuthError(res, error);
  }
}

module.exports = { getMe, loginAccount, registerAccount };
