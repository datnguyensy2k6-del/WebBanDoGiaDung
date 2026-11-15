import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'
import { useCatalog } from '../context/CatalogContext.jsx'

const PAGE_SIZE = 20
const blankForm = { name: '', slug: '', description: '', parentCategoryId: '', sortOrder: '0', isActive: true }

function AdminTaxonomyPage({ kind }) {
  const isCategory = kind === 'category'
  const basePath = `/admin/${isCategory ? 'categories' : 'brands'}`
  const endpoint = `/admin/${isCategory ? 'categories' : 'brands'}`
  const entityLabel = isCategory ? 'danh mục' : 'thương hiệu'
  const { refreshTaxonomies } = useCatalog()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingId, setPendingId] = useState(null)
  const [allCategories, setAllCategories] = useState([])
  const [parentError, setParentError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [formError, setFormError] = useState('')

  const loadItems = useCallback(async (signal) => {
    setStatus('loading')
    setError('')
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search) query.set('search', search)
    if (activeFilter) query.set('isActive', activeFilter)
    try {
      const response = await api.get(`${endpoint}?${query}`, { signal })
      if (!response?.success || !Array.isArray(response.data)) throw new Error(`Phản hồi danh sách ${entityLabel} không hợp lệ.`)
      setResult(response)
      setStatus('success')
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return
      setError(requestError?.message || `Không thể tải danh sách ${entityLabel}.`)
      setStatus('error')
    }
  }, [activeFilter, endpoint, entityLabel, page, search])

  useEffect(() => {
    const controller = new AbortController()
    loadItems(controller.signal)
    return () => controller.abort()
  }, [loadItems])

  const loadAllCategories = useCallback(async () => {
    if (!isCategory) return
    setParentError('')
    try {
      const all = []
      let currentPage = 1
      let totalCount = 0
      do {
        const response = await api.get(`/admin/categories?page=${currentPage}&pageSize=100`)
        if (!response?.success || !Array.isArray(response.data)) throw new Error('Phản hồi danh sách danh mục làm danh mục cha không hợp lệ.')
        all.push(...response.data)
        totalCount = response.totalCount
        currentPage += 1
      } while (all.length < totalCount)
      setAllCategories(all)
    } catch (requestError) {
      setParentError(requestError?.message || 'Không thể tải danh sách danh mục cha.')
    }
  }, [isCategory])

  useEffect(() => { loadAllCategories() }, [loadAllCategories])

  const blockedParentIds = useMemo(() => {
    if (!isCategory || !editing) return new Set()
    const blocked = new Set([editing.categoryId])
    let changed = true
    while (changed) {
      changed = false
      for (const category of allCategories) {
        if (blocked.has(category.parentCategoryId) && !blocked.has(category.categoryId)) {
          blocked.add(category.categoryId)
          changed = true
        }
      }
    }
    return blocked
  }, [allCategories, editing, isCategory])

  function submitSearch(event) {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  function openCreate() {
    setEditing(null)
    setForm(blankForm)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({
      name: isCategory ? item.categoryName : item.brandName,
      slug: item.slug,
      description: item.description || '',
      parentCategoryId: isCategory && item.parentCategoryId ? String(item.parentCategoryId) : '',
      sortOrder: isCategory ? String(item.sortOrder) : '0',
      isActive: item.isActive,
    })
    setFormError('')
    setModalOpen(true)
  }

  async function saveItem(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setNotice('')
    const body = isCategory
      ? {
          categoryName: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim() || null,
          parentCategoryId: form.parentCategoryId ? Number(form.parentCategoryId) : null,
          sortOrder: Number(form.sortOrder),
          ...(!editing ? { isActive: form.isActive } : {}),
        }
      : {
          brandName: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description.trim() || null,
          ...(!editing ? { isActive: form.isActive } : {}),
        }
    try {
      const response = editing
        ? await api.patch(`${endpoint}/${editing[isCategory ? 'categoryId' : 'brandId']}`, body)
        : await api.post(endpoint, body)
      if (!response?.success || !response.data) throw new Error(`Phản hồi lưu ${entityLabel} không hợp lệ.`)
      setModalOpen(false)
      setNotice(editing ? `Đã cập nhật ${entityLabel}.` : `Đã thêm ${entityLabel}.`)
      await Promise.all([loadItems(), refreshTaxonomies()])
      if (isCategory) await loadAllCategories()
    } catch (requestError) {
      setFormError(requestError?.message || `Không thể lưu ${entityLabel}.`)
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(item) {
    const id = item[isCategory ? 'categoryId' : 'brandId']
    setPendingId(id)
    setError('')
    setNotice('')
    try {
      const response = await api.patch(`${endpoint}/${id}/status`, { isActive: !item.isActive })
      if (!response?.success) throw new Error(`Không thể cập nhật trạng thái ${entityLabel}.`)
      setNotice(response.data.isActive ? `Đã bật ${entityLabel}.` : `Đã tắt ${entityLabel}.`)
      await Promise.all([loadItems(), refreshTaxonomies()])
      if (isCategory) await loadAllCategories()
    } catch (requestError) {
      setError(requestError?.message || `Không thể cập nhật trạng thái ${entityLabel}.`)
    } finally {
      setPendingId(null)
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.totalCount / result.pageSize)) : 1
  const idField = isCategory ? 'categoryId' : 'brandId'

  return (
    <main className="store-page page-shell admin-taxonomy-page">
      <div className="breadcrumbs"><Link to="/">Trang chủ</Link><span>/</span><Link to="/admin">Quản trị</Link><span>/</span><span>{isCategory ? 'Quản lý danh mục' : 'Quản lý thương hiệu'}</span></div>
      <div className="admin-taxonomy-heading">
        <div className="store-intro"><p className="section-kicker">HOMENEST · ADMIN</p><h1>{isCategory ? 'Quản lý danh mục' : 'Quản lý thương hiệu'}</h1><p>Thêm, cập nhật và bật/tắt {entityLabel} trong catalog.</p></div>
        <button className="admin-primary-link" type="button" onClick={openCreate}>+ Thêm {isCategory ? 'danh mục' : 'thương hiệu'}</button>
      </div>

      <div className="admin-taxonomy-nav"><Link to="/admin/products">Sản phẩm</Link><Link className={isCategory ? 'is-current' : ''} to="/admin/categories">Danh mục</Link><Link className={!isCategory ? 'is-current' : ''} to="/admin/brands">Thương hiệu</Link></div>
      {notice && <p className="admin-taxonomy-notice" role="status">{notice}</p>}
      <section className="admin-products-toolbar" aria-label={`Bộ lọc ${entityLabel}`}>
        <form onSubmit={submitSearch}><label htmlFor="admin-taxonomy-search">Tìm theo tên hoặc slug</label><input id="admin-taxonomy-search" value={searchInput} maxLength={250} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tên hoặc slug" /><button className="account-edit-button" type="submit">Tìm kiếm</button></form>
        <label>Trạng thái<select value={activeFilter} onChange={(event) => { setPage(1); setActiveFilter(event.target.value) }}><option value="">Tất cả</option><option value="true">Đang hoạt động</option><option value="false">Đã tắt</option></select></label>
      </section>

      {error && <p className="order-error" role="alert">{error}</p>}
      {status === 'loading' && <p className="empty-search" role="status">Đang tải {entityLabel}...</p>}
      {status === 'error' && <div className="order-error" role="alert">{error}<button type="button" onClick={() => loadItems()}>Thử lại</button></div>}
      {status === 'success' && result.data.length === 0 && <section className="cart-message"><h2>Không tìm thấy {entityLabel}</h2><p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p></section>}
      {status === 'success' && result.data.length > 0 && <>
        <div className="admin-products-table-wrap">
          <table className="admin-products-table admin-taxonomy-table">
            <thead><tr>{isCategory
              ? <><th>ID</th><th>Tên danh mục</th><th>Slug</th><th>Danh mục cha</th><th>Sort Order</th><th>Trạng thái</th><th>Thao tác</th></>
              : <><th>ID</th><th>Tên thương hiệu</th><th>Slug</th><th>Mô tả</th><th>Trạng thái</th><th>Thao tác</th></>}</tr></thead>
            <tbody>{result.data.map((item) => <tr key={item[idField]}>
              <td>{item[idField]}</td>
              <td><strong>{isCategory ? item.categoryName : item.brandName}</strong>{isCategory && item.description && <small>{item.description}</small>}</td>
              <td><code>{item.slug}</code></td>
              {isCategory && <><td>{item.parentCategoryName || '—'}</td><td>{item.sortOrder}</td></>}
              {!isCategory && <td className="taxonomy-description-cell">{item.description || '—'}</td>}
              <td><span className={`status-pill ${item.isActive ? 'status-success' : 'status-cancelled'}`}>{item.isActive ? 'Đang hoạt động' : 'Đã tắt'}</span></td>
              <td><div className="admin-product-actions"><button type="button" onClick={() => openEdit(item)}>Sửa</button><button type="button" disabled={pendingId === item[idField]} onClick={() => toggleStatus(item)}>{pendingId === item[idField] ? 'Đang lưu...' : item.isActive ? 'Tắt' : 'Bật'}</button></div></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="orders-pagination"><button type="button" disabled={page <= 1 || status === 'loading'} onClick={() => setPage((current) => current - 1)}>← Trang trước</button><span>Trang {result.page} / {totalPages} · {result.totalCount} {entityLabel}</span><button type="button" disabled={page >= totalPages || status === 'loading'} onClick={() => setPage((current) => current + 1)}>Trang sau →</button></div>
      </>}

      {modalOpen && <div className="admin-taxonomy-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false) }}>
        <section className="admin-taxonomy-modal" role="dialog" aria-modal="true" aria-labelledby="admin-taxonomy-form-title">
          <div className="admin-taxonomy-modal-heading"><div><p className="section-kicker">HOMENEST · ADMIN</p><h2 id="admin-taxonomy-form-title">{editing ? `Sửa ${entityLabel}` : `Thêm ${entityLabel}`}</h2></div><button type="button" aria-label="Đóng" disabled={saving} onClick={() => setModalOpen(false)}>×</button></div>
          <form className="admin-taxonomy-form" onSubmit={saveItem}>
            <label>{isCategory ? 'Tên danh mục' : 'Tên thương hiệu'}<input autoFocus name="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={120} required /></label>
            <label>Slug<input name="slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} maxLength={140} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Dùng chữ thường không dấu, số và dấu gạch nối." required /><small>Dùng chữ thường không dấu, số và dấu gạch nối.</small></label>
            {isCategory && <label>Danh mục cha<select value={form.parentCategoryId} onChange={(event) => setForm((current) => ({ ...current, parentCategoryId: event.target.value }))}><option value="">Không có</option>{allCategories.filter((category) => !blockedParentIds.has(category.categoryId)).map((category) => <option key={category.categoryId} value={category.categoryId}>{category.categoryName}{category.isActive ? '' : ' (đã tắt)'}</option>)}</select>{parentError && <small className="taxonomy-field-error">{parentError}</small>}</label>}
            {isCategory && <label>Sort Order<input type="number" min="0" max="2147483647" step="1" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} required /></label>}
            <label className="admin-taxonomy-description">Mô tả<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={500} rows={4} /></label>
            {!editing && <label className="admin-taxonomy-status-field">Trạng thái<select value={String(form.isActive)} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === 'true' }))}><option value="true">Đang hoạt động</option><option value="false">Đã tắt</option></select></label>}
            {formError && <p className="order-error" role="alert">{formError}</p>}
            <div className="admin-taxonomy-form-actions"><button className="admin-primary-link" type="submit" disabled={saving || Boolean(parentError)}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : `Thêm ${entityLabel}`}</button><button className="account-edit-button" type="button" disabled={saving} onClick={() => setModalOpen(false)}>Hủy</button></div>
          </form>
        </section>
      </div>}
    </main>
  )
}

export default AdminTaxonomyPage
