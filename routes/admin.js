const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Admin secret key for security
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-this-in-production';

// Middleware to check admin access
const checkAdmin = (req, res, next) => {
  const secret = req.headers['x-admin-secret'] || req.query.secret;
  
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  next();
};

// Initialize database tables
router.post('/init-database', checkAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Creating database tables...');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        phone_number VARCHAR(50),
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Balances table
    await client.query(`
      CREATE TABLE IF NOT EXISTS balances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(10, 2) DEFAULT 0.00,
        profit DECIMAL(10, 2) DEFAULT 0.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);

    // Transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        balance_before DECIMAL(10, 2),
        balance_after DECIMAL(10, 2),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Game history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL,
        cards_count INTEGER NOT NULL,
        bet_amount DECIMAL(10, 2) NOT NULL,
        payout DECIMAL(10, 2) DEFAULT 0.00,
        profit DECIMAL(10, 2) DEFAULT 0.00,
        winning_pattern VARCHAR(100),
        game_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bingo cards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bingo_cards (
        id SERIAL PRIMARY KEY,
        card_number INTEGER UNIQUE NOT NULL,
        b_column INTEGER[] NOT NULL,
        i_column INTEGER[] NOT NULL,
        n_column INTEGER[] NOT NULL,
        g_column INTEGER[] NOT NULL,
        o_column INTEGER[] NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User cards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_cards (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        card_id INTEGER REFERENCES bingo_cards(id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, card_id, round_number)
      )
    `);

    // Game rounds table
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_rounds (
        id SERIAL PRIMARY KEY,
        round_number INTEGER UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_game_history_user_id ON game_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(user_id);
    `);

    console.log('✅ Database initialization completed');

    res.json({
      success: true,
      message: 'Database tables created successfully',
      tables: [
        'users',
        'balances',
        'transactions',
        'game_history',
        'bingo_cards',
        'user_cards',
        'game_rounds'
      ]
    });

  } catch (error) {
    console.error('❌ Error creating tables:', error);
    res.status(500).json({
      error: 'Failed to initialize database',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// Check database status
router.get('/db-status', checkAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    res.json({
      success: true,
      tables: result.rows.map(r => r.table_name),
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check database status',
      details: error.message
    });
  }
});

module.exports = router;
