// users.js
const db = require('../config/db');

const insertUser = async (userData) => {
  const query = `INSERT INTO users (first_name, last_name, email, mobile, otp, password, user_type)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const [result] = await db.query(query, userData);
  return [result];  // Ensure it returns the insert result
};
const insertSE = (userId, employeeId) => {
  const query = 'INSERT INTO se_employees (user_id, employee_id) VALUES (?, ?)';
  return db.query(query, [userId, employeeId]);
};

const insertStudent = (userId, schoolName) => {
  const query = `INSERT INTO students (user_id, school_name) VALUES (?, ?)`;
  return db.query(query, [userId, schoolName]);
};

const insertSchool = async (userId, schoolName, pinCode, city, state, address, employeeId) => {
  let connection;
  try {
    connection = await db.getConnection(); // ✅ Get a connection instance
    await connection.beginTransaction();

    const [schoolResult] = await connection.query(
      `INSERT INTO schools (user_id, school_name, pin_code, city, state, address, employee_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, schoolName, pinCode, city, state, address, employeeId]
    );

    await connection.commit();
    return [schoolResult];
  } catch (error) {
    if (connection) await connection.rollback(); // ✅ Rollback if error occurs
    throw error;
  } finally {
    if (connection) connection.release(); // ✅ Release connection after usage
  }
};




module.exports = { insertUser, insertStudent, insertSchool, insertSE };