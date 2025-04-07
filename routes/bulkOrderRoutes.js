const express = require('express');
const router = express.Router();
const BulkOrderController = require('../controllers/BulkOrderController');

router.post('/submit', BulkOrderController.submitOrder);
router.get('/all', BulkOrderController.getAllOrders);
module.exports = router;