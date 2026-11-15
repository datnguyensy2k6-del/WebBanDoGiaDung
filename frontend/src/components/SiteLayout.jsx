import { Outlet, useNavigate } from 'react-router-dom'
import SiteHeader from './SiteHeader.jsx'
import SiteFooter from './SiteFooter.jsx'

function SiteLayout() {
  const navigate = useNavigate()

  function handleSearch(query) {
    const trimmed = query.trim()
    navigate(trimmed ? `/san-pham?q=${encodeURIComponent(trimmed)}` : '/san-pham')
  }

  return (
    <>
      <SiteHeader onSearch={handleSearch} />
      <Outlet />
      <SiteFooter />
    </>
  )
}

export default SiteLayout
