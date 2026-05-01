const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { simpleAuth } = require('../middleware/auth');

// Get current user info
router.get('/me', simpleAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.*, b.balance, b.profit 
       FROM users u
       LEFT JOIN balances b ON u.id = b.user_id
       WHERE u.telegram_id = $1`,
      [req.telegramUser.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Update user info
router.put('/me', simpleAuth, async (req, res) => {
  try {
    const { phone_number } = req.body;
    
    const result = await pool.query(
      `UPDATE users 
       SET phone_number = $1, updated_at = NOW()
       WHERE telegram_id = $2
       RETURNING *`,
      [phone_number, req.telegramUser.id]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;
