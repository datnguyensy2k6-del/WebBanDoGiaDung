import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'
import { categoryImagesBySlug } from '../data/catalog-assets.js'

function ResourceMessage({ resource, empty, hasData, children }) {
  if (resource.status === 'loading') return <p className="empty-search" role="status">Đang tải dữ liệu...</p>
  if (resource.status === 'error') return <p className="empty-search" role="alert">Không thể tải dữ liệu: {resource.error}</p>
  if (!hasData) return <p className="empty-search">{empty}</p>
  return children
}

function HomePage() {
  const { products, categories, resources } = useCatalog()
  return (
    <main id="top">
      <section className="hero page-shell">
        <img className="hero-image" src="/images/kitchen.jpg" alt="Thiết bị gia dụng hiện đại trong gian bếp" />
        <div className="hero-overlay" />
        <div className="hero-content"><p className="hero-kicker">HOMENEST · ĐIỆN MÁY & GIA DỤNG</p><h1>Tiện nghi hơn<br/><span>mỗi ngày</span></h1><p>Khám phá thiết bị gia dụng chính hãng, giúp việc nhà nhẹ nhàng và cuộc sống thêm tiện lợi.</p><Link className="primary-button" to="/san-pham">Khám phá sản phẩm <span>→</span></Link><div className="hero-assurance"><span>✓</span> Sản phẩm chính hãng <i/> Giao hàng tận nhà</div></div>
        <div className="hero-pager"><b>01</b><span/><span/><span/></div>
      </section>
      <section className="service-strip page-shell" aria-label="Dịch vụ HomeNest">
        <div><span className="service-icon">✓</span><p><strong>Chính hãng an tâm</strong><small>Bảo hành theo tiêu chuẩn hãng</small></p></div>
        <div><span className="service-icon">⌂</span><p><strong>Giao hàng tận nơi</strong><small>Phục vụ khách hàng toàn quốc</small></p></div>
        <div><span className="service-icon">↻</span><p><strong>Hỗ trợ đổi trả</strong><small>Chính sách rõ ràng, thuận tiện</small></p></div>
        <div><span className="service-icon">☎</span><p><strong>Tư vấn tận tình</strong><small>Đồng hành cùng bạn khi mua sắm</small></p></div>
      </section>
      <section className="category-section page-shell">
        <div className="section-heading"><div><p className="section-kicker">MUA SẮM THEO NHU CẦU</p><h2>Danh mục sản phẩm</h2></div><Link className="section-link" to="/san-pham">Tất cả danh mục <span>→</span></Link></div>
        <ResourceMessage resource={resources.categories} empty="Chưa có danh mục sản phẩm." hasData={categories.length > 0}>
          <div className="category-grid">{categories.map((category) => <Link className="category-card" to={`/san-pham/${encodeURIComponent(category.slug)}`} key={category.categoryId}><span className="category-image">{categoryImagesBySlug[category.slug] && <img src={categoryImagesBySlug[category.slug]} alt="" loading="lazy"/>}<span>↗</span></span><strong>{category.categoryName}</strong></Link>)}</div>
        </ResourceMessage>
      </section>
      <section className="products-section">
        <div className="page-shell"><div className="section-heading product-heading"><div><p className="section-kicker">LỰA CHỌN NỔI BẬT</p><h2>Sản phẩm nổi bật</h2></div><Link className="section-link" to="/san-pham">Xem tất cả <span>→</span></Link></div>
          <ResourceMessage resource={resources.products} empty="Hiện chưa có sản phẩm đang kinh doanh." hasData={products.length > 0}>
            <div className="product-grid">{products.slice(0, 4).map((product) => <ProductCard product={product} key={product.productId}/>)}</div>
          </ResourceMessage>
        </div>
      </section>
    </main>
  )
}

export default HomePage
