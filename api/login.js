// api/login.js
// POST /api/login - Admin authentication with JWT

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Cache hashed password to avoid re-hashing on every request
let cachedHashedPassword = null;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getJwtSecret() {
  return process.env.JWT_SECRET || 'syntiox-dev-jwt-secret-key-change-in-production';
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || 'admin123';
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    // Compare passwords (direct comparison for simplicity in serverless)
    const adminPassword = getAdminPassword();
    const isValid = password === adminPassword;

    if (!isValid) {
      // Add small delay to prevent brute-force timing attacks
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
      return res.status(401).json({ error: 'Invalid password. Access denied.' });
    }

    // Generate JWT token valid for 8 hours
    const token = jwt.sign(
      {
        role: 'admin',
        project: 'syntiox',
        iat: Math.floor(Date.now() / 1000)
      },
      getJwtSecret(),
      {
        expiresIn: '8h',
        issuer: 'syntiox-ideas'
      }
    );

    return res.status(200).json({
      success: true,
      token: token,
      expiresIn: '8h',
      message: 'Login successful. Welcome to Syntiox Admin!'
    });

  } catch (error) {
    console.error('[LOGIN] Error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
