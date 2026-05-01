const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { simpleAuth } = require('../middleware/auth');

// Get current round
router.get('/round', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM game_rounds 
       WHERE status = 'active' 
       ORDER BY round_number DESC 
       LIMIT 1`
    );

    let round;
    if (result.rows.length === 0) {
      // Create first round
      const newRound = await pool.query(
        `INSERT INTO game_rounds (round_number, status) 
         VALUES (1, 'active') 
         RETURNING *`
      );
      round = newRound.rows[0];
    } else {
      round = result.rows[0];
    }

    res.json({ round });
  } catch (error) {
    console.error('Get round error:', error);
    res.status(500).json({ error: 'Failed to get round' });
  }
});

// Store game result
router.post('/result', simpleAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { round_number, cards_count, bet_amount, payout, winning_pattern, game_data } = req.body;

    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );

    const userId = userResult.rows[0].id;
    const profit = parseFloat(payout) - parseFloat(bet_amount);

    // Store game result
    await client.query(
      `INSERT INTO game_history 
       (user_id, round_number, cards_count, bet_amount, payout, profit, winning_pattern, game_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, round_number, cards_count, bet_amount, payout, profit, winning_pattern, JSON.stringify(game_data)]
    );

    // Update balance
    const balanceResult = await client.query(
      'SELECT balance, profit FROM balances WHERE user_id = $1',
      [userId]
    );

    const currentBalance = parseFloat(balanceResult.rows[0].balance);
    const currentProfit = parseFloat(balanceResult.rows[0].profit);
    const newBalance = currentBalance + profit;
    const newProfit = currentProfit + profit;

    await client.query(
      'UPDATE balances SET balance = $1, profit = $2, updated_at = NOW() WHERE user_id = $3',
      [newBalance, newProfit, userId]
    );

    // Record transaction
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, profit >= 0 ? 'win' : 'loss', Math.abs(profit), currentBalance, newBalance, 
       `Round ${round_number} - ${winning_pattern || 'No win'}`]
    );

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      balance: newBalance,
      profit: newProfit
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Store game result error:', error);
    res.status(500).json({ error: 'Failed to store game result' });
  } finally {
    client.release();
  }
});

// Get game history
router.get('/history', simpleAuth, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );

    const result = await pool.query(
      `SELECT * FROM game_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userResult.rows[0].id]
    );

    res.json({ history: result.rows });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Get game stats
router.get('/stats', simpleAuth, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );

    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_games,
         SUM(bet_amount) as total_bet,
         SUM(payout) as total_payout,
         SUM(profit) as total_profit,
         COUNT(CASE WHEN profit > 0 THEN 1 END) as wins,
         COUNT(CASE WHEN profit < 0 THEN 1 END) as losses
       FROM game_history 
       WHERE user_id = $1`,
      [userResult.rows[0].id]
    );

    res.json({ stats: result.rows[0] });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
