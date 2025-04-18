const bcrypt = require('bcryptjs');
const transporter = require('../config/mailer');
const { otpStore, generateOTP } = require('../utils/otpGenerator');
const db = require('../config/db');


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
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Get user from database with all necessary information
    const [users] = await db.query(
      `SELECT 
        u.id,
        u.email,
        u.password,
        u.first_name,
        u.last_name,
        u.user_type as role,
        CASE 
          WHEN u.user_type = 'student' THEN s.school_name
          WHEN u.user_type = 'school' THEN sc.school_name
          ELSE NULL
        END as school_name,
        CASE 
          WHEN u.user_type = 'se' THEN se.employee_id
          ELSE NULL
        END as employee_id
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN schools sc ON u.id = sc.user_id
      LEFT JOIN se_employees se ON u.id = se.user_id
      WHERE u.email = ?`,
      [email]
    );

    // Check if user exists
    if (users.length === 0) {
      return res.status(401).json({
        message: 'Incorrect email or password'
      });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        message: 'Incorrect email or password'
      });
    }

    // Create user object without sensitive data
    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      seRole: user.se_role,
      schoolName: user.school_name,
      employeeId: user.employee_id
    };

    res.status(200).json({
      message: 'Login successful',
      user: userResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'An error occurred during login'
    });
  }
};

const sendResetPasswordOTP = (req, res) => {
  const { email } = req.body;
  const otp = generateOTP();
  otpStore[email] = otp;

  const mailOptions = {
    from: 'lakshitajoshi68@gmail.com',
    to: email,
    subject: 'Reset Password OTP',
    text: `Your OTP to reset your password is ${otp}. It will expire in 5 minutes.`,
  };

  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      return res.status(500).json({ message: 'Failed to send OTP' });
    }
    res.status(200).json({ message: 'OTP sent successfully!' });
  });
};
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!otpStore[email] || otpStore[email] !== parseInt(otp)) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    await db.query(
      `UPDATE users SET password = ? WHERE email = ?`,
      [hashedPassword, email]
    );

    // Remove OTP from store
    delete otpStore[email];

    res.status(200).json({ message: 'Password reset successfully!' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};


module.exports = { sendOTP, verifyOTP , login,sendResetPasswordOTP,resetPassword};