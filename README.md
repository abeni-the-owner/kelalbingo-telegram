# 🎮 KELALBINGO - Telegram Web App

A multi-user bingo game built as a Telegram Mini App with Node.js backend and PostgreSQL database.

## 📋 Features

- ✅ Telegram authentication
- ✅ User balance management
- ✅ Bingo card selection
- ✅ Game history tracking
- ✅ Real-time statistics
- ✅ Multi-user support
- ✅ Responsive design

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed
- PostgreSQL database
- Telegram Bot Token

### 1. Create Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow instructions
3. Save your bot token
4. Send `/setmenubutton` to add Web App button
5. Send your bot username
6. Choose "Edit menu button URL"
7. Enter your web app URL (after deployment)

### 2. Setup Database

```bash
# Install PostgreSQL (if not installed)
# Windows: Download from postgresql.org
# Mac: brew install postgresql
# Linux: sudo apt-get install postgresql

# Create database
createdb telegram_bingo

# Or using psql
psql -U postgres
CREATE DATABASE telegram_bingo;
\q
```

### 3. Install Dependencies

```bash
cd telegram-bingo-app
npm install
```

### 4. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your values
```

Required environment variables:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
DATABASE_URL=postgresql://username:password@localhost:5432/telegram_bingo
PORT=3000
```

### 5. Initialize Database

```bash
npm run init-db
```

### 6. Start Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📁 Project Structure

```
telegram-bingo-app/
├── bot/
│   └── bot.js              # Telegram bot handlers
├── config/
│   ├── database.js         # Database connection
│   └── telegram.js         # Telegram bot config
├── middleware/
│   └── auth.js             # Authentication middleware
├── public/
│   ├── index.html          # Web app UI
│   ├── styles.css          # Styles
│   └── app.js              # Frontend logic
├── routes/
│   ├── auth.js             # Authentication routes
│   ├── users.js            # User management
│   ├── balance.js          # Balance operations
│   ├── game.js             # Game logic
│   └── cards.js            # Bingo cards
├── scripts/
│   └── init-database.js    # Database initialization
├── server.js               # Main server file
├── package.json
└── .env.example
```

## 🗄️ Database Schema

### Tables

- **users** - User accounts with Telegram data
- **balances** - User balance and profit tracking
- **transactions** - Financial transaction history
- **game_history** - Game results and statistics
- **bingo_cards** - Bingo card data (5x5 grids)
- **user_cards** - Cards assigned to users per round
- **game_rounds** - Active game rounds

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Login/register user

### Users
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update user info

### Balance
- `GET /api/balance` - Get balance
- `POST /api/balance/add` - Add balance
- `GET /api/balance/transactions` - Get transactions

### Game
- `GET /api/game/round` - Get current round
- `POST /api/game/result` - Store game result
- `GET /api/game/history` - Get game history
- `GET /api/game/stats` - Get statistics

### Cards
- `GET /api/cards` - Get all cards
- `GET /api/cards/my-cards` - Get user's cards
- `POST /api/cards/select` - Select card

## 🚀 Deployment

### Option 1: Render.com

1. Create account on [Render.com](https://render.com)
2. Create new Web Service
3. Connect your GitHub repository
4. Add environment variables
5. Deploy

### Option 2: Railway.app

1. Create account on [Railway.app](https://railway.app)
2. Create new project
3. Add PostgreSQL database
4. Deploy from GitHub
5. Add environment variables

### Option 3: Heroku

```bash
# Install Heroku CLI
heroku login
heroku create your-app-name
heroku addons:create heroku-postgresql:hobby-dev
git push heroku main
```

## 🔧 Configuration

### Telegram Bot Commands

Set these commands in BotFather using `/setcommands`:

```
start - Start the bot
balance - Check your balance
stats - View your statistics
help - Get help
```

### Web App Button

In BotFather, use `/setmenubutton`:
- Button text: "🎲 Play Bingo"
- Web App URL: Your deployed URL

## 📱 Testing

1. Open your bot in Telegram
2. Send `/start`
3. Click "Play Bingo" button
4. Web app should open

## 🛠️ Development

```bash
# Run in development mode with auto-reload
npm run dev

# Initialize/reset database
npm run init-db
```

## 🔒 Security

- Telegram Web App data verification
- PostgreSQL with SSL in production
- Rate limiting on API endpoints
- Helmet.js for security headers
- Input validation and sanitization

## 📝 Next Steps

1. ✅ Add bingo card CSV import
2. ✅ Implement actual game logic
3. ✅ Add payment integration
4. ✅ Add admin panel
5. ✅ Add voice callouts
6. ✅ Add multiplayer features

## 🐛 Troubleshooting

**Database connection error:**
- Check DATABASE_URL in .env
- Ensure PostgreSQL is running
- Verify database exists

**Bot not responding:**
- Check TELEGRAM_BOT_TOKEN
- Ensure bot is not already running elsewhere
- Check bot permissions

**Web app not loading:**
- Check WEB_APP_URL is correct
- Ensure HTTPS in production
- Check browser console for errors

## 📄 License

ISC

## 👤 Author

ABENEZER ANDUALEM
