import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { formatVnd, productImagesBySku } from '../data/catalog-assets.js'

function CartPage() {
  const { user } = useAuth()
  const { cart, status, error, pending, refreshCart, updateQuantity, removeItem, clearCart } = useCart()

  if (!user) {
    return <main className="store-page page-shell cart-page"><div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><span>Giỏ hàng</span></div><section className="cart-message"><h1>Giỏ hàng của bạn</h1><p>Vui lòng đăng nhập để xem và quản lý giỏ hàng.</p><Link className="auth-submit cart-login-link" to="/dang-nhap" state={{ from: '/gio-hang' }}>Đăng nhập</Link><p>Chưa có tài khoản? <Link to="/dang-ky" state={{ from: '/gio-hang' }}>Đăng ký ngay</Link></p></section></main>
  }

  return (
    <main className="store-page page-shell cart-page">
      <div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><span>Giỏ hàng</span></div>
      <div className="cart-heading"><div className="store-intro"><p className="section-kicker">HOMENEST · ĐƠN HÀNG CỦA BẠN</p><h1>Giỏ hàng</h1><p>Kiểm tra sản phẩm và số lượng trước khi tiếp tục.</p></div>{status === 'success' && cart?.items.length > 0 && <button className="cart-clear-button" type="button" disabled={pending} onClick={() => clearCart().catch(() => {})}>Xóa toàn bộ giỏ</button>}</div>
      {error && <div className="cart-error" role="alert"><span>{error}</span>{status === 'error' && <button type="button" disabled={pending} onClick={() => refreshCart().catch(() => {})}>Thử tải lại</button>}</div>}
      {status === 'loading' && <p className="empty-search" role="status">Đang tải giỏ hàng...</p>}
      {status === 'error' && <section className="cart-message"><h2>Chưa thể tải giỏ hàng</h2><p>Hãy kiểm tra kết nối và thử lại.</p></section>}
      {status === 'success' && cart?.items.length === 0 && <section className="cart-message"><h2>Giỏ hàng đang trống</h2><p>Khám phá các sản phẩm gia dụng từ HomeNest.</p><Link className="primary-button cart-shop-link" to="/san-pham">Tiếp tục mua sắm <span>→</span></Link></section>}
      {status === 'success' && cart?.items.length > 0 && <>
        <div className="cart-items" aria-busy={pending}>
          {cart.items.map((item) => {
            const image = item.imageUrl || productImagesBySku[item.sku]
            const outOfStock = Number(item.stockQuantity) <= 0
            const inactive = item.isActive === false
            return <article className="cart-item" key={item.productId}>
              <div className="cart-item-image">{image ? <img src={image} alt={item.productName} /> : <span>HomeNest</span>}</div>
              <div className="cart-item-details"><p className="product-brand">{item.sku}</p><h2>{item.productName}</h2>{(outOfStock || inactive) && <p className="cart-item-warning">{inactive ? 'Sản phẩm đã ngừng kinh doanh.' : 'Sản phẩm hiện đã hết hàng.'}</p>}<p className="cart-item-price">Đơn giá: {formatVnd(item.unitPrice)}</p></div>
              <div className="cart-quantity" aria-label={`Số lượng ${item.productName}`}><button type="button" aria-label="Giảm số lượng" disabled={pending || item.quantity <= 1 || outOfStock || inactive} onClick={() => updateQuantity(item.productId, Number(item.quantity) - 1).catch(() => {})}>−</button><span>{item.quantity}</span><button type="button" aria-label="Tăng số lượng" disabled={pending || Number(item.quantity) >= Number(item.stockQuantity) || outOfStock || inactive} onClick={() => updateQuantity(item.productId, Number(item.quantity) + 1).catch(() => {})}>+</button></div>
              <strong className="cart-item-subtotal">{formatVnd(item.subtotal)}</strong>
              <button className="cart-remove-button" type="button" disabled={pending} onClick={() => removeItem(item.productId).catch(() => {})}>Xóa</button>
            </article>
          })}
        </div>
        <section className="cart-summary"><Link className="cart-continue-link" to="/san-pham">← Tiếp tục mua sắm</Link><div><span>Tổng tiền</span><strong>{formatVnd(cart.subtotal)}</strong><Link className="auth-submit checkout-link" to="/thanh-toan">Tiến hành thanh toán</Link></div></section>
      </>}
    </main>
  )
}

export default CartPage
