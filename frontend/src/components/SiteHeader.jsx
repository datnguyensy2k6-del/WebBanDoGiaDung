import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'

const supportLinks = [
  ['Chính sách mua hàng', '/ho-tro/chinh-sach-mua-hang'],
  ['Chính sách vận chuyển', '/ho-tro/chinh-sach-van-chuyen'],
  ['Chính sách đổi trả', '/ho-tro/chinh-sach-doi-tra'],
  ['Liên hệ', '/ho-tro/lien-he'],
]

function Icon({ name }) {
  if (name === 'search') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2"/></svg>
  if (name === 'user') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.8 20c.7-3.5 3.4-5.5 7.2-5.5s6.5 2 7.2 5.5"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
}

function Dropdown({ label, basePath, links, open, setOpen, closeMobile }) {
  const location = useLocation()
  const active = location.pathname.startsWith(basePath)
  return (
    <div className={`nav-dropdown ${open ? 'is-open' : ''} ${active ? 'is-active' : ''}`}>
      <button type="button" className="nav-trigger" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}<span className="nav-chevron">⌄</span>
      </button>
      <div className="dropdown-panel">
        {links.map(([text, to]) => <NavLink key={to} to={to} onClick={closeMobile} className={({ isActive }) => isActive ? 'dropdown-link is-current' : 'dropdown-link'}>{text}</NavLink>)}
      </div>
    </div>
  )
}

function SiteHeader({ onSearch }) {
  const { categories } = useCatalog()
  const { user, logout } = useAuth()
  const { itemCount, status: cartStatus } = useCart()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef(null)
  useEffect(() => {
    if (!accountMenuOpen) return undefined
    function handlePointerDown(event) {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setAccountMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [accountMenuOpen])
  function handleSubmit(event) {
    event.preventDefault()
    setMenuOpen(false)
    setOpenMenu('')
    onSearch(query)
  }

  function toggleDropdown(name) { setOpenMenu((current) => current === name ? '' : name) }
  function closeMobile() { setMenuOpen(false); setOpenMenu('') }
  const productLinks = [
    ['Tất cả sản phẩm', '/san-pham'],
    ...categories.map((category) => [category.categoryName, `/san-pham/${encodeURIComponent(category.slug)}`]),
  ]

  return (
    <header className="site-header">
      <div className="top-strip"><div className="page-shell top-strip-inner"><span>Siêu thị điện máy & gia dụng cho mọi nhà</span><span>Giao hàng toàn quốc <b>•</b> Tư vấn mua hàng mỗi ngày</span></div></div>
      <div className="header-main page-shell">
        <button className="menu-toggle" aria-label="Mở menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span/><span/><span/></button>
        <Link className="brand" to="/" aria-label="HomeNest, trang chủ"><img className="brand-logo" src="/logo.png" alt=""/><span>Home<span>Nest</span><small>ĐIỆN MÁY & GIA DỤNG</small></span></Link>
        <form className="search-form" onSubmit={handleSubmit} role="search">
          <Icon name="search" />
          <input aria-label="Tìm kiếm sản phẩm" placeholder="search entire store here" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button type="submit">Tìm kiếm</button>
        </form>
        <div className="header-actions">
          {user ? <div className={`account-session ${accountMenuOpen ? 'is-open' : ''}`} ref={accountMenuRef}>
            <button className="account-menu-trigger" type="button" aria-haspopup="menu" aria-expanded={accountMenuOpen} aria-controls="account-menu" onClick={() => setAccountMenuOpen((isOpen) => !isOpen)}>
              <Icon name="user"/><span>T&#224;i kho&#7843;n HomeNest</span><span className="account-menu-chevron" aria-hidden="true">▾</span>
            </button>
            {accountMenuOpen && <div className="account-menu-panel" id="account-menu" role="menu">
              <div className="account-menu-heading"><strong>T&#224;i kho&#7843;n HomeNest</strong><small>{user.fullName}</small></div>
              <div className="account-menu-items">
                <Link role="menuitem" className="account-menu-link" to="/don-hang" onClick={() => setAccountMenuOpen(false)}>&#272;&#417;n h&#224;ng c&#7911;a t&#244;i</Link>
                {user.roles?.includes('ADMIN') && <Link role="menuitem" className="account-menu-link admin-account-link" to="/admin" onClick={() => setAccountMenuOpen(false)}>Dashboard</Link>}
                {user.roles?.includes('ADMIN') && <Link role="menuitem" className="account-menu-link admin-account-link" to="/admin/products" onClick={() => setAccountMenuOpen(false)}>Qu&#7843;n l&#253; s&#7843;n ph&#7849;m</Link>}
                {user.roles?.includes('ADMIN') && <Link role="menuitem" className="account-menu-link admin-account-link" to="/admin/categories" onClick={() => setAccountMenuOpen(false)}>Qu&#7843;n l&#253; danh m&#7909;c</Link>}
                {user.roles?.includes('ADMIN') && <Link role="menuitem" className="account-menu-link admin-account-link" to="/admin/brands" onClick={() => setAccountMenuOpen(false)}>Qu&#7843;n l&#253; th&#432;&#417;ng hi&#7879;u</Link>}
                {user.roles?.includes('ADMIN') && <Link role="menuitem" className="account-menu-link admin-account-link" to="/admin/orders" onClick={() => setAccountMenuOpen(false)}>Qu&#7843;n l&#253; &#273;&#417;n h&#224;ng</Link>}
              </div>
              <div className="account-menu-footer"><button role="menuitem" className="account-menu-logout" type="button" onClick={logout}>&#272;&#259;ng xu&#7845;t</button></div>
            </div>}
          </div> : <div className="account-links"><Link className="account-link" to="/dang-nhap">&#272;&#259;ng nh&#7853;p</Link><Link className="account-link account-register-link" to="/dang-ky">&#272;&#259;ng k&#253;</Link></div>}
          <Link className="header-action" aria-label="Giỏ hàng" to="/gio-hang"><Icon name="bag"/><span>Giỏ hàng</span>{user && <i>{cartStatus === 'loading' ? '…' : itemCount}</i>}</Link>
        </div>
      </div>
      <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Điều hướng chính">
        <div className="page-shell nav-inner">
          <NavLink end to="/" onClick={closeMobile} className={({ isActive }) => `nav-link ${isActive ? 'is-current' : ''}`}>Trang chủ</NavLink>
          <Dropdown label="Sản phẩm" basePath="/san-pham" links={productLinks} open={openMenu === 'products'} setOpen={() => toggleDropdown('products')} closeMobile={closeMobile}/>
          <NavLink to="/khuyen-mai" onClick={closeMobile} className={({ isActive }) => `nav-link nav-promo ${isActive ? 'is-current' : ''}`}>Khuyến mãi</NavLink>
          <NavLink to="/thuong-hieu" onClick={closeMobile} className={({ isActive }) => `nav-link ${isActive ? 'is-current' : ''}`}>Thương hiệu</NavLink>
          <Dropdown label="Hỗ trợ" basePath="/ho-tro" links={supportLinks} open={openMenu === 'support'} setOpen={() => toggleDropdown('support')} closeMobile={closeMobile}/>
        </div>
      </nav>
    </header>
  )
}

export default SiteHeader
