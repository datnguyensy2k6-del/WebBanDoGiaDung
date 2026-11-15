import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const { user, login, register, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')

  if (user) return <Navigate to="/" replace />

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (isRegister && form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }

    try {
      if (isRegister) {
        const account = {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        }
        await register(account)
      } else {
        await login({ email: form.email.trim(), password: form.password })
      }
      const destination = location.state?.from
      navigate(typeof destination === 'string' ? destination : '/', { replace: true })
    } catch (requestError) {
      setError(requestError?.message || 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.')
    }
  }

  return (
    <main className="auth-page page-shell">
      <section className="auth-card">
        <p className="section-kicker">HOMENEST · TÀI KHOẢN</p>
        <h1>{isRegister ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</h1>
        <p className="auth-intro">{isRegister ? 'Đăng ký để trải nghiệm mua sắm thuận tiện hơn.' : 'Đăng nhập vào tài khoản HomeNest của bạn.'}</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && <label>Họ và tên<input name="fullName" type="text" autoComplete="name" maxLength={150} value={form.fullName} onChange={updateField} required /></label>}
          <label>Email<input name="email" type="email" autoComplete="email" maxLength={320} value={form.email} onChange={updateField} required /></label>
          {isRegister && <label>Số điện thoại <span>(không bắt buộc)</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={updateField} /></label>}
          <label>Mật khẩu<input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={8} value={form.password} onChange={updateField} required /></label>
          {isRegister && <label>Xác nhận mật khẩu<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} value={form.confirmPassword} onChange={updateField} required /></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Đang xử lý...' : isRegister ? 'Đăng ký' : 'Đăng nhập'}</button>
        </form>
        <p className="auth-switch">{isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
          <Link to={isRegister ? '/dang-nhap' : '/dang-ky'}>{isRegister ? 'Đăng nhập' : 'Đăng ký ngay'}</Link>
        </p>
      </section>
    </main>
  )
}

export function LoginPage() {
  return <AuthPage mode="login" />
}

export function RegisterPage() {
  return <AuthPage mode="register" />
}
