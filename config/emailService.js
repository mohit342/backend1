// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST || 'smtp.gmail.com',
//     port: process.env.SMTP_PORT || 587,
//     secure: false, // true for 465, false for other ports
//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS
//     },
//     tls: {
//       rejectUnauthorized: false // Allows self-signed certificates in development
//     }
//   });
  
//   const sendCouponNotification = async (schoolEmail, seEmail, couponDetails) => {
//     try {
//       await transporter.sendMail({
//         from: '"Coupon System" <noreply@example.com>',
//         to: schoolEmail,
//         cc: seEmail,
//         subject: 'Your School Coupons',
//         html: `
//           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
//             <h2 style="color: #333;">Your School Coupons</h2>
//             <p>Dear School Administrator,</p>
//             <p>Your school has been assigned two coupon codes:</p>
            
//             <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
//               <h3 style="margin-top: 0; color: #0056b3;">School Coupon (For School Use)</h3>
//               <p style="font-size: 18px; font-weight: bold;">${couponDetails.schoolCode}</p>
//               <p>Discount: ${couponDetails.schoolDiscountPercentage}% off</p>
//               <p>Valid until: ${new Date(couponDetails.validUntil).toLocaleDateString()}</p>
//               <p>Max uses: 1</p>
//             </div>
        
//       });  
      

//       await transporter.sendMail(mailOptions);
//       console.log('Coupon email sent successfully!');
//     } catch (error) {
//       console.error('Error sending email:', error);
//     }
// };
  
//   module.exports = { sendCouponNotification };


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

const sendCouponNotification = async (schoolEmail, seEmail, studentEmails, couponDetails) => {
    try {
        // Send email to school
        await transporter.sendMail({
            from: 'lakshitajoshi68@gmail.com',
            to: schoolEmail,
            cc: seEmail,
            subject: 'Your School Coupons',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                    <h2 style="color: #333;">Your School Coupons</h2>
                    <p>Dear School Administrator,</p>
                    <p>Your school has been assigned two coupon codes:</p>
                    
                    <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3 style="margin-top: 0; color: #0056b3;">School Coupon (For School Use)</h3>
                        <p style="font-size: 18px; font-weight: bold;">${couponDetails.schoolCode}</p>
                        <p>Discount: ${couponDetails.schoolDiscountPercentage}% off</p>
                        <p>Valid until: ${new Date(couponDetails.validUntil).toLocaleDateString()}</p>
                        <p>Max uses: 1</p>
                    </div>
                </div>
            `
        });

        console.log('School coupon email sent successfully!');

        // Send emails to students
        for (const studentEmail of studentEmails) {
            await transporter.sendMail({
                from: '"Coupon System" <noreply@example.com>',
                to: studentEmail,
                subject: 'Your Student Discount Coupon',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                        <h2 style="color: #333;">Your Student Discount Coupon</h2>
                        <p>Dear Student,</p>
                        <p>You have received an exclusive discount coupon!</p>
                        
                        <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <h3 style="margin-top: 0; color: #0056b3;">Student Coupon</h3>
                            <p style="font-size: 18px; font-weight: bold;">${couponDetails.studentCode}</p>
                            <p>Discount: ${couponDetails.studentDiscountPercentage}% off</p>
                            <p>Valid until: ${new Date(couponDetails.validUntil).toLocaleDateString()}</p>
                            <p>Max uses: 1 per student</p>
                        </div>
                    </div>
                `
            });

            console.log(`Coupon email sent to student: ${studentEmail}`);
        }
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

module.exports = { sendCouponNotification };