# 🚀 Deployment Guide - KELALBINGO Telegram Web App

## ✅ Current Status

Your app is deployed at: **https://kelalbingo-telegram.onrender.com**

## 📋 Setup Checklist

### 1. Get Production Database URL

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on your PostgreSQL database (`kelalbingo-db`)
3. Copy the **Internal Database URL** (starts with `postgresql://`)
4. It looks like: `postgresql://user:password@host:5432/database`

### 2. Initialize Production Database

Run this command from your local machine:

```bash
cd telegram-bingo-app
node scripts/setup-production.js "YOUR_DATABASE_URL_HERE"
```

Replace `YOUR_DATABASE_URL_HERE` with the URL from step 1.

**Example:**
```bash
node scripts/setup-production.js "postgresql://kelalbingo_user:abc123@dpg-xyz.oregon-postgres.render.com:5432/kelalbingo_db"
```

### 3. Update Render Environment Variables

Go to Render Dashboard → Your Web Service → Environment:

Add/Update these variables:
```
TELEGRAM_BOT_TOKEN=8594966035:AAGiaSqP7vYbL0NIGC2H1RpxCeu-PxHnFPE
DATABASE_URL=[Your Internal Database URL]
NODE_ENV=production
WEB_APP_URL=https://kelalbingo-telegram.onrender.com
```

Click "Save Changes" (app will redeploy automatically).

### 4. Configure Telegram Bot

Open Telegram and message **@BotFather**:

#### Set Menu Button
```
/setmenubutton
```
- Select: `@kelalbingo_bot`
- Choose: "Edit menu button URL"
- Enter: `https://kelalbingo-telegram.onrender.com`
- Button text: `🎲 Play Bingo`

#### Set Bot Commands
```
/setcommands
```
- Select: `@kelalbingo_bot`
- Paste this:
```
start - Start the bot
balance - Check your balance
stats - View your statistics
help - Get help
```

#### Set Bot Description
```
/setdescription
```
- Select: `@kelalbingo_bot`
- Enter: `Play bingo, win prizes, and have fun! 🎮`

### 5. Test Your Bot

1. Open Telegram
2. Search for `@kelalbingo_bot`
3. Send `/start`
4. Click "🎲 Play Bingo" button
5. Web app should open!

## 🔍 Troubleshooting

### Database Connection Error
- Verify DATABASE_URL is correct in Render environment
- Make sure you used the **Internal Database URL** (not External)
- Check database is running in Render dashboard

### Bot Not Responding
- Verify TELEGRAM_BOT_TOKEN in Render environment
- Check logs in Render dashboard for errors
- Make sure bot is not running locally (stop local server)

### Web App Not Loading
- Check WEB_APP_URL is set correctly
- View logs in Render: Dashboard → Your Service → Logs
- Try accessing the URL directly in browser

### App Sleeping (Free Tier)
- Render free tier spins down after 15 minutes
- First request takes ~30 seconds to wake up
- Consider upgrading to paid tier for always-on service

## 📊 Monitoring

### View Logs
```
Render Dashboard → Your Service → Logs
```

### Check Database
```
Render Dashboard → Your Database → Connect
```

### Health Check
Visit: `https://kelalbingo-telegram.onrender.com/health`

Should return:
```json
{
  "status": "ok",
  "timestamp": "2026-05-01T..."
}
```

## 🔐 Security Notes

- Never commit `.env` file to GitHub
- Keep your bot token secret
- Use environment variables in Render for all secrets
- Database URL contains password - keep it private

## 📈 Next Steps

1. ✅ Import bingo cards from CSV
2. ✅ Implement game logic
3. ✅ Add payment integration
4. ✅ Create admin panel
5. ✅ Add analytics

## 🆘 Need Help?

Check the logs first:
```
Render Dashboard → Logs
```

Common issues:
- Database not initialized → Run setup-production.js
- Bot token invalid → Check environment variables
- App not responding → Check if it's sleeping (free tier)

## 📞 Support

- Telegram: @kelalbingo_bot
- GitHub: https://github.com/abeni-the-owner/kelalbingo-telegram
