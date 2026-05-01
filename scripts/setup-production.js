const { Pool } = require('pg');
require('dotenv').config();

// Use production database URL from Render
const productionDatabaseUrl = process.argv[2];

if (!productionDatabaseUrl) {
  console.error('❌ Please provide the production DATABASE_URL');
  console.log('\nUsage:');
  console.log('node scripts/setup-production.js "postgresql://user:pass@host:port/dbname"');
  console.log('\nGet your DATABASE_URL from Render dashboard → Database → Internal Database URL');
  console.log('\n⚠️  IMPORTANT: Copy the FULL URL including the complete hostname');
  console.log('Example: postgresql://user:pass@dpg-xxxxx-a.oregon-postgres.render.com:5432/dbname');
  process.exit(1);
}

console.log('🔍 Checking database URL format...');
if (!productionDatabaseUrl.includes('.render.com') && !productionDatabaseUrl.includes('localhost')) {
  console.error('❌ Invalid database URL format!');
  console.log('\n⚠️  The hostname seems incomplete. Make sure you copied the FULL Internal Database URL.');
  console.log('\nIt should look like:');
  console.log('postgresql://user:pass@dpg-xxxxx-a.oregon-postgres.render.com:5432/dbname');
  console.log('                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
  console.log('                                  Complete hostname with region');
  process.exit(1);
}

const pool = new Pool({
  connectionString: productionDatabaseUrl,
  ssl: { rejectUnauthorized: false }
});

const createTables = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Connecting to production database...');

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

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_game_history_user_id ON game_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(user_id);
    `);
    console.log('✅ Indexes created');

    console.log('\n🎉 Production database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Update WEB_APP_URL in Render environment variables');
    console.log('2. Configure Telegram bot with @BotFather');
    console.log('3. Test your bot in Telegram!');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

createTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
