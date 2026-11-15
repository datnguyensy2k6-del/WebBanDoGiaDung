import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'
import AddressForm from '../components/AddressForm.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { LoginRequired } from './OrderPages.jsx'

function AccountPage() {
  const { user, updateCurrentUser } = useAuth()
  const [profile, setProfile] = useState(user)
  const [profileStatus, setProfileStatus] = useState('loading')
  const [profileError, setProfileError] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ fullName: user?.fullName || '', phone: user?.phone || '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileNotice, setProfileNotice] = useState('')
  const [addresses, setAddresses] = useState([])
  const [addressStatus, setAddressStatus] = useState('loading')
  const [addressError, setAddressError] = useState('')
  const [addressNotice, setAddressNotice] = useState('')
  const [addingAddress, setAddingAddress] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState(null)
  const [deletingAddressId, setDeletingAddressId] = useState(null)

  const loadProfile = useCallback(async () => {
    setProfileStatus('loading')
    try {
      const response = await api.get('/users/me')
      if (!response?.success || !response.data) throw new Error('Phản hồi hồ sơ từ máy chủ không hợp lệ.')
      setProfile(response.data)
      setProfileForm({ fullName: response.data.fullName || '', phone: response.data.phone || '' })
      updateCurrentUser(response.data)
      setProfileStatus('success')
      setProfileError('')
    } catch (error) {
      setProfileStatus('error')
      setProfileError(error?.message || 'Không thể tải hồ sơ tài khoản.')
    }
  }, [updateCurrentUser])

  const loadAddresses = useCallback(async () => {
    setAddressStatus('loading')
    try {
      const response = await api.get('/users/me/addresses')
      if (!response?.success || !Array.isArray(response.data)) throw new Error('Phản hồi địa chỉ từ máy chủ không hợp lệ.')
      setAddresses(response.data)
      setAddressStatus('success')
      setAddressError('')
      return response.data
    } catch (error) {
      setAddressStatus('error')
      setAddressError(error?.message || 'Không thể tải địa chỉ giao hàng.')
      throw error
    }
  }, [])

  useEffect(() => {
    if (!user) return
    loadProfile()
    loadAddresses().catch(() => {})
  }, [user?.userId, loadProfile, loadAddresses])

  if (!user) return <LoginRequired title="Thông tin tài khoản" />

  async function saveProfile(event) {
    event.preventDefault()
    setProfileSaving(true)
    setProfileError('')
    setProfileNotice('')
    try {
      const response = await api.put('/users/me', {
        fullName: profileForm.fullName.trim(),
        phone: profileForm.phone.trim() || null,
      })
      if (!response?.success || !response.data) throw new Error('Phản hồi cập nhật hồ sơ không hợp lệ.')
      setProfile(response.data)
      setProfileForm({ fullName: response.data.fullName || '', phone: response.data.phone || '' })
      updateCurrentUser(response.data)
      setEditingProfile(false)
      setProfileNotice('Thông tin cá nhân đã được cập nhật.')
    } catch (error) {
      setProfileError(error?.message || 'Không thể cập nhật hồ sơ.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function createAddress(address) {
    const response = await api.post('/users/me/addresses', address)
    if (!response?.success || !response.data?.addressId) throw new Error('Phản hồi thêm địa chỉ không hợp lệ.')
    await loadAddresses()
    setAddingAddress(false)
    setAddressNotice('Địa chỉ đã được thêm.')
  }

  async function updateAddress(addressId, address) {
    const response = await api.put(`/users/me/addresses/${addressId}`, address)
    if (!response?.success || !response.data?.addressId) throw new Error('Phản hồi cập nhật địa chỉ không hợp lệ.')
    await loadAddresses()
    setEditingAddressId(null)
    setAddressNotice('Địa chỉ đã được cập nhật.')
  }

  async function deleteAddress(addressId) {
    setDeletingAddressId(addressId)
    setAddressError('')
    setAddressNotice('')
    try {
      const response = await api.delete(`/users/me/addresses/${addressId}`)
      if (!response?.success) throw new Error('Không thể xóa địa chỉ.')
      await loadAddresses()
      setAddressNotice('Địa chỉ đã được xóa.')
    } catch (error) {
      setAddressError(error?.message || 'Không thể xóa địa chỉ.')
    } finally {
      setDeletingAddressId(null)
    }
  }

  return <main className="store-page page-shell account-page">
    <div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><span>Tài khoản</span></div>
    <div className="account-page-heading"><div className="store-intro"><p className="section-kicker">HOMENEST · TÀI KHOẢN</p><h1>Thông tin tài khoản</h1><p>Quản lý thông tin cá nhân và địa chỉ giao hàng.</p></div><Link className="account-orders-link" to="/don-hang">Xem đơn hàng của tôi →</Link></div>
    <section className="account-section"><div className="account-section-heading"><div><h2>Thông tin cá nhân</h2><p>Email được dùng để đăng nhập và không thể chỉnh sửa tại đây.</p></div>{!editingProfile && profileStatus === 'success' && <button className="account-edit-button" type="button" onClick={() => { setProfileForm({ fullName: profile.fullName || '', phone: profile.phone || '' }); setEditingProfile(true); setProfileNotice('') }}>Chỉnh sửa</button>}</div>
      {profileStatus === 'loading' && <p className="empty-search" role="status">Đang tải thông tin...</p>}
      {profileError && <p className="order-error" role="alert">{profileError} {profileStatus === 'error' && <button type="button" onClick={loadProfile}>Thử lại</button>}</p>}
      {profileNotice && <p className="account-success" role="status">{profileNotice}</p>}
      {profileStatus === 'success' && (editingProfile ? <form className="profile-form" onSubmit={saveProfile}><label>Họ và tên<input autoComplete="name" maxLength={150} required value={profileForm.fullName} onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}/></label><label>Email<input type="email" value={profile.email} readOnly disabled/></label><label>Số điện thoại<input type="tel" autoComplete="tel" maxLength={30} value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}/></label><div className="address-form-actions"><button className="auth-submit" type="submit" disabled={profileSaving}>{profileSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</button><button className="address-form-cancel" type="button" disabled={profileSaving} onClick={() => setEditingProfile(false)}>Hủy</button></div></form> : <dl className="profile-details"><div><dt>Họ và tên</dt><dd>{profile.fullName}</dd></div><div><dt>Email</dt><dd>{profile.email}</dd></div><div><dt>Số điện thoại</dt><dd>{profile.phone || 'Chưa cập nhật'}</dd></div></dl>)}
    </section>
    <section className="account-section"><div className="account-section-heading"><div><h2>Địa chỉ giao hàng</h2><p>Địa chỉ mặc định sẽ được chọn sẵn khi thanh toán.</p></div><button className="account-edit-button" type="button" onClick={() => { setAddingAddress(true); setEditingAddressId(null); setAddressNotice(''); setAddressError('') }}>+ Thêm địa chỉ mới</button></div>
      {addressError && <p className="order-error" role="alert">{addressError} {addressStatus === 'error' && <button type="button" onClick={() => loadAddresses().catch(() => {})}>Thử lại</button>}</p>}
      {addressNotice && <p className="account-success" role="status">{addressNotice}</p>}
      {addressStatus === 'loading' && <p className="empty-search" role="status">Đang tải địa chỉ...</p>}
      {addressStatus === 'success' && addresses.length === 0 && !addingAddress && <p className="account-empty-address">Bạn chưa lưu địa chỉ giao hàng.</p>}
      {addingAddress && <div className="account-address-form"><h3>Thêm địa chỉ</h3><AddressForm onSave={createAddress} onCancel={() => setAddingAddress(false)} /></div>}
      {addressStatus === 'success' && addresses.length > 0 && <div className="account-address-list">{addresses.map((address) => <article className="account-address-card" key={address.addressId}>{editingAddressId === address.addressId ? <div className="account-address-edit"><h3>Chỉnh sửa địa chỉ</h3><AddressForm address={address} onSave={(values) => updateAddress(address.addressId, values)} onCancel={() => setEditingAddressId(null)}/></div> : <><div className="account-address-copy"><strong>{address.recipientName} · {address.phone}</strong>{address.isDefault && <span className="default-address-badge">Mặc định</span>}<p>{address.addressLine}, {address.ward}, {address.district}, {address.province}</p></div><div className="account-address-actions"><button type="button" onClick={() => { setEditingAddressId(address.addressId); setAddingAddress(false); setAddressNotice(''); setAddressError('') }}>Sửa</button><button className="delete-address-button" type="button" disabled={deletingAddressId === address.addressId} onClick={() => deleteAddress(address.addressId)}>{deletingAddressId === address.addressId ? 'Đang xóa...' : 'Xóa'}</button></div></>}</article>)}</div>}
    </section>
  </main>
}

export default AccountPage
