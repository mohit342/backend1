const express = require('express');
const router = express.Router();
const db = require("../config/db");
const nodemailer = require('nodemailer');

router.post('/send-enquiry', async (req, res) => {
    const { name, email, message } = req.body;

    // Validate input
    if (!name || !email || !message) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    // Configure transporter (using Gmail example)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    try {
        // Save to database
        await db.query(
            'INSERT INTO enquiries (name, email, message) VALUES (?, ?, ?)',
            [name, email, message]
        );

        // Send email asynchronously without awaiting
        setImmediate(() => {
            transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: 'lakshitajoshi68@gmail.com',
                subject: 'New Enquiry Form Submission',
                html: `
                    <h3>New Enquiry Details:</h3>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Message:</strong> ${message}</p>
                `
            }).catch(err => console.error('Error sending email:', err));
        });

        // Respond immediately
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error processing enquiry:', error);
        res.status(500).json({ success: false, error: 'Failed to process enquiry' });
    }
});

router.get('/enquiries', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM enquiries ORDER BY created_at DESC');
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching enquiries:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch enquiries' });
    }
});

module.exports = router;