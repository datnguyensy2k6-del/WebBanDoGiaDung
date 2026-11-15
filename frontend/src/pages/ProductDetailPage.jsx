import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'
import { formatVnd, productImagesBySku } from '../data/catalog-assets.js'

function ProductDetailPage() {
  const { id } = useParams()
  const { products, resources } = useCatalog()
  const { user, loading: authLoading } = useAuth()
  const { addItem, pending } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [cartError, setCartError] = useState('')
  const [added, setAdded] = useState(false)
  const [imageFallback, setImageFallback] = useState(false)
  const [imageError, setImageError] = useState(false)

  const productId = Number(id)
  const product = Number.isSafeInteger(productId) && productId > 0
    ? products.find((item) => item.productId === productId)
    : null
  const fallbackImage = product ? productImagesBySku[product.sku] || null : null
  const imageSrc = imageError ? null : imageFallback ? fallbackImage : product?.imageUrl || null

  useEffect(() => {
    setImageFallback(false)
    setImageError(false)
  }, [product?.productId])

  if (resources.products.status === 'loading') {
    return <main className="store-page page-shell"><p className="empty-search" role="status">Đang tải thông tin sản phẩm...</p></main>
  }

  if (resources.products.status === 'error') {
    return <main className="store-page page-shell"><p className="empty-search" role="alert">Không thể tải sản phẩm: {resources.products.error}</p><Link to="/san-pham">Quay lại danh sách sản phẩm</Link></main>
  }

  if (!product) {
    return <main className="store-page page-shell not-found"><p className="section-kicker">HOMENEST · SẢN PHẨM</p><h1>Không tìm thấy sản phẩm</h1><p>Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.</p><Link className="primary-button" to="/san-pham">Quay lại danh sách sản phẩm</Link></main>
  }

  const inStock = Number(product.stockQuantity) > 0

  async function handleAddToCart() {
    setCartError('')
    setAdded(false)
    try {
      await addItem(product.productId, quantity)
      setAdded(true)
    } catch (error) {
      setCartError(error?.message || 'Không thể thêm sản phẩm vào giỏ hàng. Vui lòng thử lại.')
    }
  }

  return (
    <main className="store-page page-shell product-detail-page">
      <div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><Link to="/san-pham">Sản phẩm</Link><span>/</span><span>{product.name}</span></div>
      <article className="product-detail">
        <div className="product-detail-image">
          {imageSrc ? <img src={imageSrc} alt={product.imageAlt || product.name} onError={() => {
            if (fallbackImage && imageSrc !== fallbackImage) setImageFallback(true)
            else setImageError(true)
          }} /> : <span>Chưa có ảnh sản phẩm</span>}
        </div>
        <section className="product-detail-info">
          {product.category && <p className="product-brand">Danh mục: {product.category}</p>}
          {product.brand && <p className="product-brand">{product.brand}</p>}
          <p className="section-kicker">SKU: {product.sku}</p>
          <h1>{product.name}</h1>
          <p className="product-detail-price">{formatVnd(product.price)}</p>
          <p className={`product-stock ${inStock ? 'is-available' : 'is-unavailable'}`}>
            {inStock ? `Còn hàng · ${product.stockQuantity} sản phẩm` : 'Hết hàng'}
          </p>
          <section className="product-detail-description">
            <h2>Mô tả sản phẩm</h2>
            <p>{product.description || 'Chưa có mô tả cho sản phẩm này.'}</p>
          </section>
          <div className="product-detail-actions">
            <label htmlFor="product-quantity">Số lượng</label>
            <input
              id="product-quantity"
              type="number"
              min="1"
              max={Math.max(Number(product.stockQuantity) || 0, 1)}
              step="1"
              value={quantity}
              disabled={!inStock}
              onChange={(event) => {
                const nextQuantity = Number(event.target.value)
                setQuantity(Number.isSafeInteger(nextQuantity) && nextQuantity > 0
                  ? Math.min(nextQuantity, Number(product.stockQuantity))
                  : 1)
                setAdded(false)
              }}
            />
            {!inStock ? (
              <button className="cart-add-button" type="button" disabled>Hết hàng</button>
            ) : authLoading ? (
              <button className="cart-add-button" type="button" disabled>Đang kiểm tra tài khoản...</button>
            ) : user ? (
              <button className="cart-add-button" type="button" disabled={pending} onClick={handleAddToCart}>
                {pending ? 'Đang cập nhật...' : 'Thêm vào giỏ hàng'}
              </button>
            ) : (
              <Link className="cart-add-button cart-auth-link" to="/dang-nhap" state={{ from: `/san-pham/${product.productId}` }}>
                Đăng nhập để mua
              </Link>
            )}
          </div>
          {cartError && <p className="cart-inline-error" role="alert">{cartError}</p>}
          {added && <p className="product-detail-success" role="status">Đã thêm sản phẩm vào giỏ hàng.</p>}
        </section>
      </article>
    </main>
  )
}

export default ProductDetailPage
