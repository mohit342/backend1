const express = require('express');
const router = express.Router();
const CheckoutController = require('../controllers/CheckoutController');
const couponController=require('../controllers/couponController');

router.get('/cart', CheckoutController.getCartItems);
// router.post('/checkout', CheckoutController.processCheckout);

router.post('/orders', CheckoutController.processCheckout);
router.post("/validate-coupon", couponController.validateCoupon);

module.exports = router;