const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { createCoupon, getCouponsBySchool, createStudentCoupon } = require('../models/coupons');
const { sendCouponNotification } = require('../config/emailService');

const generateCoupon = async (req, res) => {
  const { schoolId, seEmployeeId, discountPercentage, validFrom, validUntil, maxUses } = req.body;

  try {
    if (!schoolId || !seEmployeeId || !discountPercentage || !validFrom || !validUntil) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [schoolCheck] = await db.query(
      `SELECT id FROM schools WHERE id = ? AND employee_id = ?`,
      [schoolId, seEmployeeId]
    );
    if (schoolCheck.length === 0) {
      return res.status(403).json({ error: 'You are not authorized to generate coupons for this school' });
    }

    // Check for active coupons (valid and not expired)
    const [existingCoupons] = await db.query(
      `SELECT id FROM coupons 
       WHERE school_id = ? 
       AND valid_from <= NOW() 
       AND valid_until >= NOW() 
       AND COALESCE(current_uses, 0) < max_uses`,
      [schoolId]
    );
    if (existingCoupons.length > 0) {
      return res.status(400).json({ error: 'An active coupon already exists for this school' });
    }

    const [schoolData] = await db.query(
      `SELECT user_id FROM schools WHERE id = ? LIMIT 1`,
      [schoolId]
    );
    if (!schoolData || schoolData.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const userId = schoolData[0].user_id;
    const couponCode = `SE-${schoolId.toString().padStart(4, '0')}-${uuidv4().substring(0, 6).toUpperCase()}`;
    console.log('Generating school coupon:', { schoolId, couponCode, seEmployeeId });
    await createCoupon(schoolId, seEmployeeId, couponCode, discountPercentage, validFrom, validUntil, maxUses || 999999, userId);

    const studentCouponCode = `STU-${schoolId.toString().padStart(4, '0')}-${uuidv4().substring(0, 6).toUpperCase()}`;
    console.log('Generating student coupon:', { schoolId, studentCouponCode });
    await createStudentCoupon(schoolId, studentCouponCode, discountPercentage, validFrom, validUntil, maxUses || 999999, userId);

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
  console.log('Received email request:', req.body);
  const { couponCode, schoolId, seEmployeeId, discountPercentage, validFrom, validUntil } = req.body;
  if (!couponCode || !schoolId || !seEmployeeId) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: 'couponCode, schoolId, and seEmployeeId are required',
      received: { couponCode, schoolId, seEmployeeId }
    });
  }

  try {
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
      maxUses: 5000
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

const validateCoupon = async (req, res) => {
  const { code, userId, userType } = req.body;

  try {
    if (!code || !userId || !userType) {
      return res.status(400).json({ error: "Missing required fields: code, userId, and userType are required" });
    }

    console.log("Validating coupon:", { code, userId, userType });

    let couponRows;

    if (userType === "school") {
      const query = `
        SELECT c.*, s.school_name, COALESCE(c.current_uses, 0) as current_uses
        FROM coupons c
        JOIN schools s ON c.school_id = s.id
        WHERE c.code = ? AND c.user_id = ?
        AND c.valid_from <= NOW() 
        AND c.valid_until >= NOW()
      `;
      [couponRows] = await db.query(query, [code, userId]);
      console.log("School coupon query result:", couponRows);
    } else if (userType === "student") {
      const query = `
        SELECT sc.*, s.school_name, COALESCE(sc.current_uses, 0) as current_uses
        FROM student_coupons sc
        JOIN schools s ON sc.school_id = s.id
        JOIN students st ON st.school_id = s.id
        WHERE sc.code = ? 
        AND st.user_id = ?
        AND sc.valid_from <= NOW() 
        AND sc.valid_until >= NOW()
      `;
      [couponRows] = await db.query(query, [code, userId]);
      console.log("Student coupon query result:", couponRows);
    } else {
      return res.status(400).json({ error: "Invalid user type" });
    }

    if (!couponRows || couponRows.length === 0) {
      const query = `
        SELECT *, 'Universal' as school_name, COALESCE(current_uses, 0) as current_uses
        FROM couponsall
        WHERE code = ? 
        AND valid_from <= NOW() 
        AND valid_until >= NOW()
        AND COALESCE(current_uses, 0) < max_uses
      `;
      [couponRows] = await db.query(query, [code]);
      console.log("Couponsall query result:", couponRows);
    }

    if (!couponRows || couponRows.length === 0) {
      console.log("No valid coupon found for code:", code);
      return res.status(404).json({ 
        error: "Invalid coupon or unauthorized access", 
        details: "Coupon not found or not applicable for this user" 
      });
    }

    const coupon = couponRows[0];

    if (coupon.current_uses >= coupon.max_uses) {
      console.log("Coupon usage limit reached:", coupon);
      return res.status(400).json({ error: "Coupon usage limit reached" });
    }

    console.log("Coupon validated successfully:", coupon);

    res.status(200).json({
      valid: true,
      discount_percentage: coupon.discount_percentage,
      school_name: coupon.school_name || "Unknown School",
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({
      error: "Failed to validate coupon",
      details: error.message,
    });
  }
};

const generateStudentCoupon = async (req, res) => {
  console.log('Request body for student coupon:', req.body);
  const { schoolId, discountPercentage, validFrom, validUntil, maxUses } = req.body;

  try {
    if (!schoolId || !discountPercentage || !validFrom || !validUntil) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [schoolResults] = await db.query(`
      SELECT 
        u.email as school_email,
        s.school_name,
        s.user_id
      FROM schools s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [schoolId]);

    if (!schoolResults || schoolResults.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const { school_email, school_name, user_id } = schoolResults[0];

    const couponCode = `STU-${schoolId.toString().padStart(4, '0')}-${uuidv4().substring(0, 6).toUpperCase()}`;
    console.log('Generated Student Coupon Code:', couponCode);

    await createStudentCoupon(
      schoolId,
      couponCode,
      discountPercentage,
      validFrom,
      validUntil,
      maxUses || 5000,
      user_id
    );

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
    const seEmployeeId = req.query.seEmployeeId;
    if (!seEmployeeId) {
      return res.status(400).json({ error: 'SE employee ID is required' });
    }

    const [results] = await db.query(`
      SELECT s.id, s.school_name,
             CASE 
                 WHEN c.id IS NOT NULL THEN true
                 ELSE false 
             END AS has_coupon
      FROM schools s
      LEFT JOIN coupons c ON s.id = c.school_id
      WHERE s.employee_id = ?
    `, [seEmployeeId]);

    console.log('Schools with coupon status for SE:', seEmployeeId, results);
    res.status(200).json(results || []);
  } catch (error) {
    console.error('Error fetching schools with coupon status:', error);
    res.status(500).json({ error: 'Failed to fetch schools: ' + error.message });
  }
};

const getTotalSchools = async (req, res) => {
  try {
    const seEmployeeId = req.query.seEmployeeId;
    if (!seEmployeeId) {
      return res.status(400).json({ error: 'SE employee ID is required' });
    }

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
      WHERE s.employee_id = ?
      ORDER BY c.created_at DESC
    `, [seEmployeeId]);

    console.log('Total schools for SE:', seEmployeeId, results);
    res.status(200).json(results || []);
  } catch (error) {
    console.error('Error fetching total schools:', error);
    res.status(500).json({ error: 'Failed to fetch school data: ' + error.message });
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

    console.log('SE generated coupons:', results);
    res.status(200).json(results || []);
  } catch (error) {
    console.error('Error fetching SE generated coupons:', error);
    res.status(500).json({ error: 'Failed to fetch data: ' + error.message });
  }
};

const getUserCoupons = async (req, res) => {
  const { userId } = req.params;
  console.log('Fetching coupons for userId:', userId);

  try {
    const [user] = await db.query(`SELECT user_type FROM users WHERE id = ?`, [userId]);
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRole = user[0].user_type;
    let coupons = [];

    if (userRole === 'school') {
      const [schoolCoupons] = await db.query(`
        SELECT 
          c.code,
          c.discount_percentage,
          c.valid_from,
          c.valid_until,
          c.max_uses,
          c.current_uses,
          s.school_name
        FROM coupons c
        JOIN schools s ON c.school_id = s.id
        WHERE c.user_id = ?
      `, [userId]);
      coupons = schoolCoupons.map(coupon => ({ ...coupon, type: 'school' }));
    } else if (userRole === 'student') {
      const [studentCoupons] = await db.query(`
        SELECT 
          sc.code,
          sc.discount_percentage,
          sc.valid_from,
          sc.valid_until,
          sc.max_uses,
          sc.current_uses,
          s.school_name
        FROM student_coupons sc
        JOIN schools s ON sc.school_id = s.id
        JOIN students st ON st.school_id = s.id
        WHERE st.user_id = ?
      `, [userId]);
      coupons = studentCoupons.map(coupon => ({ ...coupon, type: 'student' }));
    }

    console.log('Fetched Coupons:', coupons);
    res.status(200).json(coupons || []);
  } catch (error) {
    console.error('Error fetching user coupons:', error);
    res.status(500).json({
      error: 'Failed to fetch coupons',
      details: error.message,
    });
  }
};

module.exports = {
  generateCoupon,
  getUserCoupons,
  sendCouponEmail,
  validateCoupon,
  generateStudentCoupon,
  sendStudentCouponEmail,
  getSchoolsWithCouponStatus,
  getTotalSchools,
  getSEGeneratedCoupons
};