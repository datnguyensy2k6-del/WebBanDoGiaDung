import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'
import { formatVnd } from '../data/catalog-assets.js'

const orderStatuses = [
  ['PENDING_CONFIRMATION', 'Chờ xác nhận'],
  ['CONFIRMED', 'Đã xác nhận'],
  ['PROCESSING', 'Đang xử lý'],
  ['SHIPPING', 'Đang giao hàng'],
  ['DELIVERED', 'Đã giao hàng'],
  ['COMPLETED', 'Hoàn tất'],
  ['CANCELLED', 'Đã hủy'],
]
const statusLabels = Object.fromEntries(orderStatuses)
const paymentLabels = { COD: 'COD', ONLINE: 'Online' }

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN')
}

function OrderStatus({ value }) {
  return <span className={`status-pill status-${value?.toLowerCase()}`}>{statusLabels[value] || value || '—'}</span>
}

function AdminOrdersPage() {
  const [page, setPage] = useState(1)
  const [orderStatus, setOrderStatus] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const loadOrders = useCallback(async (signal) => {
    setStatus('loading')
    setError('')
    const query = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (orderStatus) query.set('orderStatus', orderStatus)
    if (search) query.set('orderNumber', search)

    try {
      const response = await api.get(`/admin/orders?${query}`, { signal })
      if (!response?.success || !Array.isArray(response.data)) throw new Error('Phản hồi danh sách đơn hàng không hợp lệ.')
      setResult(response)
      setStatus('success')
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return
      setError(requestError?.message || 'Không thể tải danh sách đơn hàng.')
      setStatus('error')
    }
  }, [page, orderStatus, search])

  useEffect(() => {
    const controller = new AbortController()
    loadOrders(controller.signal)
    return () => controller.abort()
  }, [loadOrders])

  function submitSearch(event) {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.totalCount / result.pageSize)) : 1

  return (
    <main className="store-page page-shell admin-orders-page">
      <div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><span>Quản trị đơn hàng</span></div>
      <div className="admin-page-heading">
        <div className="store-intro"><p className="section-kicker">HOMENEST · ADMIN</p><h1>Quản lý đơn hàng</h1><p>Xem và xác nhận đơn hàng của khách hàng.</p></div>
      </div>

      <section className="admin-orders-toolbar" aria-label="Bộ lọc đơn hàng">
        <label>Trạng thái
          <select value={orderStatus} onChange={(event) => { setPage(1); setOrderStatus(event.target.value) }}>
            <option value="">Tất cả trạng thái</option>
            {orderStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <form onSubmit={submitSearch}>
          <label htmlFor="admin-order-search">Mã đơn hàng</label>
          <input id="admin-order-search" value={searchInput} maxLength={40} onChange={(event) => setSearchInput(event.target.value)} placeholder="Nhập mã đơn" />
          <button className="account-edit-button" type="submit">Tìm kiếm</button>
        </form>
      </section>

      {status === 'loading' && <p className="empty-search" role="status">Đang tải đơn hàng...</p>}
      {status === 'error' && <div className="order-error" role="alert">{error}<button type="button" onClick={() => loadOrders()}>Thử lại</button></div>}
      {status === 'success' && result.data.length === 0 && <section className="cart-message"><h2>Không có đơn hàng phù hợp</h2><p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p></section>}
      {status === 'success' && result.data.length > 0 && <>
        <div className="admin-orders-table-wrap">
          <table className="admin-orders-table">
            <thead><tr><th>Mã đơn</th><th>Ngày tạo</th><th>Người nhận</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>{result.data.map((order) => <tr key={order.orderId}>
              <td><strong>{order.orderNumber}</strong></td>
              <td>{formatDate(order.createdAt)}</td>
              <td>{order.recipientName}</td>
              <td className="order-list-total">{formatVnd(order.totalAmount)}</td>
              <td>{paymentLabels[order.paymentMethod] || order.paymentMethod}</td>
              <td><OrderStatus value={order.orderStatus} /></td>
              <td><Link className="order-view-link" to={`/admin/orders/${order.orderId}`}>Chi tiết →</Link></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="orders-pagination">
          <button type="button" disabled={page <= 1 || status === 'loading'} onClick={() => setPage((current) => current - 1)}>← Trang trước</button>
          <span>Trang {result.page} / {totalPages} · {result.totalCount} đơn</span>
          <button type="button" disabled={page >= totalPages || status === 'loading'} onClick={() => setPage((current) => current + 1)}>Trang sau →</button>
        </div>
      </>}
    </main>
  )
}

export default AdminOrdersPage
