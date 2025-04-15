const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const auth1Routes = require('./routes/auth1Routes');
const db=require("./config/db")
const reviewRoutes = require("./routes/reviewRoutes");

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const couponRoutes = require('./routes/couponRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const attributeRoutes = require('./routes/attributeRoutes');
const couponApplicationRoutes = require('./routes/couponApplicationRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const cookieParser = require('cookie-parser');
const cartRoutes = require("./routes/cartRoutes");
const errorHandler = require("./middleware/errorMiddleware");
const orderRoutes = require("./routes/orderRoutes");
const bulkOrderRoutes = require('./routes/bulkOrderRoutes'); 
const enquiryRoutes = require('./routes/enquiryRoutes');
const hotDealRoutes = require('./routes/hotDealRoutes');
const categoryRoutes1 = require('./routes/categoryRoutes1');


const app = express();
app.use(bodyParser.json());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'], 
  credentials: true
}));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', authRoutes);
app.set('mysqlPool', db);
app.use('/api/enquiries', enquiryRoutes);
app.use('/images', express.static(path.join(__dirname, 'public/images')));

app.use(cookieParser());
app.use("/api/reviews", reviewRoutes);
app.use('/api/auth', auth1Routes);


app.use('/api', userRoutes);
app.use('/api', couponRoutes);
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use('/uploads', express.static('uploads'));
app.use('/api', productRoutes);
app.use('/api', categoryRoutes);
app.use('/api', attributeRoutes);
app.use('/api', couponApplicationRoutes);
app.use('/api', rewardRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/coupons', require("./routes/couponRoutes"));
app.use('/api', hotDealRoutes);
app.use('/api', checkoutRoutes);
app.use("/api/orders", orderRoutes);
app.use('/api/categories1', categoryRoutes1);

// Routes
app.use("/api/cart", cartRoutes);
app.use('/api/bulk-orders', bulkOrderRoutes);// Error Handling Middleware
app.use(errorHandler);

// app.get('/test-image', (req, res) => {
//   res.sendFile(path.join(__dirname, 'uploads', '1740119282854_cray6.jpg'));
// });
app.use(cookieParser());
app.get('', (req, res) => {
  res.end('welcome')

 });

 app.use((req, res, next) => {
  res.status(404).json({
    error: `Cannot ${req.method} ${req.url}`,
    availableRoutes: app._router.stack
      .filter(r => r.route)
      .map(r => `${Object.keys(r.route.methods).join(',')} ${r.route.path}`)
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
