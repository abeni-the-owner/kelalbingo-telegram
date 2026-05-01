const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: true 
});

bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error);
});

console.log('✅ Telegram Bot initialized');

module.exports = bot;
