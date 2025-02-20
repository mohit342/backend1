const otpStore = {}; // Temporary store for OTPs

const generateOTP = () => Math.floor(100000 + Math.random() * 900000); // 6-digit OTP

module.exports = { otpStore, generateOTP };