
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const productsRoutes = require('./src/routes/products.routes');
const categoriesRoutes = require('./src/routes/categories.routes');
const brandsRoutes = require('./src/routes/brands.routes');
const promotionsRoutes = require('./src/routes/promotions.routes');
const authRoutes = require('./src/routes/auth.routes');
const usersRoutes = require('./src/routes/users.routes');
const cartRoutes = require('./src/routes/cart.routes');
const wishlistRoutes = require('./src/routes/wishlist.routes');
const ordersRoutes = require('./src/routes/orders.routes');
const adminOrdersRoutes = require('./src/routes/admin-orders.routes');
const adminProductsRoutes = require('./src/routes/admin-products.routes');
const adminCategoriesRoutes = require('./src/routes/admin-categories.routes');
const adminBrandsRoutes = require('./src/routes/admin-brands.routes');
const adminDashboardRoutes = require('./src/routes/admin-dashboard.routes');

app.use(cors());
app.use(express.json());
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/brands', brandsRoutes);
app.use('/api/promotions', promotionsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin/orders', adminOrdersRoutes);
app.use('/api/admin/products', adminProductsRoutes);
app.use('/api/admin/categories', adminCategoriesRoutes);
app.use('/api/admin/brands', adminBrandsRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);

app.get('/api', (req, res) => {
    res.json({
        message: 'Backend Web bán đồ gia dụng đang hoạt động!'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend đang chạy tại http://0.0.0.0:${PORT}`);
});