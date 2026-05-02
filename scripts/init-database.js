const pool = require('../config/database');

const createTables = async() => {
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
        console.log('✅ Users table created');

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
        console.log('✅ Balances table created');

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
        console.log('✅ Transactions table created');

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
        console.log('✅ Game history table created');

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
        console.log('✅ Bingo cards table created');

        // User cards (cards assigned to users for current round)
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
        console.log('✅ User cards table created');

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
        console.log('✅ Game rounds table created');

        // Create referrals table
        console.log('Creating referrals table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER NOT NULL REFERENCES users(id),
        referred_user_id INTEGER NOT NULL REFERENCES users(id),
        referral_code VARCHAR(20) NOT NULL,
        bonus_amount DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(referred_user_id),
        UNIQUE(referral_code)
      )
    `);
        console.log('✅ Referrals table created');

        // Create indexes for performance
        console.log('Creating indexes...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_balances_user_id ON balances(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_game_history_user_id ON game_history(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_game_history_round ON game_history(round_number)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_bingo_cards_id ON bingo_cards(id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_user_cards_card_id ON user_cards(card_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_game_rounds_number ON game_rounds(round_number)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code)');
        console.log('✅ Indexes created');

        console.log('🎉 Database initialization completed successfully!');
    } catch (error) {
        console.error('❌ Error creating tables:', error);
        throw error;
    } finally {
        client.release();
    }
};

// Run the initialization
createTables()
    .then(() => {
        console.log('✅ Database setup complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    });