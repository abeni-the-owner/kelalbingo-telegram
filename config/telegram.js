const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

console.log('🔄 Initializing Telegram Bot...');
console.log('📱 Bot Token:', process.env.TELEGRAM_BOT_TOKEN ? 'Present' : 'Missing');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: true 
});

bot.on('polling_error', (error) => {
  console.error('❌ Telegram polling error:', error.message);
  console.error('Full error:', error);
});

bot.on('error', (error) => {
  console.error('❌ Telegram bot error:', error.message);
});

// Test bot connection
bot.getMe().then((botInfo) => {
  console.log('✅ Telegram Bot connected successfully!');
  console.log('🤖 Bot info:', {
    id: botInfo.id,
    username: botInfo.username,
    first_name: botInfo.first_name
  });
}).catch((error) => {
  console.error('❌ Failed to connect to Telegram:', error.message);
});

console.log('✅ Telegram Bot initialized');

module.exports = bot;
