const express = require('express');
const { login, verifyToken, logout } = require('../controllers/auth1Controller');

const router = express.Router();

router.post('/AdminLogin', login);
router.get('/verifyToken', verifyToken); 
router.post('/logout', (req, res) => {
    res.clearCookie('token', { sameSite: 'strict', secure: false, httpOnly: true });
    res.status(200).json({ message: 'Logged out' });
  });
module.exports = router;