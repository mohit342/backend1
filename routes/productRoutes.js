const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../config/multer'); // Configure multer

// Product routes
router.get('/products/top-trending', productController.getTopTrending); // Specific route first
router.get('/products', productController.getAll);
router.get('/products/:id', productController.getById);
router.get('/products/slug/:slug', productController.getBySlug);

router.post('/products', upload.array('images'), productController.create);
router.delete('/products/:id', productController.deleteProduct);
router.put('/products/:id', upload.array('images'), productController.updateProduct);

// New route to update is_trending status
router.patch('/products/:id', productController.updateTrendingStatus);

module.exports = router;