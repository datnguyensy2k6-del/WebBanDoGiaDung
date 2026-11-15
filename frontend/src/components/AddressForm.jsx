import { useState } from 'react'

const blankAddress = {
  recipientName: '',
  phone: '',
  province: '',
  district: '',
  ward: '',
  addressLine: '',
  isDefault: false,
}

function AddressForm({ address, onSave, onCancel }) {
  const [form, setForm] = useState(() => address ? {
    recipientName: address.recipientName || '',
    phone: address.phone || '',
    province: address.province || '',
    district: address.district || '',
    ward: address.ward || '',
    addressLine: address.addressLine || '',
    isDefault: Boolean(address.isDefault),
  } : blankAddress)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(event) {
    const { name, value, checked, type } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({
        recipientName: form.recipientName.trim(),
        phone: form.phone.trim(),
        province: form.province.trim(),
        district: form.district.trim(),
        ward: form.ward.trim(),
        addressLine: form.addressLine.trim(),
        isDefault: form.isDefault,
      })
    } catch (saveError) {
      setError(saveError?.message || 'Không thể lưu địa chỉ. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return <form className="address-form" onSubmit={submit}>
    <div className="address-form-grid">
      <label>Người nhận<input name="recipientName" autoComplete="name" maxLength={150} value={form.recipientName} onChange={update} required /></label>
      <label>Số điện thoại<input name="phone" type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={update} required /></label>
      <label>Tỉnh / thành phố<input name="province" autoComplete="address-level1" maxLength={100} value={form.province} onChange={update} required /></label>
      <label>Quận / huyện<input name="district" autoComplete="address-level2" maxLength={100} value={form.district} onChange={update} required /></label>
      <label>Phường / xã<input name="ward" maxLength={100} value={form.ward} onChange={update} required /></label>
      <label className="address-line-field">Địa chỉ cụ thể<input name="addressLine" autoComplete="street-address" maxLength={250} value={form.addressLine} onChange={update} required /></label>
    </div>
    <label className="default-address-check"><input name="isDefault" type="checkbox" checked={form.isDefault} onChange={update} /> Đặt làm địa chỉ mặc định</label>
    {error && <p className="order-error" role="alert">{error}</p>}
    <div className="address-form-actions"><button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : address ? 'Lưu địa chỉ' : 'Thêm địa chỉ'}</button><button className="address-form-cancel" type="button" disabled={saving} onClick={onCancel}>Hủy</button></div>
  </form>
}

export default AddressForm
