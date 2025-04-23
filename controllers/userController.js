const bcrypt = require('bcryptjs');
const { insertUser, insertStudent, insertSchool, insertSE } = require('../models/users');
const db = require('../config/db');

const registerUser = async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    mobile,
    otp,
    password,
    userType,
    schoolId,
    schoolName,
    pinCode,
    city,
    state,
    address,
    employeeId,
    seRole // Ensure this is received
  } = req.body;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Validate required fields
    if (!firstName || !lastName || !email || !mobile || !password || !userType) {
      throw new Error('All required fields must be provided');
    }
    if (userType === 'school' && !schoolName) {
      throw new Error('School name is required for school users');
    }
    if (userType === 'student' && !schoolId) {
      throw new Error('School ID is required for students');
    }
    if (userType === 'se' && (!employeeId || !seRole)) {
      throw new Error('Employee ID and SE Role are required for SE users');
    }

    // Check for existing email
    const [existingUser] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      throw new Error('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [userResult] = await connection.query(
      'INSERT INTO users (first_name, last_name, email, mobile, otp, password, user_type, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [firstName, lastName, email, mobile, otp, hashedPassword, userType, userType === 'se' ? seRole : null]
    );
    const userId = userResult.insertId;

    if (userType === 'student') {
      await connection.query('INSERT INTO students (user_id, school_id) VALUES (?, ?)', [userId, schoolId]);
    } else if (userType === 'school') {
      const [schoolResult] = await connection.query(
        'INSERT INTO schools (user_id, school_name, pin_code, city, state, address, employee_id, reward_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, schoolName, pinCode, city, state, address, employeeId, 0.00]
      );
      if (!schoolResult.insertId) {
        throw new Error('Failed to create school entry');
      }
    } else if (userType === 'se') {
      await connection.query('INSERT INTO se_employees (user_id, employee_id, role) VALUES (?, ?, ?)', [userId, employeeId, seRole]);
      console.log(`Registered SE with employee_id: ${employeeId}, role: ${seRole}`); // Debug log
    }

    await connection.commit();
    res.status(200).json({ message: 'User registered successfully!', userId });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error in registerUser:', error);
    res.status(500).json({ error: 'An error occurred while registering the user', details: error.message });
  } finally {
    if (connection) connection.release();
  }
};
 
// const fetchSEEmployees = async (req, res) => {
//   try {
//     const [results] = await db.promise().query('SELECT employee_id FROM se_employees');
//     res.status(200).json(results);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to fetch SE Employee IDs' });
//   }
// };

const fetchSchools = async (req, res) => {
  try {
    const [results] = await db.query('SELECT id, school_name FROM schools');
    res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch school names' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT 
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) as full_name,
        u.email,
        u.mobile,
        u.user_type as role,
        u.role as se_role,
        CASE 
          WHEN u.user_type = 'student' THEN s.school_name
          WHEN u.user_type = 'school' THEN sc.school_name
          ELSE NULL
        END as school_name,
        CASE 
          WHEN u.user_type = 'se' THEN se.employee_id
          ELSE NULL
        END as se_employee_id
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN schools sc ON u.id = sc.user_id
      LEFT JOIN se_employees se ON u.id = se.user_id
    `);
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};


// In userController.js
const getSchoolsBySE = async (req, res) => {
  const { seId } = req.params;
  
  try {
    console.log('Fetching schools for SE ID:', seId);

    // Get schools where employee_id matches the SE's employee_id
    const [schools] = await db.query(
      `SELECT id, school_name, city, state 
       FROM schools 
       WHERE employee_id = ?`,
      [seId]
    );
    
    console.log('Found schools:', schools);
    
    res.status(200).json(schools);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch schools',
      details: error.message 
    });
  }
};

// Add a debug endpoint to check SE details
const checkSEDetails = async (req, res) => {
  const { seId } = req.params;
  
  try {
    const [seDetails] = await db.query(
      `SELECT se.*, u.first_name, u.last_name ,  u.role as se_role
       FROM se_employees se
       JOIN users u ON se.user_id = u.id
       WHERE se.employee_id = ?`,
      [seId]
    );

    // Also get the schools count
    const [schoolsCount] = await db.query(
      `SELECT COUNT(*) as count 
       FROM schools 
       WHERE employee_id = ?`,
      [seId]
    );
    
    res.status(200).json({
      seDetails: seDetails[0],
      schoolsCount: schoolsCount[0].count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



const fetchSEEmployees = async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT se.employee_id 
       FROM se_employees se
       JOIN users u ON se.user_id = u.id
       WHERE u.user_type = 'se'
       ORDER BY se.employee_id`
    );
    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching SE employees:', error);
    res.status(500).json({ error: 'Failed to fetch SE Employee IDs' });
  }
};
// In userController.js

// Add mapping between SE and School
const assignSchoolToSE = async (req, res) => {
  const { seEmployeeId, schoolId } = req.body;
  
  try {
    await db.query(
      `INSERT INTO se_school_mapping (se_employee_id, school_id) 
       VALUES (?, ?)`,
      [seEmployeeId, schoolId]
    );
    
    res.status(200).json({ message: 'School assigned to SE successfully' });
  } catch (error) {
    console.error('Error assigning school to SE:', error);
    res.status(500).json({ error: 'Failed to assign school to SE' });
  }
};

// Remove mapping between SE and School
const removeSchoolFromSE = async (req, res) => {
  const { seEmployeeId, schoolId } = req.params;
  
  try {
    await db.query(
      `DELETE FROM se_school_mapping 
       WHERE se_employee_id = ? AND school_id = ?`,
      [seEmployeeId, schoolId]
    );
    
    res.status(200).json({ message: 'School removed from SE successfully' });
  } catch (error) {
    console.error('Error removing school from SE:', error);
    res.status(500).json({ error: 'Failed to remove school from SE' });
  }
};



// const fetchSEEmployees = async (req, res) => {
//   try {
//     const [results] = await db.promise().query(
//       `SELECT se.employee_id 
//        FROM se_employees se
//        INNER JOIN users u ON se.user_id = u.id
//        WHERE u.user_type = 'se'
//        ORDER BY se.employee_id`
//     );
//     res.status(200).json(results);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Failed to fetch SE Employee IDs' });
//   }
// };


const getStudentCountBySchool = async (req, res) => {
  const { schoolId } = req.params;
  
  try {
    const [result] = await db.query(
      `SELECT COUNT(*) as count 
       FROM students 
       WHERE school_id = ?`,
      [schoolId]
    );
    
    res.status(200).json({ count: result[0].count });
  } catch (error) {
    console.error('Error fetching student count:', error);
    res.status(500).json({ 
      error: 'Failed to fetch student count',
      details: error.message 
    });
  }
};
const getSchoolDetails = async (req, res) => {
  const { userId } = req.params;

  try {
    const [schoolResult] = await db.query(
      'SELECT id, school_name FROM schools WHERE user_id = ?',
      [userId]
    );
    if (schoolResult.length === 0) {
      return res.status(404).json({ error: 'School not found for this user' });
    }
    res.json({ id: schoolResult[0].id, school_name: schoolResult[0].school_name });
  } catch (error) {
    console.error('Error fetching school details:', error);
    res.status(500).json({ error: 'Failed to fetch school details' });
  }
};

const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const [user] = await db.query(
      `SELECT 
        u.id,
        u.first_name,
        u.last_name,
        CONCAT(u.first_name, ' ', u.last_name) as full_name,
        u.email,
        u.user_type as role,
        u.role as se_role,
        s.school_id
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      WHERE u.id = ?`,
      [id]
    );
    if (user.length > 0) {
      res.status(200).json(user[0]);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, password } = req.body;

  try {
    let hashedPassword;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const updates = [];
    const values = [];

    if (firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(lastName);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (password) {
      updates.push('password = ?');
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    values.push(id);

    await db.query(query, values);
    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};
const addToWishlist = async (req, res) => {
  const { userId, productId } = req.body;

  try {
    await db.query(
      `INSERT INTO wishlist (user_id, product_id) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
      [userId, productId]
    );
    res.status(200).json({ message: 'Product added to wishlist' });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
};

const getWishlist = async (req, res) => {
  const { userId } = req.params;

  console.log(`Fetching wishlist for userId: ${userId}`);

  try {
    const [wishlist] = await db.query(
      `SELECT 
         p.id, 
         p.name, 
         p.price, 
         p.short_description, 
         GROUP_CONCAT(pi.image_url) AS images
       FROM wishlist w 
       JOIN products p ON w.product_id = p.id 
       LEFT JOIN product_images pi ON p.id = pi.product_id 
       WHERE w.user_id = ? 
       GROUP BY p.id, p.name, p.price, p.short_description`,
      [userId]
    );

    // Parse the images string into an array
    const formattedWishlist = wishlist.map(item => ({
      ...item,
      images: item.images ? item.images.split(',') : [] // Convert comma-separated string to array
    }));

    console.log('Wishlist fetched successfully:', formattedWishlist);
    res.status(200).json(formattedWishlist);
  } catch (error) {
    console.error('Detailed error fetching wishlist:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist', details: error.message });
  }
};
const removeFromWishlist = async (req, res) => {
  const { userId, productId } = req.body;

  try {
    const [result] = await db.query(
      `DELETE FROM wishlist 
       WHERE user_id = ? AND product_id = ?`,
      [userId, productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item not found in wishlist' });
    }

    res.status(200).json({ message: 'Product removed from wishlist' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
};

// userController.js
const getSchoolPoints = async (req, res) => {
  const { userId } = req.params;

  try {
    const [schoolResult] = await db.query(
      'SELECT reward_points FROM schools WHERE user_id = ?',
      [userId]
    );
    if (schoolResult.length === 0) {
      return res.status(404).json({ error: 'School not found for this user' });
    }
    res.json({ reward_points: schoolResult[0].reward_points });
  } catch (error) {
    console.error('Error fetching school points:', error);
    res.status(500).json({ error: 'Failed to fetch school points' });
  }
};
const getStudentSchoolPoints = async (req, res) => {
  const { userId } = req.params;
  try {
    console.log(`Fetching school points for userId: ${userId}`);
    const [studentResult] = await db.query(
      'SELECT school_id FROM students WHERE user_id = ?',
      [userId]
    );
    console.log('Student query result:', studentResult);
    if (studentResult.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const schoolId = studentResult[0].school_id;

    const [schoolResult] = await db.query(
       'SELECT reward_points FROM schools WHERE id = ?',
      [schoolId]
    );
    console.log('School query result:', schoolResult);
    if (schoolResult.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    res.json({ reward_points: schoolResult[0].reward_points });
  } catch (error) {
    console.error('Error fetching school points for student:', error);
    res.status(500).json({ error: 'Failed to fetch points' });
  }
};

const getSchoolPointsById = async (req, res) => {
  const { schoolId } = req.params;

  try {
    const [schoolResult] = await db.query(
      'SELECT reward_points FROM schools WHERE id = ?',
      [schoolId]
    );
    if (schoolResult.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    res.json({ reward_points: schoolResult[0].reward_points });
  } catch (error) {
    console.error('Error fetching school points:', error);
    res.status(500).json({ error: 'Failed to fetch school points' });
  }
};

const getSERedeemPoints = async (req, res) => {
  const { seId } = req.params;

  try {
    const [result] = await db.query(
      'SELECT redeem_points FROM se_employees WHERE employee_id = ?',
      [seId]
    );
    if (result.length === 0) {
      return res.status(404).json({ error: 'SE employee not found' });
    }
    res.json({ redeem_points: result[0].redeem_points });
  } catch (error) {
    console.error('Error fetching SE redeem points:', error);
    res.status(500).json({ error: 'Failed to fetch redeem points' });
  }
};

const getUserCount = async (req, res) => {
  try {
    const [result] = await db.query('SELECT COUNT(*) as count FROM users');
    res.status(200).json({ count: result[0].count });
  } catch (error) {
    console.error('Error fetching user count:', error);
    res.status(500).json({ error: 'Failed to fetch user count' });
  }
};
// userController.js
// userController.js
const deleteUser = async (req, res) => {
  const { id } = req.params;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check if the user exists
    const [user] = await connection.query('SELECT user_type FROM users WHERE id = ?', [id]);
    if (user.length === 0) {
      throw new Error('User not found');
    }
    console.log(`User found with id ${id}, type: ${user[0].user_type}`);

    const userType = user[0].user_type;

    // Delete related coupon_usage_log for all user types
    const [couponUsageLogResult] = await connection.query('DELETE FROM coupon_usage_log WHERE user_id = ?', [id]);
    console.log(`Deleted ${couponUsageLogResult.affectedRows} coupon_usage_log entries for user_id ${id}`);

    // Delete related data based on user type
    if (userType === 'student') {
      await connection.query('DELETE FROM students WHERE user_id = ?', [id]);
      console.log(`Deleted student record for user_id ${id}`);
    } else if (userType === 'school') {
      // Get the school_id before deletion
      const [school] = await connection.query('SELECT id FROM schools WHERE user_id = ?', [id]);
      if (school.length > 0) {
        const schoolId = school[0].id;
        // Delete related students
        const [studentResult] = await connection.query('DELETE FROM students WHERE school_id = ?', [schoolId]);
        console.log(`Deleted ${studentResult.affectedRows} students for school_id ${schoolId}`);
        // Delete related student_coupons
        const [studentCouponResult] = await connection.query('DELETE FROM student_coupons WHERE school_id = ?', [schoolId]);
        console.log(`Deleted ${studentCouponResult.affectedRows} student_coupons for school_id ${schoolId}`);
        // Delete related coupons
        await connection.query('DELETE FROM coupons WHERE school_id = ?', [schoolId]);
        console.log(`Deleted coupons for school_id ${schoolId}`);
        // Delete the school
        await connection.query('DELETE FROM schools WHERE user_id = ?', [id]);
        console.log(`Deleted school for user_id ${id}`);
      }
    } else if (userType === 'se') {
      // Get the employee_id before deletion
      const [se] = await connection.query('SELECT employee_id FROM se_employees WHERE user_id = ?', [id]);
      if (se.length > 0) {
        const employeeId = se[0].employee_id;
        // Delete related redeem_requests
        const [redeemRequestResult] = await connection.query('DELETE FROM redeem_requests WHERE se_id = ?', [employeeId]);
        console.log(`Deleted ${redeemRequestResult.affectedRows} redeem_requests for se_id ${employeeId}`);
        // Delete related coupons
        const [couponResult] = await connection.query('DELETE FROM coupons WHERE se_employee_id = ?', [employeeId]);
        console.log(`Deleted ${couponResult.affectedRows} coupons for se_employee_id ${employeeId}`);
        // Delete from se_employees
        await connection.query('DELETE FROM se_employees WHERE user_id = ?', [id]);
        console.log(`Deleted se_employees record for user_id ${id}`);
        // Clear employee_id in schools
        await connection.query('UPDATE schools SET employee_id = NULL WHERE employee_id = ?', [employeeId]);
        console.log(`Cleared employee_id ${employeeId} from schools`);
      }
    }

    // Delete related cart_items
    const [cartIds] = await connection.query('SELECT id FROM carts WHERE user_id = ?', [id]);
    if (cartIds.length > 0) {
      const cartIdList = cartIds.map(cart => cart.id);
      const [cartItemResult] = await connection.query('DELETE FROM cart_items WHERE cartId IN (?)', [cartIdList]);
      console.log(`Deleted ${cartItemResult.affectedRows} cart_items for user_id ${id}`);
    }

    // Delete related carts
    const [cartResult] = await connection.query('DELETE FROM carts WHERE user_id = ?', [id]);
    console.log(`Deleted ${cartResult.affectedRows} carts for user_id ${id}`);

    // Delete from wishlist
    await connection.query('DELETE FROM wishlist WHERE user_id = ?', [id]);
    console.log(`Deleted wishlist entries for user_id ${id}`);

    // Delete the user from the users table
    const [result] = await connection.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw new Error('Failed to delete user');
    }
    console.log(`Deleted user with id ${id}`);

    await connection.commit();
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  } finally {
    if (connection) connection.release();
  }
};
module.exports = { 
  registerUser, updateUser, deleteUser, fetchSEEmployees, fetchSchools, getAllUsers, 
  getSchoolsBySE, assignSchoolToSE, removeSchoolFromSE, checkSEDetails, 
  getStudentCountBySchool, getSchoolDetails, getUserById, 
  addToWishlist, getWishlist , removeFromWishlist, getSchoolPoints, getStudentSchoolPoints,
  getSchoolPointsById , getSERedeemPoints, getUserCount
};