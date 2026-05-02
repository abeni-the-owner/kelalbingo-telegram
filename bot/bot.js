const bot = require('../config/telegram');
const pool = require('../config/database');

// Set menu button for the bot (this passes user data)
bot.setChatMenuButton({
  menu_button: {
    type: 'web_app',
    text: '🎲 Play Bingo',
    web_app: {
      url: process.env.WEB_APP_URL || 'https://kelalbingo-telegram.onrender.com'
    }
  }
}).catch(err => {
  console.error('Error setting menu button:', err);
});

// Start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name;

  const webAppUrl = process.env.WEB_APP_URL || 'https://kelalbingo-telegram.onrender.com';

  const welcomeMessage = `
🎮 *Welcome to KELALBINGO!*

Hello ${username}! 👋

Play bingo, win prizes, and have fun!

📱 *User Info:*
• ID: \`${userId}\`
• Username: ${msg.from.username ? `@${msg.from.username}` : 'Not set'}
• Name: ${msg.from.first_name} ${msg.from.last_name || ''}

🎯 *How to Play:*
1. Use the 🎲 *Menu Button* at the bottom of the chat
2. OR click the button below

*Note: Use the menu button for full features!*
  `;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: '🎲 Play Bingo (Inline)',
          web_app: { url: webAppUrl }
        }
      ],
      [
        { text: '💰 Check Balance', callback_data: 'check_balance' },
        { text: '📊 My Stats', callback_data: 'my_stats' }
      ],
      [
        { text: '📱 Share Contact', request_contact: true }
      ],
      [
        { text: '🔍 Diagnostics', url: webAppUrl + '/diagnose.html' },
        { text: '❓ Help', callback_data: 'help' }
      ]
    ]
  };

  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
});

// Callback query handler
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;

  try {
    if (data === 'check_balance') {
      const result = await pool.query(
        `SELECT b.balance, b.profit 
         FROM balances b
         JOIN users u ON b.user_id = u.id
         WHERE u.telegram_id = $1`,
        [userId]
      );

      if (result.rows.length > 0) {
        const { balance, profit } = result.rows[0];
        bot.sendMessage(chatId, 
          `💰 *Your Balance*\n\n` +
          `Balance: ${balance} Birr\n` +
          `Profit: ${profit} Birr`,
          { parse_mode: 'Markdown' }
        );
      } else {
        bot.sendMessage(chatId, '❌ User not found. Please start the game first.');
      }
    }

    if (data === 'my_stats') {
      const result = await pool.query(
        `SELECT 
           COUNT(*) as total_games,
           SUM(bet_amount) as total_bet,
           SUM(payout) as total_payout,
           SUM(profit) as total_profit
         FROM game_history gh
         JOIN users u ON gh.user_id = u.id
         WHERE u.telegram_id = $1`,
        [userId]
      );

      const stats = result.rows[0];
      bot.sendMessage(chatId,
        `📊 *Your Statistics*\n\n` +
        `Total Games: ${stats.total_games || 0}\n` +
        `Total Bet: ${stats.total_bet || 0} Birr\n` +
        `Total Payout: ${stats.total_payout || 0} Birr\n` +
        `Total Profit: ${stats.total_profit || 0} Birr`,
        { parse_mode: 'Markdown' }
      );
    }

    if (data === 'help') {
      bot.sendMessage(chatId,
        `❓ *Help & Instructions*\n\n` +
        `1. Click "Play Bingo" to start\n` +
        `2. Select your bingo cards\n` +
        `3. Play and win prizes!\n\n` +
        `Commands:\n` +
        `/start - Start the bot\n` +
        `/balance - Check your balance\n` +
        `/stats - View your statistics`,
        { parse_mode: 'Markdown' }
      );
    }

    bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error('Callback query error:', error);
    bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
  }
});

// Contact handler for phone numbers
bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const contact = msg.contact;

  if (contact.user_id === userId) {
    // User shared their own contact
    try {
      // Update user with phone number
      await pool.query(
        `UPDATE users SET phone_number = $1 WHERE telegram_id = $2`,
        [contact.phone_number, userId]
      );

      bot.sendMessage(chatId, 
        `✅ *Phone number saved!*\n\n` +
        `📞 ${contact.phone_number}\n\n` +
        `Now you can play with full access!`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Contact save error:', error);
      bot.sendMessage(chatId, '❌ Error saving contact information');
    }
  } else {
    bot.sendMessage(chatId, '❌ Please share your own contact information');
  }
});

// Balance command
bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const result = await pool.query(
      `SELECT b.balance, b.profit 
       FROM balances b
       JOIN users u ON b.user_id = u.id
       WHERE u.telegram_id = $1`,
      [userId]
    );

    if (result.rows.length > 0) {
      const { balance, profit } = result.rows[0];
      bot.sendMessage(chatId,
        `💰 Balance: ${balance} Birr\n📈 Profit: ${profit} Birr`
      );
    } else {
      bot.sendMessage(chatId, '❌ User not found. Use /start first.');
    }
  } catch (error) {
    console.error('Balance command error:', error);
    bot.sendMessage(chatId, '❌ Error fetching balance');
  }
});

console.log('✅ Telegram Bot commands registered');

module.exports = bot;
