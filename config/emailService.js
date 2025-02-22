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

  // Add to emailService.js

const sendStudentCouponNotification = async (schoolEmail, studentEmails, couponDetails) => {
  try {
    // Send email to school (confirmation)
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: schoolEmail,
      subject: 'Student Coupon Generated Successfully',
      html: `
        <h2>Student Coupon Generated</h2>
        <p>You have successfully created a coupon for all students at ${couponDetails.schoolName}.</p>
        <p><strong>Coupon Code:</strong> ${couponDetails.code}</p>
        <p><strong>Discount:</strong> ${couponDetails.discountPercentage}%</p>
        <p><strong>Valid From:</strong> ${new Date(couponDetails.validFrom).toLocaleDateString()}</p>
        <p><strong>Valid Until:</strong> ${new Date(couponDetails.validUntil).toLocaleDateString()}</p>
        <p><strong>Total Recipients:</strong> ${studentEmails.length} students</p>
        <p>The coupon has been sent to all your registered students.</p>
      `
    });

    // Send emails to students (batch process for large lists)
    const batchSize = 50;
    for (let i = 0; i < studentEmails.length; i += batchSize) {
      const batch = studentEmails.slice(i, i + batchSize);
      
      // Use BCC for student privacy
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        bcc: batch,
        subject: `Special Discount from ${couponDetails.schoolName}`,
        html: `
          <h2>Special Student Discount</h2>
          <p>Your school, ${couponDetails.schoolName}, has created a special discount coupon for you!</p>
          <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
            <h3 style="color: #4a4a4a; margin-bottom: 10px;">Your Coupon Code</h3>
            <p style="font-size: 24px; font-weight: bold; color: #007bff; letter-spacing: 1px;">${couponDetails.code}</p>
            <p style="margin-top: 10px;"><strong>Discount:</strong> ${couponDetails.discountPercentage}% off</p>
          </div>
          <p><strong>Valid From:</strong> ${new Date(couponDetails.validFrom).toLocaleDateString()}</p>
          <p><strong>Valid Until:</strong> ${new Date(couponDetails.validUntil).toLocaleDateString()}</p>
          <p>Use this code during checkout to receive your discount!</p>
        `
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error sending student coupon emails:', error);
    throw error;
  }
};
  
  module.exports = { sendCouponNotification,sendStudentCouponNotification };