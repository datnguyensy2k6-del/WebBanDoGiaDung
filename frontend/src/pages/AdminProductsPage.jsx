import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../api/client.js'
import { formatVnd } from '../data/catalog-assets.js'

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN')
}

function AdminProductsPage() {
  const location = useLocation()
  const returnTo = location.state?.returnTo || {}
  const createdProduct = location.state?.createdProduct || null
  const [page, setPage] = useState(returnTo.page || 1)
  const [searchInput, setSearchInput] = useState(returnTo.searchInput || '')
  const [search, setSearch] = useState(returnTo.search || '')
  const [activeFilter, setActiveFilter] = useState(returnTo.activeFilter || '')
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingProductId, setPendingProductId] = useState(null)

  const loadProducts = useCallback(async (signal) => {
    setStatus('loading')
    setError('')
    const query = new URLSearchParams({ page: String(page), pageSize: '20' })
    if (search) query.set('search', search)
    if (activeFilter) query.set('isActive', activeFilter)
    try {
      const response = await api.get(`/admin/products?${query}`, { signal })
      if (!response?.success || !Array.isArray(response.data)) throw new Error('Phản hồi danh sách sản phẩm không hợp lệ.')
      setResult(response)
      setStatus('success')
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return
      setError(requestError?.message || 'Không thể tải danh sách sản phẩm.')
      setStatus('error')
    }
  }, [page, search, activeFilter])

  useEffect(() => {
    const controller = new AbortController()
    loadProducts(controller.signal)
    return () => controller.abort()
  }, [loadProducts])

  function submitSearch(event) {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  async function toggleStatus(product) {
    setPendingProductId(product.productId)
    setActionError('')
    try {
      await api.patch(`/admin/products/${product.productId}/status`, { isActive: !product.isActive })
      await loadProducts()
    } catch (requestError) {
      setActionError(requestError?.message || 'Không thể cập nhật trạng thái sản phẩm.')
    } finally {
      setPendingProductId(null)
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.totalCount / result.pageSize)) : 1
  const createdProductMatchesSearch = createdProduct && (!search ||
    `${createdProduct.productName} ${createdProduct.sku}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))
  const createdProductHiddenByFilter = createdProduct && (
    (activeFilter === 'true' && !createdProduct.isActive)
    || (activeFilter === 'false' && createdProduct.isActive)
    || !createdProductMatchesSearch
  )

  return (
    <main className="store-page page-shell admin-products-page">
      <div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><Link to="/admin">Quản trị</Link><span>/</span><span>Quản lý sản phẩm</span></div>
      <div className="admin-products-heading">
        <div className="store-intro"><p className="section-kicker">HOMENEST · ADMIN</p><h1>Quản lý sản phẩm</h1><p>Quản lý thông tin, giá bán, tồn kho và trạng thái kinh doanh.</p></div>
        <Link className="admin-primary-link" to="/admin/products/new" state={{ returnTo: { page: 1, search, searchInput, activeFilter } }}>+ Thêm sản phẩm</Link>
      </div>

      {createdProduct && <p className="admin-product-created-notice" role="status">
        &#272;&#227; t&#7841;o s&#7843;n ph&#7849;m <strong>{createdProduct.productName}</strong> (ID {createdProduct.productId}).{' '}
        {createdProductHiddenByFilter
          ? <>B&#7897; l&#7885;c hi&#7879;n t&#7841;i kh&#244;ng kh&#7899;p s&#7843;n ph&#7849;m m&#7899;i. <Link to={`/admin/products/${createdProduct.productId}`}>Xem chi ti&#7871;t</Link></>
          : status === 'success' && result?.data.some((item) => item.productId === createdProduct.productId)
            ? 'Danh s&#225;ch &#273;&#227; t&#7843;i l&#7841;i v&#224; c&#243; s&#7843;n ph&#7849;m m&#7899;i.'
            : status === 'success'
              ? <>Ch&#432;a th&#7845;y trong k&#7871;t qu&#7843; API hi&#7879;n t&#7841;i. <Link to={`/admin/products/${createdProduct.productId}`}>M&#7903; chi ti&#7871;t</Link></>
              : '&#272;ang t&#7843;i l&#7841;i danh s&#225;ch s&#7843;n ph&#7849;m...'}
      </p>}
      <section className="admin-products-toolbar" aria-label="Bộ lọc sản phẩm">
        <form onSubmit={submitSearch}>
          <label htmlFor="admin-product-search">Tìm theo tên hoặc SKU</label>
          <input id="admin-product-search" value={searchInput} maxLength={200} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tên sản phẩm hoặc SKU" />
          <button className="account-edit-button" type="submit">Tìm kiếm</button>
        </form>
        <label>Trạng thái
          <select value={activeFilter} onChange={(event) => { setPage(1); setActiveFilter(event.target.value) }}>
            <option value="">Tất cả</option>
            <option value="true">Đang hiển thị</option>
            <option value="false">Đang ẩn</option>
          </select>
        </label>
      </section>

      {actionError && <p className="order-error" role="alert">{actionError}</p>}
      {status === 'loading' && <p className="empty-search" role="status">Đang tải sản phẩm...</p>}
      {status === 'error' && <div className="order-error" role="alert">{error}<button type="button" onClick={() => loadProducts()}>Thử lại</button></div>}
      {status === 'success' && result.data.length === 0 && <section className="cart-message"><h2>Không tìm thấy sản phẩm</h2><p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p></section>}
      {status === 'success' && result.data.length > 0 && <>
        <div className="admin-products-table-wrap">
          <table className="admin-products-table">
            <thead><tr><th>Sản phẩm</th><th>SKU</th><th>Giá</th><th>Tồn kho</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>{result.data.map((product) => <tr key={product.productId}>
              <td><strong>{product.productName}</strong><small>{product.brandName} · {product.categoryName}</small></td>
              <td>{product.sku}</td>
              <td>{formatVnd(product.unitPrice)}</td>
              <td>{product.stockQuantity}</td>
              <td><span className={`status-pill ${product.isActive ? 'status-success' : 'status-cancelled'}`}>{product.isActive ? 'Đang hiển thị' : 'Đang ẩn'}</span></td>
              <td><div className="admin-product-actions">
                <Link to={`/admin/products/${product.productId}`}>Xem</Link>
                <Link to={`/admin/products/${product.productId}?mode=edit`}>Sửa</Link>
                <Link to={`/admin/products/${product.productId}#stock-form`}>Tồn kho</Link>
                <button type="button" disabled={pendingProductId === product.productId} onClick={() => toggleStatus(product)}>{pendingProductId === product.productId ? 'Đang lưu...' : product.isActive ? 'Ẩn' : 'Hiện'}</button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="orders-pagination">
          <button type="button" disabled={page <= 1 || status === 'loading'} onClick={() => setPage((current) => current - 1)}>← Trang trước</button>
          <span>Trang {result.page} / {totalPages} · {result.totalCount} sản phẩm</span>
          <button type="button" disabled={page >= totalPages || status === 'loading'} onClick={() => setPage((current) => current + 1)}>Trang sau →</button>
        </div>
      </>}
    </main>
  )
}

export default AdminProductsPage
