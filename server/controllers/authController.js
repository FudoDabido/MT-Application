const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { signToken } = require('../services/jwtService');

const SAFE_FIELDS = 'id, name, username, email, birth_date, initial_weight, initial_height, photo_path, is_admin, meditation_mode, created_at';

async function register(req, res, next) {
  try {
    const { name, username, email, password, birth_date, initial_weight, initial_height } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: 'name, username, email and password are required' });
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3–30 characters, letters/numbers/underscores only' });
    }

    // Check username taken
    const takenUser = db.prepare('SELECT id FROM users WHERE LOWER(username)=LOWER(?)').get(username);
    if (takenUser) return res.status(409).json({ error: 'Username already taken' });

    const hash = await bcrypt.hash(password, 10);

    // First user ever = admin
    const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
    const isAdmin = userCount.cnt === 0 ? 1 : 0;

    const result = db.prepare(`
      INSERT INTO users (name, username, email, password_hash, birth_date, initial_weight, initial_height, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, username, email, hash, birth_date || null, initial_weight || null, initial_height || null, isAdmin);

    const user = db.prepare(`SELECT ${SAFE_FIELDS} FROM users WHERE id=?`).get(result.lastInsertRowid);
    const token = signToken({ id: user.id, email: user.email, is_admin: user.is_admin || 0 });
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      if (err.message.includes('username')) return res.status(409).json({ error: 'Username already taken' });
      if (err.message.includes('email')) return res.status(409).json({ error: 'Email already registered' });
    }
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email=? OR LOWER(username)=LOWER(?)').get(email, email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const { password_hash, ...safeUser } = user;
    const token = signToken({ id: user.id, email: user.email, is_admin: user.is_admin || 0 });
    res.json({ token, user: safeUser });
  } catch (err) {
    next(err);
  }
}

function me(req, res, next) {
  try {
    const user = db.prepare(`SELECT ${SAFE_FIELDS} FROM users WHERE id=?`).get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

function listUsers(req, res, next) {
  try {
    const users = db.prepare(`SELECT ${SAFE_FIELDS} FROM users ORDER BY created_at DESC`).all();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me, listUsers };
