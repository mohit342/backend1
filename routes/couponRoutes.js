const express = require('express');
const router = express.Router();
const { generateCoupon, sendCouponEmail, validateCoupon ,generateStudentCoupon,sendStudentCouponEmail, getSchoolsWithCouponStatus, getTotalSchools, getSEGeneratedCoupons, getUserCoupons } = require('../controllers/couponController');

router.post('/coupons', generateCoupon);  // This should match the frontend request

router.post('/coupons/send-email', sendCouponEmail);
// In couponRoutes.js, add:
router.post('/validate-coupon', validateCoupon);
router.post('/coupons/students', generateStudentCoupon);
router.post('/coupons/students/send-email', sendStudentCouponEmail);
router.get('/schools-with-coupons', getSchoolsWithCouponStatus);
router.get('/total-schools', getTotalSchools);
router.get('/se-generated-coupons', getSEGeneratedCoupons);
router.get('/coupons/user/:userId', getUserCoupons);
router.post('/coupons/validate', validateCoupon);
module.exports = router;