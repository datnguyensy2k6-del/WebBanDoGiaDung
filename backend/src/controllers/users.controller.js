const { getProfile, updateProfile } = require('../services/users.service');
const { validateProfileUpdate } = require('../utils/user-input');
const { handleUserError } = require('../utils/user-api-error');

async function getMe(req, res) {
  try {
    const user = await getProfile(req.auth.userId);
    return res.json({ success: true, data: user });
  } catch (error) {
    return handleUserError(res, error);
  }
}

async function updateMe(req, res) {
  try {
    const changes = validateProfileUpdate(req.body);
    const user = await updateProfile(req.auth.userId, changes);
    return res.json({ success: true, data: user });
  } catch (error) {
    return handleUserError(res, error);
  }
}

module.exports = { getMe, updateMe };
