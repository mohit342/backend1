const express = require('express');
const router = express.Router();
const { applyCoupon, validateCoupon } = require('../controllers/couponApplicationController');

router.post('/apply-coupon', applyCoupon);
// router.get('/validate-coupon/:code', validateCoupon);

module.exports = router;