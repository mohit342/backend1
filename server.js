const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const couponRoutes = require('./routes/couponRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const attributeRoutes = require('./routes/attributeRoutes');
const couponApplicationRoutes = require('./routes/couponApplicationRoutes');
const rewardRoutes = require('./routes/rewardRoutes');


const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', couponRoutes);
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use('/api', productRoutes);
app.use('/api', categoryRoutes);
app.use('/api', attributeRoutes);
app.use('/api', couponApplicationRoutes);
app.use('/api', rewardRoutes);

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