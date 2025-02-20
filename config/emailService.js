const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false // Allows self-signed certificates in development
    }
  });
  
  const sendCouponNotification = async (schoolEmail, seEmail, couponDetails) => {
    const emailTemplate = `
      <h2>New Coupon Generated</h2>
      <p>A new discount coupon has been generated with the following details:</p>
      <ul>
        <li><strong>Coupon Code:</strong> ${couponDetails.code}</li>
        <li><strong>Discount:</strong> ${couponDetails.discountPercentage}%</li>
        <li><strong>Valid From:</strong> ${new Date(couponDetails.validFrom).toLocaleDateString()}</li>
        <li><strong>Valid Until:</strong> ${new Date(couponDetails.validUntil).toLocaleDateString()}</li>
        <li><strong>Maximum Uses:</strong> ${couponDetails.maxUses}</li>
      </ul>
    `;
  
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: [schoolEmail, seEmail].join(','),
      subject: 'New Discount Coupon Generated',
      html: emailTemplate
    };
  
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.response);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  };
  
  module.exports = { sendCouponNotification };