const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { createCoupon, getCouponsBySchool,  createStudentCoupon,
} = require('../models/coupons');
const { sendCouponNotification } = require('../config/emailService');

const generateCoupon = async (req, res) => {
  console.log('Request body:', req.body);
  const { schoolId, seEmployeeId, discountPercentage, validFrom, validUntil, maxUses } = req.body;

  try {
      if (!schoolId || !seEmployeeId || !discountPercentage || !validFrom || !validUntil) {
          return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if a coupon already exists for the school
      const [existingCoupons] = await db.query(
          `SELECT id FROM coupons WHERE school_id = ? LIMIT 1`, 
          [schoolId]
      );

      if (existingCoupons.length > 0) {
          return res.status(400).json({ error: 'Coupon already generated for this school' });
      }

      // Generate a new coupon code
      const couponCode = `${schoolId.toString().padStart(4, '0')}-${uuidv4().substring(0, 6).toUpperCase()}`;
      console.log('Generated School Coupon Code:', couponCode);

      // Insert the school coupon into the database
      await createCoupon(schoolId, seEmployeeId, couponCode, discountPercentage, validFrom, validUntil, maxUses || 2);

      // Generate a student coupon code
      const studentCouponCode = `STU-${schoolId.toString().padStart(4, '0')}-${uuidv4().substring(0, 6).toUpperCase()}`;
      console.log('Generated Student Coupon Code:', studentCouponCode);

      // Insert the student coupon into the database
      await createStudentCoupon(schoolId, studentCouponCode, discountPercentage, validFrom, validUntil, maxUses || 100);

      res.status(200).json({
          message: 'School and Student coupons generated successfully',
          schoolCouponCode: couponCode,
          studentCouponCode: studentCouponCode
      });

  } catch (error) {
      console.error('Error in coupon generation process:', error);
      res.status(500).json({
          error: 'Failed to generate coupons',
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
    const [results] = await db.query(`
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
  const { code, userId } = req.body; // Get coupon code and logged-in user ID

  try {
      const [coupon] = await db.query(`
          SELECT 
              c.*, s.school_name, s.user_id as school_user_id
          FROM coupons c
          JOIN schools s ON c.school_id = s.id
          WHERE c.code = ? AND s.user_id = ?
          AND c.valid_from <= NOW() 
          AND c.valid_until >= NOW()
          AND c.current_uses < c.max_uses
      `, [code, userId]);

      if (!coupon.length) {
          return res.status(404).json({ error: 'Invalid or unauthorized coupon' });
      }

      res.status(200).json({
          valid: true,
          discount_percentage: coupon[0].discount_percentage,
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
    const [schoolResults] = await db.query(`
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
    const [studentResults] = await db.query(`
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
    const [schoolResults] = await db.query(`
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
    const [studentResults] = await db.query(`
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

const getSchoolsWithCouponStatus = async (req, res) => {
  try {
      const [results] = await db.query(`
          SELECT s.id, s.school_name,
                 CASE 
                     WHEN c.id IS NOT NULL THEN true
                     ELSE false 
                 END AS has_coupon
          FROM schools s
          LEFT JOIN coupons c ON s.id = c.school_id
      `);
      res.status(200).json(results);
  } catch (error) {
      console.error('Error fetching schools with coupon status:', error);
      res.status(500).json({ error: 'Failed to fetch schools' });
  }
};


const getTotalSchools = async (req, res) => {
  try {
      const [results] = await db.query(`
          SELECT 
              s.id AS school_id,
              s.school_name,
              se.employee_id AS se_id,
              c.code AS school_coupon_code,
              sc.code AS student_coupon_code,
              c.created_at AS generation_date
          FROM schools s
          LEFT JOIN se_employees se ON s.employee_id = se.employee_id
          LEFT JOIN coupons c ON s.id = c.school_id
          LEFT JOIN student_coupons sc ON s.id = sc.school_id
          ORDER BY c.created_at DESC
      `);

      res.status(200).json(results);
  } catch (error) {
      console.error('Error fetching total schools:', error);
      res.status(500).json({ error: 'Failed to fetch school data' });
  }
};

const getSEGeneratedCoupons = async (req, res) => {
  try {
      const [results] = await db.query(`
          SELECT 
              se.employee_id AS se_id,
              s.school_name,
              c.code AS school_coupon_code,
              sc.code AS student_coupon_code,
              c.created_at AS generation_date,
              c.max_uses
          FROM coupons c
          JOIN schools s ON c.school_id = s.id
          JOIN se_employees se ON c.se_employee_id = se.employee_id
          LEFT JOIN student_coupons sc ON c.school_id = sc.school_id
          ORDER BY c.created_at DESC
      `);

      res.status(200).json(results);
  } catch (error) {
      console.error('Error fetching SE generated coupons:', error);
      res.status(500).json({ error: 'Failed to fetch data' });
  }
};




// Add these to module.exports
module.exports = {
  generateCoupon,
  getSchoolCoupons,
  sendCouponEmail,
  validateCoupon,
  generateStudentCoupon,
  sendStudentCouponEmail,
  getSchoolsWithCouponStatus,
  getTotalSchools,
  getSEGeneratedCoupons
};