
const express = require('express');
const router = express.Router();
const { generateCoupon, getSchoolCoupons,sendCouponEmail, validateCoupon } = require('../controllers/couponController');

router.post('/coupons', generateCoupon);  // This should match the frontend request
router.get('/coupons/school/:schoolId', getSchoolCoupons);
router.post('/coupons/send-email', sendCouponEmail);
// In couponRoutes.js, add:
router.post('/coupons/validate', validateCoupon);

module.exports = router;
