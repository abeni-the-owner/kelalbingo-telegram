const db = require('../config/database');

const initBot = (bot) => {
  // Start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const username = msg.from.username || '';
    const firstName = msg.from.first_name || '';
    const lastName = msg.from.last_name || '';

    try {
      // Check if user exists
      const userResult = await db.query(
        'SELECT * FROM users WHERE telegram_id = $1',
        [telegramId]
      );

      if (userResult.rows.length === 0) {
        // Create new user
        await db.query(
          `INSERT INTO users (telegram_id, username, first_name, last_name, last_login)
           VALUES ($1, $2, $3, $4, NOW())`,
          [telegramId, username, firstName, lastName]
        );

        // Create balance record
        const newUser = await db.query(
          'SELECT id FROM users WHERE telegram_id = $1',
          [telegramId]
        );
        await db.query(
          'INSERT INTO balances (user_id, balance, profit) VALUES ($1, 0, 0)',
          [newUser.rows[0].id]
        );

        bot.sendMessage(chatId, `🎉 Welcome to KELALBINGO, ${firstName}!\n\nYour account has been created successfully.`);
      } else {
        // Update last login
        await db.query(
          'UPDATE users SET last_login = NOW() WHERE telegram_id = $1',
          [telegramId]
        );

        bot.sendMessage(chatId, `👋 Welcome back, ${firstName}!`);
      }

      // Send main menu with Web App button
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '🎮 Play Bingo',
              web_app: { url: process.env.WEB_APP_URL }
            }
          ],
          [
            { text: '💰 Check Balance', callback_data: 'check_balance' }
          ],
          [
            { text: '📊 Game Stats', callback_data: 'game_stats' }
          ],
          [
            { text: 'ℹ️ Help', callback_data: 'help' }
          ]
        ]
      };

      bot.sendMessage(chatId, '🎲 Choose an option:', { reply_markup: keyboard });
    } catch (error) {
      console.error('Error in /start command:', error);
      bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
  });

  // Balance callback
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    const data = query.data;

    try {
      if (data === 'check_balance') {
        const result = await db.query(
          `SELECT b.balance, b.profit 
           FROM balances b
           JOIN users u ON b.user_id = u.id
           WHERE u.telegram_id = $1`,
          [telegramId]
        );

        if (result.rows.length > 0) {
          const { balance, profit } = result.rows[0];
          bot.sendMessage(
            chatId,
            `💰 Your Balance:\n\n` +
            `Balance: ${parseFloat(balance).toFixed(2)} Birr\n` +
            `Profit: ${parseFloat(profit).toFixed(2)} Birr`
          );
        } else {
          bot.sendMessage(chatId, '❌ Balance not found.');
        }
      } else if (data === 'game_stats') {
        const result = await db.query(
          `SELECT 
             COUNT(*) as total_games,
             SUM(bet_amount) as total_bet,
             SUM(payout) as total_payout,
             SUM(profit) as total_profit
           FROM game_history gh
           JOIN users u ON gh.user_id = u.id
           WHERE u.telegram_id = $1`,
          [telegramId]
        );

        if (result.rows.length > 0) {
          const stats = result.rows[0];
          bot.sendMessage(
            chatId,
            `📊 Your Game Statistics:\n\n` +
            `Total Games: ${stats.total_games}\n` +
            `Total Bet: ${parseFloat(stats.total_bet || 0).toFixed(2)} Birr\n` +
            `Total Payout: ${parseFloat(stats.total_payout || 0).toFixed(2)} Birr\n` +
            `Total Profit: ${parseFloat(stats.total_profit || 0).toFixed(2)} Birr`
          );
        } else {
          bot.sendMessage(chatId, '📊 No game history yet. Start playing!');
        }
      } else if (data === 'help') {
        bot.sendMessage(
          chatId,
          `ℹ️ KELALBINGO Help\n\n` +
          `🎮 Play Bingo - Open the game interface\n` +
          `💰 Check Balance - View your current balance\n` +
          `📊 Game Stats - View your game statistics\n\n` +
          `How to play:\n` +
          `1. Click "Play Bingo" to open the game\n` +
          `2. Select your bingo cards\n` +
          `3. Place your bet\n` +
          `4. Play and win!\n\n` +
          `Need support? Contact @your_support_username`
        );
      }

      bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error('Error handling callback:', error);
      bot.answerCallbackQuery(query.id, { text: '❌ Error occurred' });
    }
  });

  // Help command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(
      chatId,
      `ℹ️ KELALBINGO Commands:\n\n` +
      `/start - Start the bot and open menu\n` +
      `/help - Show this help message\n` +
      `/balance - Check your balance\n` +
      `/stats - View game statistics`
    );
  });

  // Balance command
  bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const result = await db.query(
        `SELECT b.balance, b.profit 
         FROM balances b
         JOIN users u ON b.user_id = u.id
         WHERE u.telegram_id = $1`,
        [telegramId]
      );

      if (result.rows.length > 0) {
        const { balance, profit } = result.rows[0];
        bot.sendMessage(
          chatId,
          `💰 Balance: ${parseFloat(balance).toFixed(2)} Birr\n` +
          `📈 Profit: ${parseFloat(profit).toFixed(2)} Birr`
        );
      }
    } catch (error) {
      console.error('Error in /balance command:', error);
      bot.sendMessage(chatId, '❌ Error fetching balance.');
    }
  });

  // Stats command
  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    try {
      const result = await db.query(
        `SELECT 
           COUNT(*) as total_games,
           SUM(bet_amount) as total_bet,
           SUM(payout) as total_payout
         FROM game_history gh
         JOIN users u ON gh.user_id = u.id
         WHERE u.telegram_id = $1`,
        [telegramId]
      );

      if (result.rows.length > 0) {
        const stats = result.rows[0];
        bot.sendMessage(
          chatId,
          `📊 Games Played: ${stats.total_games}\n` +
          `💵 Total Bet: ${parseFloat(stats.total_bet || 0).toFixed(2)} Birr\n` +
          `🎁 Total Payout: ${parseFloat(stats.total_payout || 0).toFixed(2)} Birr`
        );
      }
    } catch (error) {
      console.error('Error in /stats command:', error);
      bot.sendMessage(chatId, '❌ Error fetching stats.');
    }
  });

  console.log('✅ Bot handlers initialized');
};

module.exports = { initBot };
