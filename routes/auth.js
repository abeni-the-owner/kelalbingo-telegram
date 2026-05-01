const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyTelegramWebAppData } = require('../middleware/auth');

// Register or login user
router.post('/login', async (req, res) => {
  const client = await pool.connect();
  
  try {
    // Get user data from request body
    const userData = req.body.user;
    
    if (!userData || !userData.id) {
      return res.status(400).json({ error: 'Invalid user data' });
    }

    const { id, username, first_name, last_name } = userData;

    // Check if user exists
    let result = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [id]
    );

    let user;

    if (result.rows.length === 0) {
      // Create new user
      result = await client.query(
        `INSERT INTO users (telegram_id, username, first_name, last_name, last_login)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING *`,
        [id, username, first_name, last_name]
      );
      user = result.rows[0];

      // Create initial balance
      await client.query(
        'INSERT INTO balances (user_id, balance, profit) VALUES ($1, 0, 0)',
        [user.id]
      );

      console.log(`✅ New user registered: ${username} (${id})`);
    } else {
      // Update last login
      await client.query(
        'UPDATE users SET last_login = NOW() WHERE telegram_id = $1',
        [id]
      );
      user = result.rows[0];
    }

    // Get user balance
    const balanceResult = await client.query(
      'SELECT balance, profit FROM balances WHERE user_id = $1',
      [user.id]
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        status: user.status
      },
      balance: balanceResult.rows[0] || { balance: 0, profit: 0 }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
