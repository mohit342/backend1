const bcrypt = require('bcryptjs');
const transporter = require('../config/mailer');
const { otpStore, generateOTP } = require('../utils/otpGenerator');

const sendOTP = (req, res) => {
  const { email } = req.body;
  const otp = generateOTP();
  otpStore[email] = otp;

  const mailOptions = {
    from: 'lakshitajoshi68@gmail.com',
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
  };

  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      return res.status(500).json({ message: 'Failed to send OTP' });
    }
    res.status(200).json({ message: 'OTP sent successfully!' });
  });
};

const verifyOTP = (req, res) => {
  const { email, otp } = req.body;

  if (otpStore[email] && otpStore[email] === parseInt(otp)) {
    delete otpStore[email]; // Remove OTP after successful verification
    res.status(200).json({ message: 'OTP verified successfully!' });
  } else {
    res.status(400).json({ message: 'Invalid or expired OTP' });
  }
};

module.exports = { sendOTP, verifyOTP };