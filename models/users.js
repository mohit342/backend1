// users.js
const db = require('../config/db');

const insertUser = (userData) => {
  const query = `INSERT INTO users (first_name, last_name, email, mobile, otp, password, user_type)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
  return db.query(query, userData);
};

const insertSE = (userId, employeeId) => {
  const query = 'INSERT INTO se_employees (user_id, employee_id) VALUES (?, ?)';
  return db.query(query, [userId, employeeId]);
};

const insertStudent = (userId, schoolId) => {
  const query = `INSERT INTO students (user_id, school_id) VALUES (?, ?)`;
  return db.query(query, [userId, schoolId]);
};

const insertSchool = async (userId, schoolName, pinCode, city, state, address, employeeId) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [schoolResult] = await connection.query(
      `INSERT INTO schools (user_id, school_name, pin_code, city, state, address, employee_id, reward_points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, schoolName, pinCode, city, state, address, employeeId, 0.00]
    );

    await connection.commit();
    return [schoolResult];
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { insertUser, insertStudent, insertSchool, insertSE };