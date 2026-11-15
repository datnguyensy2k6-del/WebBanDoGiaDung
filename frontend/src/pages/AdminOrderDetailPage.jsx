import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api/client.js'
import { formatVnd, productImagesBySku } from '../data/catalog-assets.js'

const statusLabels = {
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  SHIPPING: 'Đang giao hàng',
  DELIVERED: 'Đã giao hàng',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
}
const paymentLabels = { COD: 'Thanh toán khi nhận hàng (COD)', ONLINE: 'Thanh toán online' }

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN')
}

function AdminOrderDetailPage() {
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')

  const loadOrder = useCallback(async (signal) => {
    if (!/^\d+$/.test(orderId || '') || Number(orderId) <= 0) {
      setError('Mã đơn hàng không hợp lệ.')
      setStatus('error')
      return
    }
    setStatus('loading')
    try {
      const response = await api.get(`/admin/orders/${orderId}`, { signal })
      if (!response?.success || !response.data?.orderId || !Array.isArray(response.data.items)) throw new Error('Phản hồi chi tiết đơn hàng không hợp lệ.')
      setOrder(response.data)
      setStatus('success')
      setError('')
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return
      setError(requestError?.message || 'Không thể tải chi tiết đơn hàng.')
      setStatus('error')
    }
  }, [orderId])

  useEffect(() => {
    const controller = new AbortController()
    loadOrder(controller.signal)
    return () => controller.abort()
  }, [loadOrder])

  async function confirmOrder() {
    setConfirming(true)
    setConfirmError('')
    try {
      const response = await api.patch(`/admin/orders/${orderId}/confirm`, {})
      if (!response?.success || !response.data?.orderId) throw new Error('Phản hồi xác nhận đơn hàng không hợp lệ.')
      setOrder(response.data)
    } catch (requestError) {
      setConfirmError(requestError?.message || 'Không thể xác nhận đơn hàng.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <main className="store-page page-shell admin-order-detail-page">
      <div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><Link to="/admin">Quản lý đơn hàng</Link><span>/</span><span>Chi tiết</span></div>
      <div className="order-detail-heading"><div className="store-intro"><p className="section-kicker">HOMENEST · ADMIN</p><h1>Chi tiết đơn hàng {order?.orderNumber || `#${orderId}`}</h1></div><Link className="order-back-link" to="/admin">← Danh sách đơn hàng</Link></div>
      {status === 'loading' && <p className="empty-search" role="status">Đang tải chi tiết đơn hàng...</p>}
      {status === 'error' && <div className="order-error" role="alert">{error}<button type="button" onClick={() => loadOrder()}>Thử lại</button></div>}
      {status === 'success' && order && <section className="admin-order-detail-card">
        <div className="admin-order-overview">
          <div><small>Trạng thái</small><strong><span className={`status-pill status-${order.orderStatus?.toLowerCase()}`}>{statusLabels[order.orderStatus] || order.orderStatus}</span></strong></div>
          <div><small>Ngày tạo</small><strong>{formatDate(order.createdAt)}</strong></div>
          <div><small>Phương thức thanh toán</small><strong>{paymentLabels[order.paymentMethod] || order.paymentMethod}</strong></div>
          <div><small>Khách hàng</small><strong>{order.customerName} · {order.customerEmail}</strong></div>
        </div>

        <section className="admin-detail-section"><h2>Thông tin người nhận</h2><p><strong>{order.recipientName} · {order.recipientPhone}</strong><br />{order.shippingAddressLine}, {order.shippingWard}, {order.shippingDistrict}, {order.shippingProvince}</p>{order.customerNote && <p>Ghi chú: {order.customerNote}</p>}</section>

        <section className="admin-detail-section"><h2>Sản phẩm</h2><div className="admin-order-items">{order.items.map((item) => <article className="admin-order-item" key={item.orderItemId}>
          <div className="admin-order-item-image">{productImagesBySku[item.sku] && <img src={productImagesBySku[item.sku]} alt={item.productName} />}</div>
          <div><strong>{item.productName}</strong><small>SKU: {item.sku} · Số lượng: {item.quantity} · Đơn giá: {formatVnd(item.unitPrice)}</small></div>
          <b>{formatVnd(item.lineTotal)}</b>
        </article>)}</div></section>

        <section className="admin-order-totals"><div><span>Tạm tính</span><strong>{formatVnd(order.subtotal)}</strong></div><div><span>Giảm giá</span><strong>{formatVnd(order.discountAmount)}</strong></div><div><span>Phí giao hàng</span><strong>{formatVnd(order.shippingFee)}</strong></div><div className="order-grand-total"><span>Tổng tiền</span><strong>{formatVnd(order.totalAmount)}</strong></div></section>

        <div className="admin-detail-columns">
          <section className="admin-detail-section"><h2>Thanh toán</h2>{order.payments.length ? order.payments.map((payment) => <div className="admin-payment-row" key={payment.paymentId}><span>Lần {payment.attemptNumber} · {paymentLabels[payment.paymentMethod] || payment.paymentMethod} · {payment.paymentStatus}</span><strong>{formatVnd(payment.amount)}</strong></div>) : <p>Chưa có thông tin thanh toán.</p>}</section>
          <section className="admin-detail-section"><h2>Lịch sử trạng thái</h2>{order.statusHistory.length ? order.statusHistory.map((entry, index) => <div className="admin-history-row" key={`${entry.changedAt}-${index}`}><strong>{statusLabels[entry.newStatus] || entry.newStatus}</strong><span>{formatDate(entry.changedAt)}{entry.changedByName ? ` · ${entry.changedByName}` : ''}</span>{entry.note && <small>{entry.note}</small>}</div>) : <p>Chưa có lịch sử trạng thái.</p>}</section>
        </div>

        {order.inventoryTransactions?.length > 0 && <section className="admin-detail-section"><h2>Lịch sử tồn kho</h2>{order.inventoryTransactions.map((transaction) => <div className="admin-payment-row" key={transaction.inventoryTransactionId}><span>{transaction.sku} · {transaction.reason} · thay đổi {transaction.quantityChange}</span><small>{formatDate(transaction.createdAt)}</small></div>)}</section>}

        {confirmError && <p className="order-error" role="alert">{confirmError}</p>}
        {order.orderStatus === 'PENDING_CONFIRMATION' && <button className="admin-confirm-button" type="button" disabled={confirming} onClick={confirmOrder}>{confirming ? 'Đang xác nhận...' : 'Xác nhận đơn'}</button>}
      </section>}
    </main>
  )
}

export default AdminOrderDetailPage
