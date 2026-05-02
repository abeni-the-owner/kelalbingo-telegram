# Telegram Mini App Setup Guide

## Issue: User data not being fetched

The problem is that the Telegram Mini App needs to be properly configured with BotFather to pass user data.

## Step-by-Step Setup

### 1. Configure Mini App with BotFather

1. **Open Telegram and find @BotFather**
2. **Send `/mybots`**
3. **Select your bot: @kelalbingo_bot**
4. **Select "Bot Settings"**
5. **Select "Menu Button"**
6. **Choose "Configure Menu Button"**
7. **Set Menu Button URL to:** `https://kelalbingo-telegram.onrender.com`
8. **Set Menu Button Text to:** `🎲 Play Bingo`

### 2. Alternative: Set Web App URL

If the above doesn't work, try this:

1. **Send `/setmenubutton` to @BotFather**
2. **Select your bot: @kelalbingo_bot**
3. **Send the URL:** `https://kelalbingo-telegram.onrender.com`
4. **Send the button text:** `🎲 Play Bingo`

### 3. Test the Configuration

1. **Go to your bot @kelalbingo_bot**
2. **Send `/start`**
3. **You should see a menu button at the bottom**
4. **Click the menu button (not inline keyboard)**

### 4. Diagnostic URLs

Test these URLs to debug the issue:

- **Diagnostics:** `https://kelalbingo-telegram.onrender.com/diagnose.html`
- **Debug:** `https://kelalbingo-telegram.onrender.com/debug.html`
- **Telegram Test:** `https://kelalbingo-telegram.onrender.com/telegram-test.html`

### 5. Common Issues

#### Issue: "User" instead of real username
**Cause:** Mini App not properly configured with BotFather
**Solution:** Follow steps 1-2 above

#### Issue: No user data in initDataUnsafe
**Cause:** App opened in browser instead of Telegram
**Solution:** Must open through Telegram bot menu button

#### Issue: "Loading cards..." forever
**Cause:** Server connection issues or JavaScript errors
**Solution:** Check diagnostics page for errors

### 6. Verification Steps

After setup, the app should show:
- ✅ Real Telegram username (not "User")
- ✅ Telegram ID in debug log
- ✅ Cards loading properly
- ✅ User data in diagnostics

### 7. Important Notes

- **Mini Apps only work in Telegram app** (not web browser)
- **User data only available when opened through bot menu**
- **Menu button is different from inline keyboard buttons**
- **BotFather configuration is required for user data**

## Current Bot Configuration

- **Bot Token:** `8594966035:AAGiaSqP7vYbL0NIGC2H1RpxCeu-PxHnFPE`
- **Bot Username:** `@kelalbingo_bot`
- **Web App URL:** `https://kelalbingo-telegram.onrender.com`

## Testing Commands

Send these to your bot to test:
- `/start` - Should show menu button
- `/mybots` - To BotFather to configure
- `/setmenubutton` - To BotFather to set menu button