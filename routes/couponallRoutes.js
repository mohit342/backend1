const express = require('express');
const router = express.Router();
const couponallController = require('../controllers/couponallController');

// Create a new coupon (admin only)
router.post('/create', couponallController.createCoupon);
// Fetch coupons for a user
router.get('/user/:userId', couponallController.getUserCoupons);
// Fetch special coupons
router.get('/user/special', couponallController.getSpecialCoupons);
// Delete a coupon
router.delete('/:id', couponallController.deleteCoupon);

module.exports = router;