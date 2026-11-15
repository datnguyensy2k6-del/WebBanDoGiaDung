import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { formatVnd } from '../data/catalog-assets.js'

function ProductCard({ product }) {
  const { user } = useAuth()
  const { addItem, pending } = useCart()
  const [cartError, setCartError] = useState('')
  const productUrl = `/san-pham/${product.productId}`
  const imageUrl = product.imageUrl || product.image || null

  async function handleAdd() {
    setCartError('')
    try {
      await addItem(product.productId, 1)
    } catch (error) {
      setCartError(error?.message || 'Không thể thêm sản phẩm vào giỏ hàng.')
    }
  }

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <Link className="product-image-link" to={productUrl} aria-label={`Xem ${product.name}`}>
          {imageUrl && <img className="product-image" src={imageUrl} alt={product.imageAlt || product.name} loading="lazy" />}
        </Link>
        {product.isOutOfStock && <span className="product-badge">Hết hàng</span>}
        <button className="favorite-button" aria-label={`Lưu ${product.name}`} type="button">♡</button>
      </div>
      <div className="product-info">
        <p className="product-brand">{product.brand}</p>
        <h3><Link to={productUrl}>{product.name}</Link></h3>
        <div className="product-prices"><strong>{formatVnd(product.price)}</strong></div>
        <Link className="details-link" to={productUrl}>Xem sản phẩm <span>→</span></Link>
        {user ? <button className="cart-add-button" type="button" disabled={pending || product.isOutOfStock} onClick={handleAdd}>{product.isOutOfStock ? 'Hết hàng' : pending ? 'Đang cập nhật...' : 'Thêm vào giỏ hàng'}</button> : <Link className="cart-add-button cart-auth-link" to="/dang-nhap" state={{ from: '/gio-hang' }}>Đăng nhập để mua</Link>}
        {cartError && <p className="cart-inline-error" role="alert">{cartError}</p>}
      </div>
    </article>
  )
}

export default ProductCard
