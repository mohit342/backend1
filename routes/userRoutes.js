const express = require('express');
const { registerUser, fetchSEEmployees, fetchSchools, getAllUsers , getSchoolsBySE, assignSchoolToSE, removeSchoolFromSE,checkSEDetails } = require('../controllers/userController');
const router = express.Router();

router.post('/register', registerUser);
router.get('/se-employees', fetchSEEmployees);
router.get('/schools', fetchSchools);
router.get('/users', getAllUsers); // Add this new route
router.get('/schools-by-se/:seId', getSchoolsBySE);  // New route
// In userRoutes.js
router.post('/se-school-mapping', assignSchoolToSE);
router.delete('/se-school-mapping/:seEmployeeId/:schoolId', removeSchoolFromSE);
router.get('/se-details/:seId', checkSEDetails);

module.exports = router;