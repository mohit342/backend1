const express = require('express');
const { registerUser,updateUser,getStudentSchoolPoints, deleteUser,removeFromWishlist ,fetchSEEmployees,addToWishlist,getWishlist, fetchSchools, getAllUsers, getSchoolsBySE, assignSchoolToSE, removeSchoolFromSE, checkSEDetails,getStudentCountBySchool, getSchoolDetails ,getUserById, getSERedeemPoints,getSchoolPoints , getSchoolPointsById, getUserCount} = require('../controllers/userController');
const { login } = require('../controllers/authController'); // Add this line

const router = express.Router();

// Add the login route
router.post('/login', login); // Note: Remove /auth from here since it's part of the base URL

// Your existing routes
router.post('/register', registerUser);
router.get('/se-employees', fetchSEEmployees);
router.get('/schools', fetchSchools);
router.get('/users', getAllUsers);
router.get('/schools-by-se/:seId', getSchoolsBySE);
router.post('/se-school-mapping', assignSchoolToSE);
router.delete('/se-school-mapping/:seEmployeeId/:schoolId', removeSchoolFromSE);
router.get('/se-details/:seId', checkSEDetails);
router.delete('/users/:id', deleteUser);
// Add to userRoutes.js
router.get('/students/count/:schoolId', getStudentCountBySchool);
router.get('/school-details/:userId', getSchoolDetails);
router.get('/users/:id', getUserById);  // Add this line
router.put('/users/:id', updateUser);
// In your routes file
router.post('/wishlist/remove', removeFromWishlist); // Add this line
router.post('/wishlist', addToWishlist);
 router.get('/wishlist/:userId', getWishlist);
 router.get('/se/:seId/points', getSERedeemPoints);getStudentSchoolPoints
 router.get('/school/:userId/points', getSchoolPoints);
 router.get('/schools/:schoolId/points', getSchoolPointsById);
 router.get('/student-school-points/:userId', getStudentSchoolPoints);
 router.get('/count', getUserCount);

module.exports = router;