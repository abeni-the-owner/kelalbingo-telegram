const crypto = require('crypto');

// Verify Telegram Web App data
const verifyTelegramWebAppData = (req, res, next) => {
  try {
    const initData = req.headers['x-telegram-init-data'] || req.body.initData;
    
    if (!initData) {
      return res.status(401).json({ error: 'Missing Telegram authentication data' });
    }

    // Parse init data
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // Sort parameters
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Create secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.TELEGRAM_BOT_TOKEN)
      .digest();

    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash
    if (calculatedHash !== hash) {
      return res.status(401).json({ error: 'Invalid Telegram authentication' });
    }

    // Parse user data
    const userJson = params.get('user');
    if (userJson) {
      req.telegramUser = JSON.parse(userJson);
    }

    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Simple auth middleware for development
const simpleAuth = (req, res, next) => {
  const telegramId = req.headers['x-telegram-user-id'];
  
  if (!telegramId) {
    return res.status(401).json({ error: 'Missing user ID' });
  }

  req.telegramUser = { id: parseInt(telegramId) };
  next();
};

module.exports = {
  verifyTelegramWebAppData,
  simpleAuth
};
