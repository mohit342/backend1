const express = require('express');
const { sendOTP, verifyOTP, login,sendResetPasswordOTP, resetPassword  } = require('../controllers/authController');


const router = express.Router();

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/login', login);
router.post('/forgot-password', sendResetPasswordOTP);
router.post('/reset-password', resetPassword);


module.exports = router;