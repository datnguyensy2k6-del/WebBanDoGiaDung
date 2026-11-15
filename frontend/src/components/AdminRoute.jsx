import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <main className="store-page page-shell"><p className="empty-search" role="status">Đang xác minh tài khoản...</p></main>
  }

  if (!user) {
    return <Navigate to="/dang-nhap" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  if (!user.roles?.includes('ADMIN')) {
    return (
      <main className="store-page page-shell admin-access-denied" role="alert">
        <p className="section-kicker">HOMENEST · QUẢN TRỊ</p>
        <h1>Bạn không có quyền truy cập</h1>
        <p>Khu vực này chỉ dành cho tài khoản quản trị viên.</p>
      </main>
    )
  }

  return children
}

export default AdminRoute
