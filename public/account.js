// Account page specific JavaScript

// Global variables
let tg = null;
let currentUser = null;

// API URL
const API_URL = window.location.origin + '/api';

// Debug log function
function debugLog(message) {
    console.log('[Account] ' + message);
}

// Wait for Telegram WebApp
function waitForTelegram() {
    return new Promise((resolve) => {
        if (window.Telegram && window.Telegram.WebApp) {
            resolve(window.Telegram.WebApp);
            return;
        }
        
        const checkInterval = setInterval(() => {
            if (window.Telegram && window.Telegram.WebApp) {
                clearInterval(checkInterval);
                resolve(window.Telegram.WebApp);
            }
        }, 100);
        
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve(null);
        }, 5000);
    });
}

// Initialize Telegram WebApp
async function initTelegram() {
    try {
        debugLog('🔄 Initializing Telegram WebApp...');
        
        tg = await waitForTelegram();
        
        if (tg && tg.ready) {
            tg.ready();
            tg.expand();
            
            if (tg.enableClosingConfirmation) {
                tg.enableClosingConfirmation();
            }
            
            // Get user data
            let attempts = 0;
            const maxAttempts = 15;
            
            while (attempts < maxAttempts && (!tg.initDataUnsafe || !tg.initDataUnsafe.user)) {
                await new Promise(resolve => setTimeout(resolve, 300));
                attempts++;
            }
            
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                const telegramUser = tg.initDataUnsafe.user;
                currentUser = {
                    id: telegramUser.id,
                    telegram_id: telegramUser.id,
                    username: telegramUser.username || null,
                    first_name: telegramUser.first_name || null,
                    last_name: telegramUser.last_name || null,
                    phone_number: telegramUser.phone_number || null,
                    language_code: telegramUser.language_code || 'en'
                };
                debugLog('✅ Telegram user loaded');
            } else {
                debugLog('⚠️ No user data found, creating fallback user');
                currentUser = {
                    id: Date.now(),
                    telegram_id: Date.now(),
                    username: null,
                    first_name: 'Account User',
                    last_name: null,
                    phone_number: null,
                    language_code: 'en'
                };
            }
            
            // Set theme
            if (tg.themeParams) {
                document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
                document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
            }
        } else {
            debugLog('❌ Telegram WebApp not available');
            currentUser = {
                id: Date.now(),
                telegram_id: Date.now(),
                username: null,
                first_name: 'Web User',
                last_name: null,
                phone_number: null,
                language_code: 'en'
            };
        }
        
    } catch (error) {
        debugLog('❌ Telegram init error: ' + error.message);
        currentUser = {
            id: Date.now(),
            telegram_id: Date.now(),
            username: null,
            first_name: 'Fallback User',
            last_name: null,
            phone_number: null,
            language_code: 'en'
        };
    }
}

// Update UI with user data
function updateUI(user, balance) {
    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        let displayName = user.first_name || user.username || 'Guest User';
        
        if (user.first_name && user.username) {
            displayName = `${user.first_name} (@${user.username})`;
        } else if (user.username && !user.first_name) {
            displayName = `@${user.username}`;
        }
        
        usernameElement.textContent = displayName;
    }
    
    const balanceElement = document.getElementById('balance');
    const profitElement = document.getElementById('profit');
    
    if (balanceElement) {
        balanceElement.textContent = balance.balance || 0;
    }
    if (profitElement) {
        profitElement.textContent = balance.profit || 0;
    }
}

// Update profile information
function updateProfileInfo() {
    if (currentUser) {
        const profileName = document.getElementById('profile-name');
        const profileUsername = document.getElementById('profile-username');
        const profileAvatar = document.getElementById('profile-avatar-text');
        
        if (profileName) {
            profileName.textContent = currentUser.first_name || 'User';
        }
        
        if (profileUsername) {
            profileUsername.textContent = currentUser.username ? '@' + currentUser.username : '@user';
        }
        
        if (profileAvatar) {
            profileAvatar.textContent = (currentUser.first_name || 'User').charAt(0).toUpperCase();
        }
    }
}

// Load account data
async function loadAccountData() {
    try {
        debugLog('📊 Loading account data...');
        
        // Load user statistics
        const statsResponse = await fetch(`${API_URL}/game/stats`, {
            headers: {
                'X-Telegram-User-Id': (currentUser && currentUser.telegram_id) || 1
            }
        });
        
        if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            updateAccountStats(statsData.stats);
        }
        
        // Load game history
        const historyResponse = await fetch(`${API_URL}/game/history`, {
            headers: {
                'X-Telegram-User-Id': (currentUser && currentUser.telegram_id) || 1
            }
        });
        
        if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            updateAccountHistory(historyData.history);
        }
        
        // Update profile information
        updateProfileInfo();
        
    } catch (error) {
        debugLog('❌ Error loading account data: ' + error.message);
    }
}

// Update account statistics
function updateAccountStats(stats) {
    const elements = {
        'total-games': stats.total_games || 0,
        'total-bet': (stats.total_bet || 0) + ' Birr',
        'total-payout': (stats.total_payout || 0) + ' Birr',
        'total-profit': (stats.total_profit || 0) + ' Birr',
        'account-balance': (stats.balance || 0) + ' Birr',
        'account-profit': (stats.total_profit || 0) + ' Birr'
    };
    
    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = elements[id];
        }
    });
}

// Update account history
function updateAccountHistory(history) {
    const historyList = document.getElementById('account-history-list');
    if (!historyList) return;
    
    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-state">No games played yet</p>';
        return;
    }
    
    historyList.innerHTML = history.slice(0, 10).map(game => `
        <div class="history-item">
            <div class="round">Round ${game.round_number}</div>
            <div>Cards: ${game.cards_count} | Bet: ${game.bet_amount} Birr</div>
            <div class="${game.profit >= 0 ? 'profit' : 'loss'}">
                ${game.profit >= 0 ? '+' : ''}${game.profit} Birr
            </div>
        </div>
    `).join('');
}

// Register user
async function registerUser(user) {
    try {
        debugLog('📝 Registering user: ' + JSON.stringify(user));

        const userData = { user };

        if (tg && tg.initData) {
            userData.initData = tg.initData;
        }

        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': user.telegram_id,
                'X-Telegram-Init-Data': (tg && tg.initData) || ''
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            const data = await response.json();
            debugLog('✅ Registration successful: ' + JSON.stringify(data));

            if (data.user && data.balance) {
                currentUser = {
                    ...currentUser,
                    ...data.user
                };

                updateUI(currentUser, data.balance);
                debugLog('✅ UI updated with server user data');
            }
        } else {
            const errorText = await response.text();
            debugLog('❌ Registration failed: ' + errorText);
        }
    } catch (error) {
        debugLog('❌ Register error: ' + error.message);
    }
}

// Initialize account page
async function initAccountPage() {
    debugLog('🚀 Account page init started');
    
    await initTelegram();
    
    if (currentUser) {
        updateUI(currentUser, { balance: 0, profit: 0 });
        
        loadAccountData();
        registerUser(currentUser);
    }
    
    debugLog('✅ Account page init completed');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccountPage);
} else {
    initAccountPage();
}
