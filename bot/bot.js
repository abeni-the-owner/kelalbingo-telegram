const bot = require('../config/telegram');
const pool = require('../config/database');

// Set menu button for the bot (this passes user data)
async function setupMenuButton() {
    try {
        const webAppUrl = process.env.WEB_APP_URL || 'https://kelalbingo-telegram.onrender.com';
        
        // Set the menu button (this is the main way to get user data)
        await bot.setChatMenuButton({
            menu_button: {
                type: 'web_app',
                text: '🎲 Play Bingo',
                web_app: {
                    url: webAppUrl
                }
            }
        });
        
        console.log('✅ Menu button set successfully:', webAppUrl);
        
        // Also set bot commands for better UX
        await bot.setMyCommands([
            { command: 'start', description: '🎮 Start the bot and play bingo' },
            { command: 'test', description: '🔧 Test bot connection' },
            { command: 'contact', description: '📱 Share your contact info' },
            { command: 'balance', description: '💰 Check your balance' },
            { command: 'menu', description: '🔍 Check menu button status' },
            { command: 'play', description: '🎲 Open bingo game directly' }
        ]);
        
        console.log('✅ Bot commands set successfully');
        
    } catch (err) {
        console.error('❌ Error setting menu button:', err.message);
    }
}

// Setup menu button on startup
setupMenuButton();

// Start command
bot.onText(/\/start/, async (msg) => {
  console.log('📨 Received /start command from user:', msg.from.id);
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name;

  try {
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
            text: '🎲 Play Bingo',
            web_app: { 
              url: webAppUrl + '?source=inline&user_id=' + userId + '&username=' + encodeURIComponent(username) + '&first_name=' + encodeURIComponent(msg.from.first_name || '')
            }
          }
        ],
        [
          { text: '💰 Check Balance', callback_data: 'check_balance' },
          { text: '📊 My Stats', callback_data: 'my_stats' }
        ],
        [
          { text: ' Diagnostics', url: webAppUrl + '/diagnose.html' },
          { text: '🧪 User Test', url: webAppUrl + '/user-test.html' },
          { text: '❓ Help', callback_data: 'help' }
        ]
      ]
    };

    await bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    console.log('✅ Start message sent successfully to user:', userId);
    
  } catch (error) {
    console.error('❌ Error in /start command:', error);
    
    // Send a simple fallback message
    try {
      await bot.sendMessage(chatId, '🎮 Welcome to KELALBINGO!\n\nSorry, there was an error. Please try again.');
    } catch (fallbackError) {
      console.error('❌ Fallback message also failed:', fallbackError);
    }
  }
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
        `🎮 *How to Play:*\n` +
        `1. Click "🎲 Play Bingo" to start\n` +
        `2. Select your bingo cards\n` +
        `3. Play and win prizes!\n\n` +
        `📱 *Commands:*\n` +
        `/start - Start the bot\n` +
        `/test - Test bot connection\n` +
        `/contact - Share your contact info\n` +
        `/balance - Check your balance\n` +
        `/menu - Check menu button status\n\n` +
        `🎯 *Tips:*\n` +
        `• Use the menu button (🎲) at bottom of chat for best experience\n` +
        `• Share contact for phone number features`,
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

// Contact sharing command
bot.onText(/\/contact/, async (msg) => {
  console.log('📨 Received /contact command from user:', msg.from.id);
  const chatId = msg.chat.id;
  
  try {
    const keyboard = {
      keyboard: [
        [
          { text: '📱 Share My Contact', request_contact: true }
        ],
        [
          { text: '❌ Cancel' }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    };
    
    await bot.sendMessage(chatId, 
      '📱 *Share Your Contact*\n\n' +
      'Sharing your contact will help us provide better service and enable phone number features.\n\n' +
      'Click the button below to share your contact information:',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
    
    console.log('✅ Contact request sent successfully');
  } catch (error) {
    console.error('❌ Error in /contact command:', error);
  }
});

// Simple test command
bot.onText(/\/test/, async (msg) => {
  console.log('📨 Received /test command from user:', msg.from.id);
  const chatId = msg.chat.id;
  
  try {
    await bot.sendMessage(chatId, '✅ Bot is working! Server time: ' + new Date().toISOString());
    console.log('✅ Test message sent successfully');
  } catch (error) {
    console.error('❌ Error in /test command:', error);
  }
});

// Menu button test command
bot.onText(/\/menu/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const menuButton = await bot.getChatMenuButton({ chat_id: chatId });
    bot.sendMessage(chatId, 
      `🔍 *Menu Button Status:*\n\n` +
      `Type: ${menuButton.type}\n` +
      `Text: ${menuButton.text || 'Not set'}\n` +
      `URL: ${menuButton.web_app?.url || 'Not set'}\n\n` +
      `Look for the 🎲 button at the bottom of the chat!`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error checking menu button: ${error.message}`);
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

// Play command - direct web app access with user data
bot.onText(/\/play/, async (msg) => {
  console.log('📨 Received /play command from user:', msg.from.id);
  
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || 'User';

  try {
    const webAppUrl = process.env.WEB_APP_URL || 'https://kelalbingo-telegram.onrender.com';

    const playMessage = `
🎮 *Ready to Play KELALBINGO!*

Hello ${username}! 👋

📱 *User Info:*
• ID: \`${userId}\`
• Username: ${msg.from.username ? `@${msg.from.username}` : 'Not set'}
• Name: ${msg.from.first_name} ${msg.from.last_name || ''}

🎯 Click the button below to start playing:
    `;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '🎲 Play KELALBINGO',
            web_app: { 
              url: webAppUrl + '?source=play_command&user_id=' + userId + 
                   '&username=' + encodeURIComponent(msg.from.username || '') + 
                   '&first_name=' + encodeURIComponent(msg.from.first_name || '') +
                   '&last_name=' + encodeURIComponent(msg.from.last_name || '')
            }
          }
        ],
        [
          { text: '💰 Check Balance', callback_data: 'check_balance' },
          { text: '📊 My Stats', callback_data: 'my_stats' }
        ]
      ]
    };

    await bot.sendMessage(chatId, playMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    console.log('✅ Play message sent successfully to user:', userId);
    
  } catch (error) {
    console.error('❌ Error in /play command:', error);
    
    // Send a simple fallback message
    try {
      await bot.sendMessage(chatId, '🎮 Welcome to KELALBINGO!\n\nSorry, there was an error. Please try the menu button at the bottom of the chat.');
    } catch (fallbackError) {
      console.error('❌ Fallback message also failed:', fallbackError);
    }
  }
});

console.log('✅ Telegram Bot commands registered');

module.exports = bot;
