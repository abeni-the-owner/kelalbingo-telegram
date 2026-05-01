const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { simpleAuth } = require('../middleware/auth');

// Get all bingo cards
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bingo_cards ORDER BY card_number LIMIT 100'
    );
    res.json({ cards: result.rows });
  } catch (error) {
    console.error('Get cards error:', error);
    res.status(500).json({ error: 'Failed to get cards' });
  }
});

// Get user's selected cards for current round
router.get('/my-cards', simpleAuth, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );

    const roundResult = await pool.query(
      'SELECT round_number FROM game_rounds WHERE status = $1 ORDER BY round_number DESC LIMIT 1',
      ['active']
    );

    const currentRound = roundResult.rows[0]?.round_number || 1;

    const result = await pool.query(
      `SELECT bc.* FROM bingo_cards bc
       JOIN user_cards uc ON bc.id = uc.card_id
       WHERE uc.user_id = $1 AND uc.round_number = $2 AND uc.is_active = true`,
      [userResult.rows[0].id, currentRound]
    );

    res.json({ cards: result.rows, round: currentRound });
  } catch (error) {
    console.error('Get user cards error:', error);
    res.status(500).json({ error: 'Failed to get user cards' });
  }
});

// Select card for current round
router.post('/select', simpleAuth, async (req, res) => {
  try {
    const { card_id } = req.body;

    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );

    const roundResult = await pool.query(
      'SELECT round_number FROM game_rounds WHERE status = $1 ORDER BY round_number DESC LIMIT 1',
      ['active']
    );

    const currentRound = roundResult.rows[0]?.round_number || 1;

    await pool.query(
      `INSERT INTO user_cards (user_id, card_id, round_number, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (user_id, card_id, round_number) DO NOTHING`,
      [userResult.rows[0].id, card_id, currentRound]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Select card error:', error);
    res.status(500).json({ error: 'Failed to select card' });
  }
});

module.exports = router;
