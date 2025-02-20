const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../config/multer'); // Configure multer

// Product routes
router.get('/products', productController.getAll);
router.get('/products/:id', productController.getById);
router.post('/products', upload.array('images'), productController.create);

module.exports = router;