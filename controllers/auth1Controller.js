const jwt = require('jsonwebtoken');
const users = require('../models/userModel');

const SECRET_KEY = 'your_secret_key'; // Use an environment variable in production

const login = (req, res) => {
  console.log('Login endpoint hit'); // Debug log

  const { username, password } = req.body;
  console.log('Received credentials:', username, password); // Debug log

  const user = users.find((u) => u.username === username && u.password === password);

  if (user) {
    console.log('User found:', user); // Debug log

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: false, // Set to false for localhost testing
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({ message: 'Login successful', user });
  } else {
    console.log('Invalid credentials'); // Debug log
    return res.status(401).json({ message: 'Invalid credentials' });
  }
};


const verifyToken = (req, res) => {
  const token = req.cookies.token;

  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    res.status(200).json({ user: { id: decoded.id, username: decoded.username } });
  });
};

const logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
};

module.exports = { login, verifyToken, logout };