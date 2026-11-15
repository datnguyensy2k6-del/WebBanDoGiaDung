import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client.js'
import AddressForm from '../components/AddressForm.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { formatVnd, productImagesBySku } from '../data/catalog-assets.js'

const orderStatusLabels = {
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  SHIPPING: 'Đang giao hàng',
  DELIVERED: 'Đã giao hàng',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
}

const paymentStatusLabels = { PENDING: 'Đang chờ', SUCCESS: 'Thành công', FAILED: 'Thất bại' }
const paymentMethodLabels = { COD: 'Thanh toán khi nhận hàng (COD)', ONLINE: 'Thanh toán trực tuyến' }

function displayStatus(value, labels) {
  return labels[value] || value || 'Chưa có thông tin'
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa có thông tin' : date.toLocaleString('vi-VN')
}

function AddressText({ address }) {
  return <>{address.addressLine}, {address.ward}, {address.district}, {address.province}</>
}

export function LoginRequired({ title }) {
  const location = useLocation()
  return <main className="store-page page-shell order-page"><section className="cart-message"><h1>{title}</h1><p>Vui lòng đăng nhập để tiếp tục.</p><Link className="auth-submit cart-login-link" to="/dang-nhap" state={{ from: `${location.pathname}${location.search}` }}>Đăng nhập</Link></section></main>
}

export function CheckoutPage() {
  const { user } = useAuth()
  const { cart, status: cartStatus, error: cartError, refreshCart } = useCart()
  const navigate = useNavigate()
  const [addresses, setAddresses] = useState([])
  const [addressStatus, setAddressStatus] = useState('loading')
  const [addressError, setAddressError] = useState('')
  const [addressReload, setAddressReload] = useState(0)
  const [addingAddress, setAddingAddress] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('COD')
  const [customerNote, setCustomerNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const loadAddresses = useCallback(async (signal) => {
    setAddressStatus('loading')
    try {
      const response = await api.get('/users/me/addresses', { signal })
      if (!response?.success || !Array.isArray(response.data)) throw new Error('Phản hồi địa chỉ từ máy chủ không hợp lệ.')
      setAddresses(response.data)
      const defaultAddress = response.data.find((address) => address.isDefault) || response.data[0]
      setSelectedAddress(defaultAddress ? String(defaultAddress.addressId) : '')
      setAddingAddress(response.data.length === 0)
      setAddressStatus('success')
      setAddressError('')
      return response.data
    } catch (error) {
      if (error?.name === 'AbortError') return []
      setAddressStatus('error')
      setAddressError(error?.message || 'Không thể tải địa chỉ giao hàng.')
      throw error
    }
  }, [])

  useEffect(() => {
    if (!user) return undefined
    const controller = new AbortController()
    loadAddresses(controller.signal).catch(() => {})
    return () => controller.abort()
  }, [user?.userId, addressReload, loadAddresses])

  async function saveCheckoutAddress(address) {
    const response = await api.post('/users/me/addresses', address)
    if (!response?.success || !response.data?.addressId) throw new Error('Phản hồi thêm địa chỉ không hợp lệ.')
    const newAddress = response.data
    setAddresses((current) => [
      ...current
        .filter((item) => item.addressId !== newAddress.addressId)
        .map((item) => newAddress.isDefault ? { ...item, isDefault: false } : item),
      newAddress,
    ])
    setSelectedAddress(String(newAddress.addressId))
    setAddressStatus('success')
    setAddressError('')
    setAddingAddress(false)
  }

  if (!user) return <LoginRequired title="Thanh toán" />

  async function handlePlaceOrder() {
    setSubmitError('')
    if (!selectedAddress) {
      setSubmitError('Vui lòng chọn địa chỉ giao hàng.')
      return
    }
    setSubmitting(true)
    try {
      const body = {
        addressId: Number(selectedAddress),
        paymentMethod,
        ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
      }
      const response = await api.post('/orders', body)
      if (!response?.success || !response.data?.orderId) throw new Error('Phản hồi tạo đơn hàng từ máy chủ không hợp lệ.')
      await refreshCart({ showLoading: false }).catch(() => {})
      navigate(`/don-hang/${response.data.orderId}`, { state: { created: true } })
    } catch (error) {
      setSubmitError(error?.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  const selected = addresses.find((address) => String(address.addressId) === selectedAddress)
  return <main className="store-page page-shell order-page">
    <div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><Link to="/gio-hang">Giỏ hàng</Link><span>/</span><span>Thanh toán</span></div>
    <div className="store-intro"><p className="section-kicker">HOMENEST · HOÀN TẤT ĐẶT HÀNG</p><h1>Thanh toán</h1><p>Chọn địa chỉ giao hàng và phương thức thanh toán.</p></div>
    {cartStatus === 'loading' && <p className="empty-search" role="status">Đang tải giỏ hàng...</p>}
    {cartStatus === 'error' && <p className="order-error" role="alert">{cartError} <button type="button" onClick={() => refreshCart().catch(() => {})}>Thử tải lại giỏ hàng</button></p>}
    {cartStatus === 'success' && cart?.items.length === 0 && <section className="cart-message"><h2>Giỏ hàng đang trống</h2><p>Thêm sản phẩm trước khi thanh toán.</p><Link className="primary-button cart-shop-link" to="/san-pham">Tiếp tục mua sắm <span>→</span></Link></section>}
    {cartStatus === 'success' && cart?.items.length > 0 && <div className="checkout-layout">
      <div className="checkout-panel">
        <section className="checkout-section"><div className="checkout-section-heading"><h2>Thông tin nhận hàng</h2><button className="account-edit-button" type="button" onClick={() => setAddingAddress((current) => !current)}>{addingAddress ? 'Đóng biểu mẫu' : '+ Thêm địa chỉ mới'}</button></div>
          {addressStatus === 'loading' && <p className="empty-search" role="status">Đang tải địa chỉ...</p>}
          {addressStatus === 'error' && <p className="order-error" role="alert">{addressError} <button type="button" onClick={() => setAddressReload((value) => value + 1)}>Thử tải lại địa chỉ</button></p>}
          {addressStatus === 'success' && addresses.length > 0 && <div className="address-options">{addresses.map((address) => <label className={`address-option ${selectedAddress === String(address.addressId) ? 'is-selected' : ''}`} key={address.addressId}><input type="radio" name="addressId" value={address.addressId} checked={selectedAddress === String(address.addressId)} onChange={(event) => setSelectedAddress(event.target.value)} /><span><strong>{address.recipientName} · {address.phone}</strong><small><AddressText address={address}/>{address.isDefault ? ' · Mặc định' : ''}</small></span></label>)}</div>}
          {addressStatus === 'success' && addresses.length === 0 && !addingAddress && <p className="account-empty-address">Bạn chưa có địa chỉ nhận hàng. Thêm địa chỉ để tiếp tục đặt hàng.</p>}
          {addingAddress && <div className="checkout-address-form"><h3>{addresses.length ? 'Thêm địa chỉ mới' : 'Nhập thông tin nhận hàng'}</h3><AddressForm onSave={saveCheckoutAddress} onCancel={() => setAddingAddress(false)} /></div>}
        </section>
        <section className="checkout-section"><h2>Phương thức thanh toán</h2><div className="payment-options">
          <label className={paymentMethod === 'COD' ? 'is-selected' : ''}><input type="radio" name="paymentMethod" value="COD" checked={paymentMethod === 'COD'} onChange={() => setPaymentMethod('COD')} /><span><strong>Thanh toán khi nhận hàng (COD)</strong></span></label>
          <label className={paymentMethod === 'ONLINE' ? 'is-selected' : ''}><input type="radio" name="paymentMethod" value="ONLINE" checked={paymentMethod === 'ONLINE'} onChange={() => setPaymentMethod('ONLINE')} /><span><strong>Thanh toán online</strong></span></label>
        </div></section>
        <section className="checkout-section"><label className="note-label" htmlFor="customer-note">Ghi chú cho đơn hàng <span>(không bắt buộc)</span></label><textarea id="customer-note" maxLength={1000} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} rows={3} /></section>
        {submitError && <p className="order-error" role="alert">{submitError}</p>}
        <button className="auth-submit place-order-button" type="button" onClick={handlePlaceOrder} disabled={submitting || addressStatus !== 'success' || !selected || !cart.items.length}>{submitting ? 'Đang tạo đơn...' : 'Xác nhận đặt hàng'}</button>
      </div>
      <aside className="checkout-panel checkout-summary"><h2>Đơn hàng của bạn</h2><div className="checkout-items">{cart.items.map((item) => <div className="checkout-item" key={item.productId}><span>{item.productName} <b>× {item.quantity}</b></span><strong>{formatVnd(item.subtotal)}</strong></div>)}</div><div className="checkout-total-row"><span>Tạm tính</span><strong>{formatVnd(cart.subtotal)}</strong></div><div className="checkout-total-row"><span>Phí giao hàng</span><strong>{formatVnd(0)}</strong></div><div className="checkout-total-row checkout-grand-total"><span>Tổng tiền</span><strong>{formatVnd(cart.subtotal)}</strong></div>{selected && <div className="checkout-selected-address"><b>Giao đến</b><span>{selected.recipientName} · {selected.phone}</span><small><AddressText address={selected}/></small></div>}</aside>
    </div>}
  </main>
}

export function OrderListPage() {
  const { user } = useAuth()
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  const loadOrders = useCallback(async (signal) => {
    setStatus('loading')
    try {
      const response = await api.get(`/orders?page=${page}&pageSize=20`, { signal })
      if (!response?.success || !Array.isArray(response.data)) throw new Error('Phản hồi danh sách đơn hàng không hợp lệ.')
      setResult(response)
      setStatus('success')
      setError('')
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return
      setStatus('error')
      setError(requestError?.message || 'Không thể tải danh sách đơn hàng.')
    }
  }, [page])

  useEffect(() => {
    if (!user) return undefined
    const controller = new AbortController()
    loadOrders(controller.signal)
    return () => controller.abort()
  }, [user?.userId, loadOrders])

  if (!user) return <LoginRequired title="Đơn hàng của tôi" />
  const totalPages = result ? Math.max(1, Math.ceil(result.totalCount / result.pageSize)) : 1
  return <main className="store-page page-shell order-page"><div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><span>Đơn hàng của tôi</span></div><div className="store-intro"><p className="section-kicker">HOMENEST · LỊCH SỬ MUA HÀNG</p><h1>Đơn hàng của tôi</h1><p>Theo dõi trạng thái các đơn hàng của bạn.</p></div>
    {status === 'loading' && <p className="empty-search" role="status">Đang tải đơn hàng...</p>}
    {status === 'error' && <div className="order-error" role="alert">{error} <button type="button" onClick={() => loadOrders()}>Thử lại</button></div>}
    {status === 'success' && result.data.length === 0 && <section className="cart-message"><h2>Bạn chưa có đơn hàng</h2><p>Các đơn hàng sau khi đặt sẽ xuất hiện tại đây.</p><Link className="primary-button cart-shop-link" to="/san-pham">Khám phá sản phẩm <span>→</span></Link></section>}
    {status === 'success' && result.data.length > 0 && <><div className="orders-list">{result.data.map((order) => <article className="order-list-card" key={order.orderId}><div><small>{order.orderNumber}</small><h2><Link to={`/don-hang/${order.orderId}`}>Đơn hàng #{order.orderId}</Link></h2><span>{formatDate(order.createdAt)}</span></div><div><small>Trạng thái</small><strong className={`status-pill status-${order.orderStatus?.toLowerCase()}`}>{displayStatus(order.orderStatus, orderStatusLabels)}</strong></div><div><small>Thanh toán</small><span>{paymentMethodLabels[order.paymentMethod] || order.paymentMethod}</span></div><strong className="order-list-total">{formatVnd(order.totalAmount)}</strong><Link className="order-view-link" to={`/don-hang/${order.orderId}`}>Xem chi tiết →</Link></article>)}</div><div className="orders-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Trang trước</button><span>Trang {result.page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau →</button></div></>}
  </main>
}

export function OrderDetailPage() {
  const { user } = useAuth()
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const loadOrder = useCallback(async (signal) => {
    if (!/^\d+$/.test(orderId || '') || Number(orderId) <= 0) {
      setStatus('error')
      setError('Mã đơn hàng không hợp lệ.')
      return
    }
    setStatus('loading')
    try {
      const response = await api.get(`/orders/${orderId}`, { signal })
      if (!response?.success || !response.data?.orderId || !Array.isArray(response.data.items)) throw new Error('Phản hồi chi tiết đơn hàng không hợp lệ.')
      setOrder(response.data)
      setStatus('success')
      setError('')
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return
      setStatus('error')
      setError(requestError?.message || 'Không thể tải chi tiết đơn hàng.')
    }
  }, [orderId])

  useEffect(() => {
    if (!user) return undefined
    const controller = new AbortController()
    loadOrder(controller.signal)
    return () => controller.abort()
  }, [user?.userId, loadOrder])

  if (!user) return <LoginRequired title="Chi tiết đơn hàng" />

  async function handleCancel() {
    setCancelling(true)
    setCancelError('')
    try {
      const response = await api.patch(`/orders/${orderId}/cancel`, {})
      if (!response?.success || !response.data?.orderId) throw new Error('Phản hồi hủy đơn từ máy chủ không hợp lệ.')
      setOrder(response.data)
    } catch (requestError) {
      setCancelError(requestError?.message || 'Không thể hủy đơn hàng.')
    } finally {
      setCancelling(false)
    }
  }

  const canCancel = order?.orderStatus === 'PENDING_CONFIRMATION' && !order?.payments?.some((payment) => payment.paymentStatus === 'SUCCESS')
  return <main className="store-page page-shell order-page"><div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><Link to="/don-hang">Đơn hàng của tôi</Link><span>/</span><span>Chi tiết</span></div><div className="order-detail-heading"><div className="store-intro"><p className="section-kicker">HOMENEST · CHI TIẾT ĐƠN HÀNG</p><h1>Đơn hàng #{orderId}</h1></div><Link className="order-back-link" to="/don-hang">← Danh sách đơn hàng</Link></div>
    {status === 'loading' && <p className="empty-search" role="status">Đang tải chi tiết đơn hàng...</p>}
    {status === 'error' && <div className="order-error" role="alert">{error} <button type="button" onClick={() => loadOrder()}>Thử lại</button></div>}
    {status === 'success' && order && <>
      <section className="order-detail-card"><div className="order-overview"><div><small>Mã đơn</small><strong>{order.orderNumber}</strong></div><div><small>Ngày đặt</small><strong>{formatDate(order.createdAt)}</strong></div><div><small>Trạng thái đơn</small><strong className={`status-pill status-${order.orderStatus?.toLowerCase()}`}>{displayStatus(order.orderStatus, orderStatusLabels)}</strong></div><div><small>Phương thức</small><strong>{paymentMethodLabels[order.paymentMethod] || order.paymentMethod}</strong></div></div>
        <div className="order-detail-columns"><section><h2>Địa chỉ nhận hàng</h2><p><strong>{order.recipientName} · {order.recipientPhone}</strong><br/>{order.shippingAddressLine}, {order.shippingWard}, {order.shippingDistrict}, {order.shippingProvince}</p>{order.customerNote && <p className="order-customer-note"><b>Ghi chú:</b> {order.customerNote}</p>}</section><section><h2>Thanh toán</h2>{order.payments?.length ? <div className="payment-history">{order.payments.map((payment) => <div key={payment.paymentId}><span>Lần {payment.attemptNumber} · {paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}</span><strong className={`status-pill status-${payment.paymentStatus?.toLowerCase()}`}>{displayStatus(payment.paymentStatus, paymentStatusLabels)}</strong><b>{formatVnd(payment.amount)}</b></div>)}</div> : <p>Chưa có thông tin thanh toán.</p>}</section></div>
        <section className="order-line-items"><h2>Sản phẩm</h2>{order.items.map((item) => { const image = item.imageUrl || productImagesBySku[item.sku]; return <div className="order-line-item" key={item.orderItemId}><div className="order-line-image">{image && <img src={image} alt={item.productName}/>}</div><div><strong>{item.productName}</strong><small>SKU: {item.sku} · Số lượng: {item.quantity} · Đơn giá: {formatVnd(item.unitPrice)}</small></div><b>{formatVnd(item.lineTotal)}</b></div> })}</section>
        <section className="order-totals"><div><span>Tạm tính</span><strong>{formatVnd(order.subtotal)}</strong></div><div><span>Giảm giá</span><strong>{formatVnd(order.discountAmount)}</strong></div><div><span>Phí giao hàng</span><strong>{formatVnd(order.shippingFee)}</strong></div><div className="order-grand-total"><span>Tổng tiền</span><strong>{formatVnd(order.totalAmount)}</strong></div></section>
        {order.statusHistory?.length > 0 && <section className="order-history"><h2>Lịch sử trạng thái</h2>{order.statusHistory.map((entry, index) => <div key={`${entry.changedAt}-${index}`}><span className="history-dot"/><p><strong>{displayStatus(entry.newStatus, orderStatusLabels)}</strong><small>{formatDate(entry.changedAt)}</small></p></div>)}</section>}
        {cancelError && <p className="order-error" role="alert">{cancelError}</p>}
        {canCancel && <button className="order-cancel-button" type="button" disabled={cancelling} onClick={handleCancel}>{cancelling ? 'Đang hủy...' : 'Hủy đơn hàng'}</button>}
      </section>
    </>}
  </main>
}
