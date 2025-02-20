const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
     user: 'lakshitajoshi68@gmail.com',
    pass: 'ssnf xncb gfiu jzsw'
  },
});

module.exports = transporter;