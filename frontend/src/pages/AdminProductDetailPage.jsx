import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../api/client.js'
import { useCatalog } from '../context/CatalogContext.jsx'
import { formatVnd } from '../data/catalog-assets.js'

const blankProduct = {
  sku: '',
  productName: '',
  description: '',
  categoryId: '',
  brandId: '',
  imageUrl: '',
  unitPrice: '',
  stockQuantity: '0',
}

function AdminProductDetailPage({ createMode = false }) {
  const { productId } = useParams()
  const { categories, brands, resources } = useCatalog()
  const isCreate = createMode || productId === 'new'
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const isEditing = isCreate || searchParams.get('mode') === 'edit'
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [form, setForm] = useState(blankProduct)
  const [newStock, setNewStock] = useState('')
  const [status, setStatus] = useState(isCreate ? 'success' : 'loading')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [imagePreviewError, setImagePreviewError] = useState(false)
  const [stockError, setStockError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingStock, setSavingStock] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  const loadProduct = useCallback(async (signal) => {
    if (isCreate) return
    setStatus('loading')
    try {
      const response = await api.get(`/admin/products/${productId}`, { signal })
      if (!response?.success || !response.data?.productId) throw new Error('Phản hồi chi tiết sản phẩm không hợp lệ.')
      setProduct(response.data)
      setNewStock(String(response.data.stockQuantity))
      setForm({
        sku: response.data.sku,
        productName: response.data.productName,
        description: response.data.description || '',
        categoryId: String(response.data.categoryId),
        brandId: String(response.data.brandId),
        imageUrl: response.data.imageUrl || '',
        unitPrice: String(response.data.unitPrice),
        stockQuantity: '0',
      })
      setImagePreviewError(false)
      setStatus('success')
      setError('')
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return
      setError(requestError?.message || 'Không thể tải chi tiết sản phẩm.')
      setStatus('error')
    }
  }, [isCreate, productId])

  useEffect(() => {
    const controller = new AbortController()
    loadProduct(controller.signal)
    return () => controller.abort()
  }, [loadProduct])

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    if (event.target.name === 'imageUrl') setImagePreviewError(false)
    setFormError('')
    setNotice('')
  }

  async function submitProduct(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setNotice('')
    const body = {
      sku: form.sku.trim(),
      productName: form.productName.trim(),
      description: form.description.trim() || null,
      categoryId: Number(form.categoryId),
      brandId: Number(form.brandId),
      imageUrl: form.imageUrl.trim() || null,
      unitPrice: Number(form.unitPrice),
    }
    if (isCreate) body.stockQuantity = Number(form.stockQuantity)
    if (!body.sku || !body.productName || !body.categoryId || !body.brandId
      || !Number.isFinite(body.unitPrice) || body.unitPrice < 0
      || !Number.isInteger(body.stockQuantity ?? 0) || (body.stockQuantity ?? 0) < 0) {
      setFormError('Vui lòng kiểm tra các trường bắt buộc, giá và tồn kho.')
      setSaving(false)
      return
    }

    try {
      const response = isCreate
        ? await api.post('/admin/products', body)
        : await api.patch(`/admin/products/${productId}`, body)
      if (!response?.success || !response.data?.productId) throw new Error('Phản hồi lưu sản phẩm không hợp lệ.')
      if (isCreate) {
        navigate('/admin/products', {
          replace: true,
          state: {
            returnTo: location.state?.returnTo || { page: 1, search: '', searchInput: '', activeFilter: '' },
            createdProduct: {
              productId: response.data.productId,
              productName: response.data.productName || body.productName,
              isActive: response.data.isActive !== false,
            },
          },
        })
      } else {
        setProduct(response.data)
        setNotice('Đã lưu thông tin sản phẩm.')
        navigate(`/admin/products/${productId}`, { replace: true })
      }
    } catch (requestError) {
      setFormError(requestError?.message || 'Không thể lưu sản phẩm.')
    } finally {
      setSaving(false)
    }
  }

  async function submitStock(event) {
    event.preventDefault()
    setSavingStock(true)
    setStockError('')
    setNotice('')
    const stockQuantity = Number(newStock)
    if (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 2147483647) {
      setStockError('Tồn kho phải là số nguyên không âm hợp lệ.')
      setSavingStock(false)
      return
    }
    try {
      const response = await api.patch(`/admin/products/${productId}/stock`, { stockQuantity })
      if (!response?.success || !response.data?.productId) throw new Error('Phản hồi cập nhật tồn kho không hợp lệ.')
      setProduct(response.data)
      setNewStock(String(response.data.stockQuantity))
      setNotice('Đã cập nhật tồn kho.')
    } catch (requestError) {
      setStockError(requestError?.message || 'Không thể cập nhật tồn kho.')
    } finally {
      setSavingStock(false)
    }
  }

  async function toggleStatus() {
    setSavingStatus(true)
    setError('')
    setNotice('')
    try {
      const response = await api.patch(`/admin/products/${productId}/status`, { isActive: !product.isActive })
      if (!response?.success || !response.data?.productId) throw new Error('Phản hồi cập nhật trạng thái không hợp lệ.')
      setProduct(response.data)
      setNotice(response.data.isActive ? 'Đã hiện sản phẩm.' : 'Đã ẩn sản phẩm.')
    } catch (requestError) {
      setError(requestError?.message || 'Không thể cập nhật trạng thái sản phẩm.')
    } finally {
      setSavingStatus(false)
    }
  }

  const title = isCreate ? 'Thêm sản phẩm' : isEditing ? 'Sửa sản phẩm' : 'Chi tiết sản phẩm'
  const taxonomyStatus = resources.categories.status === 'error' || resources.brands.status === 'error'
    ? 'error'
    : resources.categories.status === 'success' && resources.brands.status === 'success'
      ? 'success'
      : 'loading'
  const categoryOptions = product && form.categoryId
    && !categories.some((category) => String(category.categoryId) === form.categoryId)
    ? [{ categoryId: product.categoryId, categoryName: product.categoryName }, ...categories]
    : categories
  const brandOptions = product && form.brandId
    && !brands.some((brand) => String(brand.brandId) === form.brandId)
    ? [{ brandId: product.brandId, brandName: product.brandName }, ...brands]
    : brands
  const previewUrl = form.imageUrl.trim()

  return (
    <main className="store-page page-shell admin-product-detail-page">
      <div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><Link to="/admin/products">Quản lý sản phẩm</Link><span>/</span><span>{title}</span></div>
      <div className="admin-product-page-heading"><div className="store-intro"><p className="section-kicker">HOMENEST · ADMIN</p><h1>{title}</h1>{product && <p>{product.sku} · ID {product.productId}</p>}</div>{!isCreate && product && <div className="admin-product-heading-actions"><Link className="account-edit-button" to={`/admin/products/${productId}?mode=edit`}>Sửa thông tin</Link><button className="account-edit-button" type="button" disabled={savingStatus} onClick={toggleStatus}>{savingStatus ? 'Đang lưu...' : product.isActive ? 'Ẩn sản phẩm' : 'Hiện sản phẩm'}</button></div>}</div>
      {status === 'loading' && <p className="empty-search" role="status">Đang tải sản phẩm...</p>}
      {status === 'error' && <div className="order-error" role="alert">{error}<button type="button" onClick={() => loadProduct()}>Thử lại</button></div>}
      {error && status === 'success' && <p className="order-error" role="alert">{error}</p>}
      {notice && <p className="account-success" role="status">{notice}</p>}

      {status === 'success' && isEditing && <section className="admin-product-panel">
        {taxonomyStatus === 'loading' && <p className="empty-search" role="status">Đang tải danh mục và thương hiệu...</p>}
        {taxonomyStatus === 'error' && <p className="order-error" role="alert">Không thể tải danh mục/thương hiệu để lưu sản phẩm.</p>}
        <form className="admin-product-form" onSubmit={submitProduct}>
          <label>Tên sản phẩm<input name="productName" value={form.productName} onChange={updateForm} maxLength={200} required /></label>
          <label>SKU<input name="sku" value={form.sku} onChange={updateForm} maxLength={60} required /></label>
          <div className="admin-product-image-field">
            <label htmlFor="admin-product-image-url">&#7842;nh s&#7843;n ph&#7849;m</label>
            <input id="admin-product-image-url" name="imageUrl" type="text" inputMode="url" autoComplete="url" value={form.imageUrl} onChange={updateForm} maxLength={500} placeholder="Nh&#7853;p URL: https://... ho&#7863;c /images/..." />
            <small>Nh&#7853;p URL HTTP(S) ho&#7863;c &#273;&#432;&#7901;ng d&#7851;n &#7843;nh n&#7897;i b&#7897;. Preview hi&#7875;n th&#7883; khi URL t&#7843;i &#273;&#432;&#7907;c; c&#243; th&#7875; &#273;&#7875; tr&#7889;ng n&#7871;u ch&#432;a c&#243; &#7843;nh.</small>
            {previewUrl && !imagePreviewError && <div className="admin-product-image-preview"><img src={previewUrl} alt={`Xem tr&#432;&#7899;c: ${form.productName || 's&#7843;n ph&#7849;m'}`} onError={() => setImagePreviewError(true)} /></div>}
            {previewUrl && imagePreviewError && <p className="admin-product-image-error" role="alert">Kh&#244;ng t&#7843;i &#273;&#432;&#7907;c &#7843;nh t&#7915; URL n&#224;y.</p>}
          </div>
          <label>Danh mục<select name="categoryId" value={form.categoryId} onChange={updateForm} required disabled={taxonomyStatus !== 'success'}><option value="">Chọn danh mục</option>{categoryOptions.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.categoryName}</option>)}</select></label>
          <label>Thương hiệu<select name="brandId" value={form.brandId} onChange={updateForm} required disabled={taxonomyStatus !== 'success'}><option value="">Chọn thương hiệu</option>{brandOptions.map((brand) => <option key={brand.brandId} value={brand.brandId}>{brand.brandName}</option>)}</select></label>
          <label>Giá bán (VND)<input name="unitPrice" type="number" min="0" step="0.01" value={form.unitPrice} onChange={updateForm} required /></label>
          {isCreate && <label>Tồn kho ban đầu<input name="stockQuantity" type="number" min="0" max="2147483647" step="1" value={form.stockQuantity} onChange={updateForm} required /></label>}
          <label className="admin-product-description">Mô tả<textarea name="description" value={form.description} onChange={updateForm} rows={5} /></label>
          {formError && <p className="order-error" role="alert">{formError}</p>}
          <div className="admin-product-form-actions"><button className="admin-primary-link" type="submit" disabled={saving || taxonomyStatus !== 'success'}>{saving ? 'Đang lưu...' : isCreate ? 'Tạo sản phẩm' : 'Lưu thay đổi'}</button><Link className="address-form-cancel" to={isCreate ? '/admin/products' : `/admin/products/${productId}`}>Hủy</Link></div>
        </form>
      </section>}

      {status === 'success' && !isCreate && !isEditing && product && <div className="admin-product-content">
        <section className="admin-product-panel admin-product-overview">
          <div><small>Trạng thái</small><strong><span className={`status-pill ${product.isActive ? 'status-success' : 'status-cancelled'}`}>{product.isActive ? 'Đang hiển thị' : 'Đang ẩn'}</span></strong></div>
          <div><small>SKU</small><strong>{product.sku}</strong></div>
          <div><small>Danh mục</small><strong>{product.categoryName}</strong></div>
          <div><small>Thương hiệu</small><strong>{product.brandName}</strong></div>
          <div><small>Giá</small><strong>{formatVnd(product.unitPrice)}</strong></div>
          <div><small>Tồn kho hiện tại</small><strong>{product.stockQuantity}</strong></div>
          <section className="admin-product-description-view"><h2>{product.productName}</h2><p>{product.description || 'Chưa có mô tả.'}</p></section>
        </section>
        <section className="admin-product-panel admin-stock-panel" id="stock-form">
          <h2>Cập nhật tồn kho</h2><p>Tồn kho hiện tại: <strong>{product.stockQuantity}</strong></p>
          <form onSubmit={submitStock}><label htmlFor="admin-new-stock">Tồn kho mới</label><input id="admin-new-stock" type="number" min="0" max="2147483647" step="1" value={newStock} onChange={(event) => { setNewStock(event.target.value); setStockError('') }} required /><button className="admin-primary-link" type="submit" disabled={savingStock}>{savingStock ? 'Đang lưu...' : 'Cập nhật tồn kho'}</button></form>
          {stockError && <p className="order-error" role="alert">{stockError}</p>}
        </section>
      </div>}
    </main>
  )
}

export default AdminProductDetailPage
