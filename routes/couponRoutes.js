
const express = require('express');
const router = express.Router();
const { generateCoupon, getSchoolCoupons,sendCouponEmail, validateCoupon ,generateStudentCoupon,sendStudentCouponEmail, getAllCoupons} = require('../controllers/couponController');

router.post('/coupons', generateCoupon);  // This should match the frontend request
router.get('/coupons/school/:schoolId', getSchoolCoupons);
router.post('/coupons/send-email', sendCouponEmail);
// In couponRoutes.js, add:
router.post('/coupons/validate', validateCoupon);
router.post('/coupons/students', generateStudentCoupon);
router.post('/coupons/students/send-email', sendStudentCouponEmail);
router.get('/coupons/all', getAllCoupons);

module.exports = router;
