const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'mt_dev_secret';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };
