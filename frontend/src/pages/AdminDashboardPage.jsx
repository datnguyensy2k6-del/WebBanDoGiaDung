import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'
import { formatVnd } from '../data/catalog-assets.js'

const orderStatusLabels = {
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  SHIPPING: 'Đang giao hàng',
  DELIVERED: 'Đã giao hàng',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN')
}

function MetricCard({ label, value, detail, tone = '' }) {
  return <article className={`dashboard-metric ${tone}`}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>
}

function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState(null)
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async (signal) => {
    setState('loading')
    setError('')
    try {
      const response = await api.get('/admin/dashboard', { signal })
      if (!response?.success || !response.data) throw new Error('Phản hồi Dashboard không hợp lệ.')
      setDashboard(response.data)
      setState('success')
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return
      setError(requestError?.message || 'Không thể tải dữ liệu Dashboard.')
      setState('error')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadDashboard(controller.signal)
    return () => controller.abort()
  }, [loadDashboard])

  const actions = [
    ['Quản lý sản phẩm', '/admin/products', 'Xem danh sách, cập nhật giá và tồn kho'],
    ['Quản lý Category', '/admin/categories', 'Thêm, sửa và bật/tắt danh mục'],
    ['Quản lý Brand', '/admin/brands', 'Thêm, sửa và bật/tắt thương hiệu'],
    ['Quản lý đơn hàng', '/admin/orders', 'Theo dõi và xác nhận đơn hàng'],
  ]

  return (
    <main className="store-page page-shell admin-dashboard-page">
      <div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><span>Dashboard</span></div>
      <header className="admin-dashboard-heading">
        <div className="store-intro"><p className="section-kicker">HOMENEST · ADMIN</p><h1>Dashboard</h1><p>Tổng quan hệ thống</p></div>
        {state === 'success' && <button className="account-edit-button" type="button" onClick={() => loadDashboard()}>Làm mới</button>}
      </header>

      {state === 'loading' && <p className="empty-search" role="status">Đang tải số liệu tổng quan...</p>}
      {state === 'error' && <div className="order-error" role="alert">{error}<button type="button" onClick={() => loadDashboard()}>Thử lại</button></div>}

      {state === 'success' && dashboard && <>
        <section className="dashboard-metrics" aria-label="Thống kê hệ thống">
          <MetricCard label="Tổng sản phẩm" value={dashboard.products?.total ?? 0} detail={`${dashboard.products?.inactive ?? 0} sản phẩm đã tắt`} />
          <MetricCard label="Sản phẩm đang hoạt động" value={dashboard.products?.active ?? 0} tone="is-positive" />
          <MetricCard label="Tổng Category" value={dashboard.categories?.total ?? 0} detail={`${dashboard.categories?.active ?? 0} đang hoạt động`} />
          <MetricCard label="Tổng Brand" value={dashboard.brands?.total ?? 0} detail={`${dashboard.brands?.active ?? 0} đang hoạt động`} />
          <MetricCard label="Tổng đơn hàng" value={dashboard.orders?.total ?? 0} />
          <MetricCard label="Đơn chờ xác nhận" value={dashboard.orders?.pendingConfirmation ?? 0} tone="is-attention" />
          <MetricCard label="Doanh thu đơn không bị hủy" value={formatVnd(dashboard.revenue?.total ?? 0)} detail="Tổng TotalAmount, không tính đơn đã hủy" tone="is-revenue" />
        </section>

        <section className="admin-dashboard-section">
          <div className="admin-dashboard-section-heading"><div><p className="section-kicker">CẬP NHẬT MỚI</p><h2>Đơn hàng gần đây</h2></div><Link to="/admin/orders">Xem tất cả đơn hàng →</Link></div>
          {dashboard.recentOrders?.length ? <div className="admin-orders-table-wrap"><table className="admin-orders-table dashboard-recent-orders">
            <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Tổng tiền</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead>
            <tbody>{dashboard.recentOrders.map((order) => <tr key={order.orderId}>
              <td><Link to={`/admin/orders/${order.orderId}`}><strong>{order.orderNumber}</strong></Link></td>
              <td>{order.customerName || (order.userId ? `Khách hàng #${order.userId}` : '—')}</td>
              <td className="order-list-total">{formatVnd(order.totalAmount)}</td>
              <td><span className={`status-pill status-${order.status?.toLowerCase()}`}>{orderStatusLabels[order.status] || order.status || '—'}</span></td>
              <td>{formatDate(order.createdAt)}</td>
            </tr>)}</tbody>
          </table></div> : <div className="cart-message dashboard-empty-orders"><h2>Chưa có đơn hàng</h2><p>Đơn hàng mới sẽ xuất hiện tại đây.</p></div>}
        </section>

        <section className="admin-dashboard-section">
          <div className="admin-dashboard-section-heading"><div><p className="section-kicker">TRUY CẬP NHANH</p><h2>Quản lý hệ thống</h2></div></div>
          <div className="dashboard-quick-actions">{actions.map(([label, to, description]) => <Link key={to} to={to}><strong>{label}</strong><span>{description}</span><b aria-hidden="true">→</b></Link>)}</div>
        </section>
      </>}
    </main>
  )
}

export default AdminDashboardPage
