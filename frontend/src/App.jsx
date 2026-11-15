import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import SiteLayout from './components/SiteLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import { CategoryPage, PromotionPage, BrandPage, SupportPage, NotFoundPage } from './pages/StorePages.jsx'
import ProductDetailPage from './pages/ProductDetailPage.jsx'
import { CatalogProvider } from './context/CatalogContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { LoginPage, RegisterPage } from './pages/AuthPage.jsx'
import CartPage from './pages/CartPage.jsx'
import { CheckoutPage, OrderDetailPage, OrderListPage } from './pages/OrderPages.jsx'
import AccountPage from './pages/AccountPage.jsx'
import AdminOrdersPage from './pages/AdminOrdersPage.jsx'
import AdminOrderDetailPage from './pages/AdminOrderDetailPage.jsx'
import AdminProductsPage from './pages/AdminProductsPage.jsx'
import AdminProductDetailPage from './pages/AdminProductDetailPage.jsx'
import AdminCategoriesPage from './pages/AdminCategoriesPage.jsx'
import AdminBrandsPage from './pages/AdminBrandsPage.jsx'
import AdminDashboardPage from './pages/AdminDashboardPage.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <CatalogProvider>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route element={<SiteLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/san-pham" element={<CategoryPage />} />
                <Route path="/san-pham/:id" element={<ProductRoute />} />
                <Route path="/khuyen-mai" element={<PromotionPage />} />
                <Route path="/thuong-hieu" element={<BrandPage />} />
                <Route path="/ho-tro/:topic" element={<SupportPage />} />
                <Route path="/dang-nhap" element={<LoginPage />} />
                <Route path="/dang-ky" element={<RegisterPage />} />
                <Route path="/gio-hang" element={<CartPage />} />
                <Route path="/thanh-toan" element={<CheckoutPage />} />
                <Route path="/tai-khoan" element={<AccountPage />} />
                <Route path="/don-hang" element={<OrderListPage />} />
                <Route path="/don-hang/:orderId" element={<OrderDetailPage />} />
                <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
                <Route path="/admin/orders" element={<AdminRoute><AdminOrdersPage /></AdminRoute>} />
                <Route path="/admin/orders/:orderId" element={<AdminRoute><AdminOrderDetailPage /></AdminRoute>} />
                <Route path="/admin/products" element={<AdminRoute><AdminProductsPage /></AdminRoute>} />
                <Route path="/admin/categories" element={<AdminRoute><AdminCategoriesPage /></AdminRoute>} />
                <Route path="/admin/brands" element={<AdminRoute><AdminBrandsPage /></AdminRoute>} />
                <Route path="/admin/products/new" element={<AdminRoute><AdminProductDetailPage createMode /></AdminRoute>} />
                <Route path="/admin/products/:productId" element={<AdminRoute><AdminProductDetailPage /></AdminRoute>} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </CartProvider>
        </AuthProvider>
      </CatalogProvider>
    </BrowserRouter>
  )
}

function ProductRoute() {
  const { id } = useParams()
  return /^\d+$/.test(id || '') ? <ProductDetailPage /> : <CategoryPage categorySlug={id} />
}

export default App
