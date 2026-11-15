const {
  createAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
} = require('../services/addresses.service');
const { validateAddress } = require('../utils/user-input');
const { UserApiError, handleUserError } = require('../utils/user-api-error');

function parseAddressId(value) {
  const addressId = Number(value);
  if (!Number.isSafeInteger(addressId) || addressId <= 0) {
    throw new UserApiError(400, 'INVALID_ADDRESS_ID', 'addressId phải là số nguyên dương.');
  }
  return addressId;
}

async function listAddresses(req, res) {
  try {
    const addresses = await getAddresses(req.auth.userId);
    return res.json({ success: true, count: addresses.length, data: addresses });
  } catch (error) {
    return handleUserError(res, error);
  }
}

async function addAddress(req, res) {
  try {
    const address = validateAddress(req.body);
    const createdAddress = await createAddress(req.auth.userId, address);
    return res.status(201).json({ success: true, data: createdAddress });
  } catch (error) {
    return handleUserError(res, error);
  }
}

async function editAddress(req, res) {
  try {
    const addressId = parseAddressId(req.params.addressId);
    const address = validateAddress(req.body, { isUpdate: true });
    const updatedAddress = await updateAddress(req.auth.userId, addressId, address);
    return res.json({ success: true, data: updatedAddress });
  } catch (error) {
    return handleUserError(res, error);
  }
}

async function removeAddress(req, res) {
  try {
    const addressId = parseAddressId(req.params.addressId);
    const deleted = await deleteAddress(req.auth.userId, addressId);
    return res.json({
      success: true,
      message: 'Đã xóa địa chỉ giao hàng.',
      data: deleted,
    });
  } catch (error) {
    return handleUserError(res, error);
  }
}

module.exports = { addAddress, editAddress, listAddresses, removeAddress };
