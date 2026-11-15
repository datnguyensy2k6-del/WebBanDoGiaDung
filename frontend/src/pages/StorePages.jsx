import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'
import { formatVnd } from '../data/catalog-assets.js'

function ResourceState({ resource, emptyText, hasData, children }) {
  if (resource.status === 'loading') return <p className="empty-search" role="status">Đang tải dữ liệu...</p>
  if (resource.status === 'error') return <p className="empty-search" role="alert">Không thể tải dữ liệu: {resource.error}</p>
  if (!hasData) return <p className="empty-search">{emptyText}</p>
  return children
}

function ProductGrid({ items, emptyText, resource }) {
  if (resource?.status === 'loading') return <p className="empty-search" role="status">Đang tải sản phẩm...</p>
  if (resource?.status === 'error') return <p className="empty-search" role="alert">Không thể tải sản phẩm: {resource.error}</p>
  if (!items.length) return <p className="empty-search">{emptyText}</p>
  return <div className="product-grid">{items.map((product) => <ProductCard product={product} key={product.productId}/>)}</div>
}

export function CategoryPage({ categorySlug: categorySlugProp }) {
  const { categorySlug: routeCategorySlug } = useParams()
  const categorySlug = categorySlugProp || routeCategorySlug
  const [params] = useSearchParams()
  const [brandId, setBrandId] = useState('')
  const { products, categories, brands, resources } = useCatalog()
  const category = categories.find((item) => item.slug === categorySlug)
  const query = normalizeSearchText(params.get('q') || '')
  const matchingCategoryProducts = useMemo(() => products.filter((product) => !categorySlug || product.categoryId === category?.categoryId), [products, categorySlug, category])
  const filteredProducts = useMemo(() => {
    const queryWords = query.split(/\s+/).filter(Boolean)
    return matchingCategoryProducts.filter((product) => {
      const searchableText = normalizeSearchText(`${product.name} ${product.brand} ${product.category} ${product.sku}`)
      return (!queryWords.length || queryWords.every((word) => searchableText.includes(word))) && (!brandId || String(product.brandId) === brandId)
    })
  }, [matchingCategoryProducts, query, brandId])
  const heading = query ? `Kết quả tìm kiếm: “${params.get('q')}”` : category?.categoryName || 'Tất cả sản phẩm'
  const categoryError = categorySlug && resources.categories.status === 'error'
  const missingCategory = categorySlug && resources.categories.status === 'success' && !category
  return (
    <main className="store-page page-shell">
      <div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><Link to="/san-pham">Sản phẩm</Link>{categorySlug && <><span>/</span><span>{category?.categoryName || categorySlug}</span></>}</div>
      <div className="store-intro"><p className="section-kicker">HOMENEST · ĐIỆN MÁY & GIA DỤNG</p><h1>{heading}</h1><p>Chọn thiết bị gia dụng thiết thực từ danh mục sản phẩm HomeNest.</p></div>
      {categoryError && <p className="empty-search" role="alert">Không thể tải danh mục: {resources.categories.error}</p>}
      {missingCategory && <p className="empty-search">Danh mục này hiện không tồn tại hoặc đã ngừng hoạt động.</p>}
      {categorySlug && resources.categories.status === 'loading' && <p className="empty-search" role="status">Loading category...</p>}
      {!categoryError && !missingCategory && resources.categories.status === 'success' && <>
        <div className="listing-toolbar"><span>{resources.products.status === 'success' ? `${filteredProducts.length} sản phẩm` : 'Sản phẩm'}</span><label htmlFor="brand-filter">Thương hiệu <select id="brand-filter" value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="">Tất cả</option>{brands.map((brand) => <option key={brand.brandId} value={brand.brandId}>{brand.brandName}</option>)}</select></label></div>
        {resources.brands.status === 'error' && <p className="empty-search" role="alert">Không thể tải bộ lọc thương hiệu: {resources.brands.error}</p>}
        <ProductGrid items={filteredProducts} resource={resources.products} emptyText="Không tìm thấy sản phẩm phù hợp. Hãy thử từ khóa hoặc bộ lọc khác." />
        {resources.products.status === 'success' && <div className="listing-more"><span>Đang xem {filteredProducts.length} trên {matchingCategoryProducts.length} sản phẩm</span><Link to="/khuyen-mai">Xem khuyến mãi →</Link></div>}
      </>}
    </main>
  )
}

function normalizeSearchText(value) {
  return value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim()
}

function formatPromotion(promotion) {
  if (String(promotion.discountType).toUpperCase().includes('PERCENT')) return `${Number(promotion.discountValue)}%`
  return formatVnd(promotion.discountValue)
}

export function PromotionPage() {
  const { promotions, resources } = useCatalog()
  return <main className="store-page page-shell"><div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><span>Khuyến mãi</span></div><section className="promotion-hero"><p className="promo-kicker">ƯU ĐÃI GIA DỤNG · SỐ LƯỢNG CÓ HẠN</p><h1>Ưu đãi thiết bị gia dụng</h1><p>Các chương trình khuyến mãi đang có hiệu lực tại HomeNest.</p><Link className="promo-button" to="/san-pham">Mua sắm ngay <span>→</span></Link></section><div className="section-heading page-title-row"><div><p className="section-kicker">GIÁ TỐT MỖI NGÀY</p><h2>Chương trình đang áp dụng</h2></div></div>
    <ResourceState resource={resources.promotions} emptyText="Hiện chưa có chương trình khuyến mãi đang áp dụng." hasData={promotions.length > 0}><div className="brand-directory">{promotions.map((promotion) => <article className="promotion-card" key={promotion.promotionId}><strong>{promotion.promotionName}</strong><span>{promotion.promotionCode} · Giảm {formatPromotion(promotion)}</span>{promotion.description && <p>{promotion.description}</p>}<small>{new Date(promotion.startsAt).toLocaleDateString('vi-VN')} – {new Date(promotion.endsAt).toLocaleDateString('vi-VN')}</small></article>)}</div></ResourceState>
  </main>
}

export function BrandPage() {
  const { brands, products, resources } = useCatalog()
  return <main className="store-page page-shell"><div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><span>Thương hiệu</span></div><div className="store-intro"><p className="section-kicker">THƯƠNG HIỆU ĐƯỢC TIN CHỌN</p><h1>Thương hiệu gia dụng</h1><p>Tìm sản phẩm theo các thương hiệu hiện có trong danh mục HomeNest.</p></div>
    <ResourceState resource={resources.brands} emptyText="Hiện chưa có thương hiệu đang hoạt động." hasData={brands.length > 0}><div className="brand-directory">{brands.map((brand) => { const count = resources.products.status === 'success' ? products.filter((product) => product.brandId === brand.brandId).length : null; return <Link key={brand.brandId} to={`/san-pham?q=${encodeURIComponent(brand.brandName)}`}><strong>{brand.brandName}</strong><span>{count === null ? 'Đang tải số sản phẩm' : `${count} sản phẩm`} →</span></Link> })}</div></ResourceState>
    {resources.products.status === 'error' && <p className="empty-search" role="alert">Không thể tải số lượng sản phẩm theo thương hiệu: {resources.products.error}</p>}
  </main>
}

const supportContent = {
  'chinh-sach-mua-hang': { title: 'Chính sách mua hàng', intro: 'Thông tin cần biết khi chọn và đặt mua sản phẩm tại HomeNest.', sections: [['Tư vấn chọn sản phẩm', 'Đọc kỹ thông số, kích thước và nhu cầu sử dụng trước khi chọn thiết bị. Bạn có thể liên hệ HomeNest để được tư vấn sản phẩm phù hợp.'], ['Xác nhận đơn hàng', 'Thông tin đặt mua cần có tên người nhận, số điện thoại và địa chỉ giao hàng chính xác. Đơn hàng sẽ được xác nhận trước khi giao.'], ['Kiểm tra khi nhận hàng', 'Vui lòng kiểm tra tình trạng bên ngoài, phụ kiện và thông tin sản phẩm khi nhận. Giữ lại chứng từ mua hàng để được hỗ trợ bảo hành.']] },
  'chinh-sach-van-chuyen': { title: 'Chính sách vận chuyển', intro: 'Quy trình giao thiết bị gia dụng đến địa chỉ nhận hàng của bạn.', sections: [['Phạm vi giao hàng', 'HomeNest tiếp nhận yêu cầu giao hàng theo thông tin địa chỉ khách hàng cung cấp. Thời gian và khả năng giao tùy thuộc khu vực và sản phẩm.'], ['Thời gian giao dự kiến', 'Nhân viên xác nhận sẽ thông báo thời gian dự kiến sau khi tiếp nhận đơn. Với thiết bị cồng kềnh, khách hàng nên sắp xếp người nhận tại địa chỉ.'], ['Nhận và kiểm tra hàng', 'Người nhận kiểm tra bao bì, mẫu mã và phụ kiện trước khi xác nhận đã nhận hàng. Nếu có bất thường, hãy ghi nhận tình trạng và liên hệ hỗ trợ.']] },
  'chinh-sach-doi-tra': { title: 'Chính sách đổi trả', intro: 'Hướng dẫn liên hệ HomeNest khi sản phẩm có vấn đề sau khi nhận.', sections: [['Tiếp nhận yêu cầu', 'Chuẩn bị mã đơn hàng, thông tin sản phẩm và mô tả tình trạng cần hỗ trợ. Liên hệ HomeNest sớm để được hướng dẫn bước tiếp theo.'], ['Tình trạng sản phẩm', 'Giữ sản phẩm, phụ kiện, bao bì và chứng từ liên quan để việc kiểm tra được thuận tiện. Không tự ý tháo lắp nếu thiết bị gặp lỗi kỹ thuật.'], ['Bảo hành', 'Điều kiện và thời hạn bảo hành áp dụng theo thông tin của từng sản phẩm và chính sách của hãng. Vui lòng tham khảo phiếu bảo hành đi kèm.']] },
  'lien-he': { title: 'Liên hệ HomeNest', intro: 'Đội ngũ HomeNest sẵn sàng hỗ trợ bạn về sản phẩm và đơn hàng.', sections: [['Tư vấn sản phẩm', 'Hotline: 1900 0000. Thời gian tư vấn dự kiến: 8:00–21:00, từ thứ Hai đến Chủ nhật.'], ['Hỗ trợ qua email', 'Gửi nội dung cần hỗ trợ đến hotro@homenest.vn. Vui lòng ghi rõ tên, số điện thoại liên hệ và mã đơn hàng (nếu có).'], ['Thông tin cần cung cấp', 'Mô tả sản phẩm hoặc vấn đề cần hỗ trợ, thời điểm phát sinh và hình ảnh liên quan sẽ giúp quá trình tiếp nhận thuận tiện hơn.']] },
}

export function SupportPage() {
  const { pathname } = useLocation()
  const slug = pathname.split('/').filter(Boolean).at(-1)
  const page = supportContent[slug]
  if (!page) return <NotFoundPage />
  return <main className="store-page page-shell support-page"><div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><Link to="/ho-tro/chinh-sach-mua-hang">Hỗ trợ</Link><span>/</span><span>{page.title}</span></div><div className="store-intro"><p className="section-kicker">HOMENEST · HỖ TRỢ KHÁCH HÀNG</p><h1>{page.title}</h1><p>{page.intro}</p></div><div className="support-content">{page.sections.map(([heading, body], index) => <section key={heading}><span className="support-number">0{index + 1}</span><div><h2>{heading}</h2><p>{body}</p></div></section>)}</div><Link className="support-contact-link" to="/ho-tro/lien-he">Cần hỗ trợ thêm? Liên hệ HomeNest →</Link></main>
}

export function NotFoundPage() {
  return <main className="store-page page-shell not-found"><p className="section-kicker">HOMENEST</p><h1>Không tìm thấy trang</h1><p>Địa chỉ bạn truy cập không tồn tại hoặc đã được thay đổi.</p><Link className="primary-button" to="/">Trở về trang chủ <span>→</span></Link></main>
}
