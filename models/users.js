// users.js
const db = require('../config/db');

const insertUser = (userData) => {
  const query = `INSERT INTO users (first_name, last_name, email, mobile, otp, password, user_type)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
  return db.promise().query(query, userData);
};

const insertSE = (userId, employeeId) => {
  const query = 'INSERT INTO se_employees (user_id, employee_id) VALUES (?, ?)';
  return db.promise().query(query, [userId, employeeId]);
};

const insertStudent = (userId, schoolName) => {
  const query = `INSERT INTO students (user_id, school_name) VALUES (?, ?)`;
  return db.promise().query(query, [userId, schoolName]);
};

const insertSchool = async (userId, schoolName, pinCode, city, state, address, employeeId) => {
  try {
    await db.promise().beginTransaction();

    try {
      // Modified query to include employee_id in the INSERT statement
      const [schoolResult] = await db.promise().query(
        `INSERT INTO schools (user_id, school_name, pin_code, city, state, address, employee_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, schoolName, pinCode, city, state, address, employeeId]
      );

      await db.promise().commit();
      return [schoolResult];
    } catch (error) {
      await db.promise().rollback();
      throw error;
    }
  } catch (error) {
    throw error;
  }
};


module.exports = { insertUser, insertStudent, insertSchool, insertSE };