import { Link } from 'react-router-dom'

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main page-shell">
        <div className="footer-about"><Link className="brand footer-brand" to="/"><img className="brand-logo" src="/logo.png" alt=""/><span>Home<span>Nest</span><small>ĐIỆN MÁY & GIA DỤNG</small></span></Link><p>HomeNest – lựa chọn thiết bị gia dụng thiết thực, giúp tổ ấm thêm tiện nghi mỗi ngày.</p></div>
        <div className="footer-column"><h3>Chính sách mua hàng</h3><Link to="/ho-tro/chinh-sach-mua-hang">Hướng dẫn mua hàng</Link><Link to="/ho-tro/chinh-sach-van-chuyen">Chính sách vận chuyển</Link><Link to="/ho-tro/chinh-sach-doi-tra">Đổi trả & bảo hành</Link></div>
        <div className="footer-column"><h3>Hỗ trợ khách hàng</h3><Link to="/ho-tro/chinh-sach-mua-hang">Câu hỏi thường gặp</Link><Link to="/ho-tro/lien-he">Liên hệ hỗ trợ</Link><Link to="/san-pham">Tra cứu sản phẩm</Link></div>
        <div className="footer-column footer-contact"><h3>HomeNest luôn sẵn sàng hỗ trợ</h3><p>Hotline tư vấn mua hàng</p><strong>1900 0000</strong><p>Thứ 2 – Chủ nhật, 8:00 – 21:00</p><Link to="/ho-tro/lien-he">Gửi yêu cầu hỗ trợ</Link></div>
      </div>
      <div className="footer-bottom"><div className="page-shell"><span>© 2026 HomeNest. Thiết kế dành cho gia đình Việt.</span><span>Điện máy & gia dụng cho mọi nhà</span></div></div>
    </footer>
  )
}

export default SiteFooter
