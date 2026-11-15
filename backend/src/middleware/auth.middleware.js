const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_REQUIRED',
      message: 'Cần cung cấp Bearer token để truy cập tài nguyên này.',
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    console.error('Auth middleware configuration error: JWT_SECRET_MISSING_OR_SHORT');
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Dịch vụ xác thực chưa được cấu hình.',
    });
  }

  try {
    const payload = jwt.verify(match[1], secret, { algorithms: ['HS256'] });
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Token không hợp lệ hoặc đã hết hạn.',
      });
    }

    req.auth = { userId };
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Token không hợp lệ hoặc đã hết hạn.',
    });
  }
}

module.exports = { requireAuth };
