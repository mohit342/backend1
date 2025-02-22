const express = require('express');
const router = express.Router();
const CheckoutController = require('../controllers/CheckoutController');

router.get('/cart', CheckoutController.getCartItems);
// router.post('/checkout', CheckoutController.processCheckout);
router.post("/validate-coupon", CheckoutController.validateCoupon);
router.post('/orders', CheckoutController.processCheckout);


module.exports = router;