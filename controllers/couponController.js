const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { createCoupon, getCouponsBySchool,  createStudentCoupon,
} = require('../models/coupons');
const { sendCouponNotification } = require('../config/emailService');

const generateCoupon = async (req, res) => {
  console.log('Request body:', req.body);
  const {
    schoolId,
    seEmployeeId,
    discountPercentage,
    validFrom,
    validUntil,
    maxUses
  } = req.body;

  try {
    // Check for missing fields
    if (!schoolId || !seEmployeeId || !discountPercentage || !validFrom || !validUntil) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify that the school and SE exist and get their emails (single query)
    const [emailResults] = await db.promise().query(`
      SELECT 
        u1.email as school_email,
        u2.email as se_email,
        s.id as school_id,
        se.employee_id as se_employee_id
      FROM schools s
      JOIN users u1 ON s.user_id = u1.id
      JOIN se_employees se ON se.employee_id = ?
      JOIN users u2 ON se.user_id = u2.id
      WHERE s.id = ?
    `, [seEmployeeId, schoolId]);

    if (!emailResults || emailResults.length === 0) {
      return res.status(404).json({ error: 'School or SE Employee not found' });
    }

    const { school_email, se_email } = emailResults[0];

    // Generate coupon code
    const couponCode = `${schoolId.toString().padStart(4, '0')}-${uuidv4().substring(0, 6).toUpperCase()}`;
    console.log('Generated Coupon Code:', couponCode);

    // Create the coupon
    try {
      await createCoupon(
        schoolId,
        seEmployeeId,
        couponCode,
        discountPercentage,
        validFrom,
        validUntil,
        maxUses || 2
      );
    } catch (createError) {
      console.error('Error creating coupon:', createError);
      return res.status(500).json({
        error: 'Failed to create coupon in database',
        details: createError.message
      });
    }

    res.status(200).json({
      message: 'Coupon generated successfully',
      couponCode,
      recipients: {
        school_email,
        se_email
      }
    });

  } catch (error) {
    console.error('Error in coupon generation process:', error);
    res.status(500).json({
      error: 'Failed to generate coupon',
      details: error.message
    });
  }
};

const sendCouponEmail = async (req, res) => {
  console.log('Received email request:', req.body); // Add logging
  const { couponCode,
    schoolId,
    seEmployeeId,
    discountPercentage,
    validFrom,
    validUntil } = req.body;
  if (!couponCode || !schoolId || !seEmployeeId) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: 'couponCode, schoolId, and seEmployeeId are required',
      received: { couponCode, schoolId, seEmployeeId }
    });
  }

  try {
    // Get email addresses and coupon details
    const [results] = await db.promise().query(`
      SELECT 
        u1.email as school_email,
        u2.email as se_email
      FROM schools s
      JOIN users u1 ON s.user_id = u1.id
      JOIN se_employees se ON s.employee_id = se.employee_id
      JOIN users u2 ON se.user_id = u2.id
      WHERE s.id = ? 
      AND se.employee_id = ?
      LIMIT 1
    `, [schoolId, seEmployeeId]);

    if (!results || results.length === 0) {
      console.log('No results found for:', { schoolId, seEmployeeId });
      return res.status(404).json({ 
        error: 'Email addresses not found',
        details: 'Could not find matching school and SE email addresses'
      });
    }

    const couponDetails = {
      code: couponCode,
      discountPercentage,
      validFrom,
      validUntil,
      maxUses: 50
    };

    console.log('Sending email with details:', {
      schoolEmail: results[0].school_email,
      seEmail: results[0].se_email,
      couponDetails
    });

    await sendCouponNotification(
      results[0].school_email,
      results[0].se_email,
      couponDetails
    );

    res.status(200).json({ 
      message: 'Email sent successfully',
      recipients: {
        school_email: results[0].school_email,
        se_email: results[0].se_email
      }
    });

  } catch (error) {
    console.error('Error in email sending process:', error);
    res.status(500).json({ 
      error: 'Failed to process email request',
      details: error.message 
    });
  }
};

const getSchoolCoupons = async (req, res) => {
  const { schoolId } = req.params;

  try {
    const [coupons] = await getCouponsBySchool(schoolId);
    res.status(200).json(coupons);
  } catch (error) {
    console.error('Error fetching school coupons:', error);
    res.status(500).json({
      error: 'Failed to fetch coupons',
      details: error.message
    });
  }
};

const validateCoupon = async (req, res) => {
  const { code } = req.body;

  try {
    // Get current date for validation
    const currentDate = new Date();

    // Query to check coupon validity
    const [coupon] = await db.promise().query(`
      SELECT 
        c.*,
        s.school_name,
        s.id as school_id
      FROM coupons c
      JOIN schools s ON c.school_id = s.id
      WHERE c.code = ?
      AND c.valid_from <= ?
      AND c.valid_until >= ?
      AND c.current_uses < c.max_uses
    `, [code, currentDate, currentDate]);

    if (!coupon || coupon.length === 0) {
      return res.status(404).json({
        error: 'Invalid coupon or coupon expired'
      });
    }

    // Return coupon details
    res.status(200).json({
      valid: true,
      discount: coupon[0].discount_percentage,
      school_id: coupon[0].school_id,
      school_name: coupon[0].school_name
    });

  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({
      error: 'Failed to validate coupon',
      details: error.message
    });
  }
};


// Add to couponController.js

const generateStudentCoupon = async (req, res) => {
  console.log('Request body for student coupon:', req.body);
  const {
    schoolId,
    discountPercentage,
    validFrom,
    validUntil,
    maxUses
  } = req.body;

  try {
    // Check for missing fields
    if (!schoolId || !discountPercentage || !validFrom || !validUntil) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify that the school exists and get email
    const [schoolResults] = await db.promise().query(`
      SELECT 
        u.email as school_email,
        s.school_name
      FROM schools s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [schoolId]);

    if (!schoolResults || schoolResults.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const { school_email, school_name } = schoolResults[0];

    // Generate coupon code with school prefix
    const couponCode = `STU-${schoolId.toString().padStart(4, '0')}-${uuidv4().substring(0, 6).toUpperCase()}`;
    console.log('Generated Student Coupon Code:', couponCode);

    // Create the coupon
    try {
      await createStudentCoupon(
        schoolId,
        couponCode,
        discountPercentage,
        validFrom,
        validUntil,
        maxUses || 100 // Higher max uses for student coupons
      );
    } catch (createError) {
      console.error('Error creating student coupon:', createError);
      return res.status(500).json({
        error: 'Failed to create student coupon in database',
        details: createError.message
      });
    }

    // Get student count for the school
    const [studentResults] = await db.promise().query(`
      SELECT COUNT(*) as student_count
      FROM students s
      WHERE s.school_id = ?
    `, [schoolId]);

    const studentCount = studentResults[0]?.student_count || 0;

    res.status(200).json({
      message: 'Student coupon generated successfully',
      couponCode,
      schoolEmail: school_email,
      schoolName: school_name,
      studentCount,
    });

  } catch (error) {
    console.error('Error in student coupon generation process:', error);
    res.status(500).json({
      error: 'Failed to generate student coupon',
      details: error.message
    });
  }
};

const sendStudentCouponEmail = async (req, res) => {
  console.log('Received student coupon email request:', req.body);
  const { 
    couponCode,
    schoolId,
    discountPercentage,
    validFrom,
    validUntil 
  } = req.body;
  
  if (!couponCode || !schoolId) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: 'couponCode and schoolId are required',
      received: { couponCode, schoolId }
    });
  }

  try {
    // Get school email and student emails
    const [schoolResults] = await db.promise().query(`
      SELECT u.email as school_email, s.school_name
      FROM schools s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
      LIMIT 1
    `, [schoolId]);

    if (!schoolResults || schoolResults.length === 0) {
      return res.status(404).json({ 
        error: 'School email not found',
        details: 'Could not find matching school'
      });
    }

    // Get student emails
    const [studentResults] = await db.promise().query(`
      SELECT u.email
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.school_id = ?
    `, [schoolId]);

    const studentEmails = studentResults.map(s => s.email);

    const couponDetails = {
      code: couponCode,
      discountPercentage,
      validFrom,
      validUntil,
      schoolName: schoolResults[0].school_name
    };

    // Assuming you have a function to send emails to multiple recipients
    await sendStudentCouponNotification(
      schoolResults[0].school_email,
      studentEmails,
      couponDetails
    );

    res.status(200).json({ 
      message: 'Student coupon emails sent successfully',
      recipients: {
        school_email: schoolResults[0].school_email,
        student_count: studentEmails.length
      }
    });

  } catch (error) {
    console.error('Error in student coupon email sending process:', error);
    res.status(500).json({ 
      error: 'Failed to process student coupon email request',
      details: error.message 
    });
  }
};

// Add these to module.exports
module.exports = {
  generateCoupon,
  getSchoolCoupons,
  sendCouponEmail,
  validateCoupon,
  generateStudentCoupon,
  sendStudentCouponEmail
};


