const db = require('../config/db');

const createCoupon = async (schoolId, seEmployeeId, code, discountPercentage, validFrom, validUntil, maxUses) => {
  const query = `
    INSERT INTO coupons (
      school_id, 
      se_employee_id,
      code,
      discount_percentage,
      valid_from,
      valid_until,
      max_uses,
      current_uses
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `;
  return db.promise().query(query, [
    schoolId,
    seEmployeeId,
    code,
    discountPercentage,
    validFrom,
    validUntil,
    maxUses
  ]);
};

const getCouponsBySchool = async (schoolId) => {
  const query = `
    SELECT 
      c.*,
      s.school_name,
      CONCAT(u.first_name, ' ', u.last_name) as se_name
    FROM coupons c
    JOIN schools s ON c.school_id = s.id
    JOIN se_employees se ON c.se_employee_id = se.employee_id
    JOIN users u ON se.user_id = u.id
    WHERE c.school_id = ?
  `;
  return db.promise().query(query, [schoolId]);
};

module.exports = { createCoupon, getCouponsBySchool };