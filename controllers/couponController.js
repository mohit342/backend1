const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { createCoupon, getCouponsBySchool, createStudentCoupon, getStudentsBySchool } = require('../models/coupons');
const { sendCouponNotification } = require('../config/emailService');



const generateCoupon = async (req, res) => {
  console.log("Received request to generate coupon:", req.body);

  const { schoolId, seEmployeeId } = req.body;

  if (!schoolId || !seEmployeeId) {
    console.error("Missing required fields:", { schoolId, seEmployeeId });
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // ✅ Check if a coupon already exists for this school
    const [existingCoupons] = await db.query(
      `SELECT * FROM coupons WHERE school_id = ?`,
      [schoolId]
    );

    if (existingCoupons.length > 0) {
      return res.status(400).json({
        error: "A coupon has already been generated for this school",
        existingCoupon: existingCoupons[0],
      });
    }

    // ✅ Generate Unique Coupon Codes
    const schoolCouponCode = "SCHOOL-" + Math.random().toString(36).substr(2, 8).toUpperCase();
    const studentCouponCode = "STU-" + Math.random().toString(36).substr(2, 8).toUpperCase();

    const currentDate = new Date();
    const oneYearLater = new Date();
    oneYearLater.setFullYear(currentDate.getFullYear() + 1);

    const validFrom = currentDate.toISOString().slice(0, 19).replace("T", " ");
    const validUntil = oneYearLater.toISOString().slice(0, 19).replace("T", " ");

    // ✅ LOGGING INSERT QUERIES
    console.log("Inserting School Coupon:", schoolCouponCode);
    console.log("Inserting Student Coupon:", studentCouponCode);

    // ✅ INSERT School Coupon (FIXED VARIABLE NAMES)
    await db.query(
      `INSERT INTO coupons (school_id, se_employee_id, code, discount_percentage, valid_from, valid_until, max_uses, current_uses) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [schoolId, seEmployeeId, schoolCouponCode, 10, validFrom, validUntil, 1]
    );

    // ✅ INSERT Student Coupon
    await db.query(
      `INSERT INTO student_coupons (school_id, code, discount_percentage, valid_from, valid_until, max_uses, current_uses) 
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [schoolId, studentCouponCode, 15, validFrom, validUntil, 500]
    );

    res.status(201).json({
      schoolCouponCode,  // ✅ Fixed Variable
      studentCouponCode, // ✅ Fixed Variable
      message: "School and Student Coupons Generated Successfully",
    });

  } catch (error) {
    console.error("Error generating coupons:", error);
    res.status(500).json({ error: "Failed to generate coupons" });
  }
};

const sendCouponEmail = async (req, res) => {
  console.log('Received email request:', req.body);
  const {
    couponCode,
    studentCouponCode,
    schoolId,
    seEmployeeId,
    discountPercentage,
    validFrom,
    validUntil
  } = req.body;

  if (!couponCode || !schoolId || !seEmployeeId || !studentCouponCode) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: 'couponCode, studentCouponCode, schoolId, and seEmployeeId are required',
      received: { couponCode, studentCouponCode, schoolId, seEmployeeId }
    });
  }

  try {
    // Get email addresses and coupon details
    const [results] = await db.query(`
      SELECT 
        u1.email as school_email,
        u2.email as se_email,
        s.school_name
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

    // Get student emails
    const [studentResults] = await db.query(`
      SELECT u.email
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.school_id = ?
    `, [schoolId]);

    const studentEmails = studentResults.map(s => s.email);

    const couponDetails = {
      schoolCode: couponCode,
      studentCode: studentCouponCode,
      schoolDiscountPercentage: discountPercentage,
      studentDiscountPercentage: 15, // Student discount percentage
      validFrom,
      validUntil,
      schoolName: results[0].school_name,
      maxSchoolUses: 1,
      maxStudentUses: 500
    };

    // Modify this to match your actual email service function
    await sendCouponNotification(
      results[0].school_email,
      results[0].se_email,
      studentEmails,
      couponDetails
    );

    res.status(200).json({
      message: 'Emails sent successfully',
      recipients: {
        school_email: results[0].school_email,
        se_email: results[0].se_email,
        student_count: studentEmails.length
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
    // Get school coupons
    const [schoolCoupons] = await db.query(`
      SELECT 
        c.*,
        s.school_name,
        CONCAT(u.first_name, ' ', u.last_name) as se_name,
        'school' as coupon_type
      FROM coupons c
      JOIN schools s ON c.school_id = s.id
      JOIN se_employees se ON c.se_employee_id = se.employee_id
      JOIN users u ON se.user_id = u.id
      WHERE c.school_id = ?
    `, [schoolId]);

    // Get student coupons
    const [studentCoupons] = await db.query(`
      SELECT 
        sc.*,
        s.school_name,
        'student' as coupon_type
      FROM student_coupons sc
      JOIN schools s ON sc.school_id = s.id
      WHERE sc.school_id = ?
    `, [schoolId]);

    // Combine both types of coupons
    const allCoupons = [...schoolCoupons, ...studentCoupons];

    res.status(200).json(allCoupons);
  } catch (error) {
    console.error('Error fetching school coupons:', error);
    res.status(500).json({
      error: 'Failed to fetch coupons',
      details: error.message
    });
  }
};

const validateCoupon = async (req, res) => {
  console.log("Received coupon validation request:", req.body);

  const { code, userId, userType } = req.body;

  if (!code || !userId || !userType) {
    console.error("Missing required fields:", { code, userId, userType });
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    console.log("Validating coupon for:", { code, userId, userType });

    let couponQuery, params;

    if (userType === 'school') {
      console.log("Checking school coupon...");
      const [school] = await db.query(
        "SELECT id FROM schools WHERE user_id = ?",
        [userId]
      );

      if (school.length === 0) {
        console.error("No school found for this user.");
        return res.status(403).json({ error: "School not found for this user" });
      }

      couponQuery = `
              SELECT * FROM coupons 
              WHERE code = ? AND school_id = ? 
              AND valid_from <= NOW() AND valid_until >= NOW() 
              AND current_uses < max_uses
          `;
      params = [code, school[0].id];

    } else if (userType === 'student') {
      console.log("Checking student coupon...");
      const [student] = await db.query(
        "SELECT school_id FROM students WHERE user_id = ?",
        [userId]
      );

      if (student.length === 0) {
        console.error("No student profile found.");
        return res.status(403).json({ error: "Student profile not found" });
      }

      // 🔹 FIX: Use `school_id` instead of `school_name`
      couponQuery = `
              SELECT * FROM student_coupons 
              WHERE code = ? AND school_id = ? 
              AND valid_from <= NOW() AND valid_until >= NOW() 
              AND current_uses < max_uses
          `;
      params = [code, student[0].school_id]; // Use school_id

    } else {
      console.log("Checking generic coupon...");
      couponQuery = `
              SELECT * FROM generic_coupons 
              WHERE code = ? 
              AND valid_from <= NOW() AND valid_until >= NOW() 
              AND current_uses < max_uses
          `;
      params = [code];
    }

    console.log("Executing query:", couponQuery, params);
    const [couponResult] = await db.query(couponQuery, params);

    if (couponResult.length === 0) {
      console.error("No matching coupon found.");
      return res.status(400).json({ error: "Invalid or expired coupon" });
    }

    console.log("Coupon found:", couponResult[0]);
    res.json({
      discount_percentage: couponResult[0].discount_percentage,
      message: "Coupon applied successfully"
    });

  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({ error: "Failed to validate coupon" });
  }
};






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
        maxUses || 500 // Higher max uses for student coupons
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

const getAllCoupons = async (req, res) => {
  try {
    const [schoolCoupons] = await db.query(`
      SELECT 
        c.id AS coupon_id,
        c.se_employee_id,
        CONCAT(u.first_name, ' ', u.last_name) as se_name,
        s.school_name,
        c.code AS school_coupon_code,
        sc.code AS student_coupon_code,
        c.discount_percentage,
        c.valid_from,
        c.valid_until,
        c.generation_date,
        c.current_uses,
        c.max_uses
      FROM coupons c
      JOIN schools s ON c.school_id = s.id
      JOIN se_employees se ON c.se_employee_id = se.employee_id
      JOIN users u ON se.user_id = u.id
      LEFT JOIN student_coupons sc ON sc.school_id = c.school_id
    `);

    res.status(200).json(schoolCoupons);
  } catch (error) {
    console.error("Error fetching all coupons:", error);
    res.status(500).json({ error: "Failed to fetch all coupons" });
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
  getAllCoupons
};