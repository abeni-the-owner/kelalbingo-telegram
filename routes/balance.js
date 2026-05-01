const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { simpleAuth } = require('../middleware/auth');

// Get balance
router.get('/', simpleAuth, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await pool.query(
      'SELECT balance, profit, updated_at FROM balances WHERE user_id = $1',
      [userResult.rows[0].id]
    );

    res.json(result.rows[0] || { balance: 0, profit: 0 });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Add balance (admin only or payment integration)
router.post('/add', simpleAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );

    const userId = userResult.rows[0].id;

    // Get current balance
    const balanceResult = await client.query(
      'SELECT balance FROM balances WHERE user_id = $1',
      [userId]
    );

    const currentBalance = parseFloat(balanceResult.rows[0]?.balance || 0);
    const newBalance = currentBalance + parseFloat(amount);

    // Update balance
    await client.query(
      'UPDATE balances SET balance = $1, updated_at = NOW() WHERE user_id = $2',
      [newBalance, userId]
    );

    // Record transaction
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'deposit', amount, currentBalance, newBalance, 'Balance added']
    );

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      balance: newBalance,
      amount: parseFloat(amount)
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add balance error:', error);
    res.status(500).json({ error: 'Failed to add balance' });
  } finally {
    client.release();
  }
});

// Get transactions
router.get('/transactions', simpleAuth, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );

    const result = await pool.query(
      `SELECT * FROM transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userResult.rows[0].id]
    );

    res.json({ transactions: result.rows });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

module.exports = router;
