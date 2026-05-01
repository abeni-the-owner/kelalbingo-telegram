const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { simpleAuth } = require('../middleware/auth');

// Get all bingo cards (just return all cards, filtering done client-side)
router.get('/', async (req, res) => {
  try {
    // Just return all cards - no database filtering
    const result = await pool.query(
      'SELECT * FROM bingo_cards ORDER BY card_number LIMIT 100'
    );
    
    // Get current round
    const roundResult = await pool.query(
      'SELECT round_number FROM game_rounds WHERE status = $1 ORDER BY round_number DESC LIMIT 1',
      ['active']
    );
    const currentRound = roundResult.rows[0]?.round_number || 1;
    
    res.json({ cards: result.rows, round: currentRound });
  } catch (error) {
    console.error('Get cards error:', error);
    res.status(500).json({ error: 'Failed to get cards', details: error.message });
  }
});

// Get user's selected cards (from memory, not database)
router.get('/my-cards', simpleAuth, async (req, res) => {
  try {
    const cardSelections = req.app.get('cardSelections');
    const userId = req.telegramUser.id;
    
    const roundResult = await pool.query(
      'SELECT round_number FROM game_rounds WHERE status = $1 ORDER BY round_number DESC LIMIT 1',
      ['active']
    );
    const currentRound = roundResult.rows[0]?.round_number || 1;
    
    const roundSelections = cardSelections.get(currentRound) || {};
    
    // Find cards selected by this user
    const myCardIds = Object.entries(roundSelections)
      .filter(([cardId, uId]) => uId === userId)
      .map(([cardId]) => parseInt(cardId));
    
    if (myCardIds.length === 0) {
      return res.json({ cards: [], round: currentRound });
    }
    
    // Get card details
    const result = await pool.query(
      'SELECT * FROM bingo_cards WHERE id = ANY($1)',
      [myCardIds]
    );
    
    res.json({ cards: result.rows, round: currentRound });
  } catch (error) {
    console.error('Get my cards error:', error);
    res.status(500).json({ error: 'Failed to get cards' });
  }
});

// Save selected cards to database (called when game starts)
router.post('/save-selections', simpleAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const cardSelections = req.app.get('cardSelections');
    const userId = req.telegramUser.id;
    
    await client.query('BEGIN');
    
    const userResult = await client.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    const dbUserId = userResult.rows[0].id;
    
    const roundResult = await client.query(
      'SELECT round_number FROM game_rounds WHERE status = $1 ORDER BY round_number DESC LIMIT 1',
      ['active']
    );
    const currentRound = roundResult.rows[0]?.round_number || 1;
    
    const roundSelections = cardSelections.get(currentRound) || {};
    
    // Find cards selected by this user
    const myCardIds = Object.entries(roundSelections)
      .filter(([cardId, uId]) => uId === userId)
      .map(([cardId]) => parseInt(cardId));
    
    // Save to database
    for (const cardId of myCardIds) {
      await client.query(
        `INSERT INTO user_cards (user_id, card_id, round_number, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (user_id, card_id, round_number) DO UPDATE
         SET is_active = true`,
        [dbUserId, cardId, currentRound]
      );
    }
    
    await client.query('COMMIT');
    
    res.json({ success: true, message: 'Selections saved', count: myCardIds.length });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Save selections error:', error);
    res.status(500).json({ error: 'Failed to save selections' });
  } finally {
    client.release();
  }
});

module.exports = router;
