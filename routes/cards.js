const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { simpleAuth } = require('../middleware/auth');

// Get all bingo cards (available only)
router.get('/', async (req, res) => {
  try {
    const userId = req.headers['x-telegram-user-id'];
    
    // Get current round
    const roundResult = await pool.query(
      'SELECT round_number FROM game_rounds WHERE status = $1 ORDER BY round_number DESC LIMIT 1',
      ['active']
    );
    const currentRound = roundResult.rows[0]?.round_number || 1;

    // Get cards that are NOT already selected by other users in this round
    const result = await pool.query(
      `SELECT bc.* FROM bingo_cards bc
       WHERE bc.id NOT IN (
         SELECT card_id FROM user_cards 
         WHERE round_number = $1 AND is_active = true
         AND user_id != $2
       )
       ORDER BY bc.card_number LIMIT 100`,
      [currentRound, userId || 0]
    );
    
    res.json({ cards: result.rows, round: currentRound });
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
  const client = await pool.connect();
  
  try {
    const { card_id } = req.body;

    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userResult.rows[0].id;

    const roundResult = await client.query(
      'SELECT round_number FROM game_rounds WHERE status = $1 ORDER BY round_number DESC LIMIT 1',
      ['active']
    );

    const currentRound = roundResult.rows[0]?.round_number || 1;

    // Check if card is already taken by another user
    const cardCheck = await client.query(
      `SELECT uc.user_id, u.username 
       FROM user_cards uc
       JOIN users u ON uc.user_id = u.id
       WHERE uc.card_id = $1 AND uc.round_number = $2 AND uc.is_active = true`,
      [card_id, currentRound]
    );

    if (cardCheck.rows.length > 0 && cardCheck.rows[0].user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Card already selected by another user',
        taken_by: cardCheck.rows[0].username 
      });
    }

    // Insert or update user card selection
    await client.query(
      `INSERT INTO user_cards (user_id, card_id, round_number, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (user_id, card_id, round_number) DO UPDATE
       SET is_active = true`,
      [userId, card_id, currentRound]
    );

    await client.query('COMMIT');

    res.json({ success: true, message: 'Card selected successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Select card error:', error);
    res.status(500).json({ error: 'Failed to select card' });
  } finally {
    client.release();
  }
});

// Deselect card
router.post('/deselect', simpleAuth, async (req, res) => {
  try {
    const { card_id } = req.body;

    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userResult.rows[0].id;

    const roundResult = await pool.query(
      'SELECT round_number FROM game_rounds WHERE status = $1 ORDER BY round_number DESC LIMIT 1',
      ['active']
    );

    const currentRound = roundResult.rows[0]?.round_number || 1;

    // Mark card as inactive (release it)
    await pool.query(
      `UPDATE user_cards 
       SET is_active = false 
       WHERE user_id = $1 AND card_id = $2 AND round_number = $3`,
      [userId, card_id, currentRound]
    );

    res.json({ success: true, message: 'Card deselected successfully' });

  } catch (error) {
    console.error('Deselect card error:', error);
    res.status(500).json({ error: 'Failed to deselect card' });
  }
});

module.exports = router;
