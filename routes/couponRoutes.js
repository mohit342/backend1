const express = require('express');
const router = express.Router();
const { generateCoupon, getSchoolCoupons,sendCouponEmail, validateCoupon ,generateStudentCoupon,sendStudentCouponEmail, getSchoolsWithCouponStatus, getTotalSchools, getSEGeneratedCoupons } = require('../controllers/couponController');

router.post('/coupons', generateCoupon);  // This should match the frontend request
router.get('/coupons/school/:schoolId', getSchoolCoupons);
router.post('/coupons/send-email', sendCouponEmail);
// In couponRoutes.js, add:
router.post('/validate-coupon', validateCoupon);
router.post('/coupons/students', generateStudentCoupon);
router.post('/coupons/students/send-email', sendStudentCouponEmail);
router.get('/schools-with-coupons', getSchoolsWithCouponStatus);
router.get('/total-schools', getTotalSchools);
router.get('/se-generated-coupons', getSEGeneratedCoupons);


module.exports = router;