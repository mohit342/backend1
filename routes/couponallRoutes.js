const express = require('express');
const router = express.Router();
const couponallController = require('../controllers/couponallController');

// Create a new coupon (admin only)
router.post('/create', couponallController.createCoupon);
// Fetch coupons for a user
router.get('/user/:userId', couponallController.getUserCoupons);
module.exports = router;