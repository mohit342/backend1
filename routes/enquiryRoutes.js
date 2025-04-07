const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

router.post('/send-enquiry', async (req, res) => {
    const { name, email, message } = req.body;

    // Configure transporter (using Gmail example)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    // Email content
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'lakshitajoshi68@gmail.com',
        subject: 'New Enquiry Form Submission',
        html: `
            <h3>New Enquiry Details:</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong> ${message}</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Failed to send enquiry' });
    }
});

module.exports = router;