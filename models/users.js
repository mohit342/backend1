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

const insertStudent = (userId, schoolName) => {
  const query = `INSERT INTO students (user_id, school_name) VALUES (?, ?)`;
  return db.query(query, [userId, schoolName]);
};

const insertSchool = async (userId, schoolName, pinCode, city, state, address, employeeId) => {
  let connection;
  try {
    // Get a connection from the pool
    connection = await db.getConnection();

    // Start transaction
    await connection.beginTransaction();

    // Insert school data
    const [schoolResult] = await connection.query(
      `INSERT INTO schools (user_id, school_name, pin_code, city, state, address, employee_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, schoolName, pinCode, city, state, address, employeeId]
    );

    // Commit transaction
    await connection.commit();
    return [schoolResult];
  } catch (error) {
    // Rollback transaction on error
    if (connection) await connection.rollback();
    throw error;
  } finally {
    // Release the connection back to the pool
    if (connection) connection.release();
  }
};


module.exports = { insertUser, insertStudent, insertSchool, insertSE };