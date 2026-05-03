// Referral page specific JavaScript

// Global variables
let tg = null;
let currentUser = null;

// API URL
const API_URL = window.location.origin + '/api';

// Debug log function
function debugLog(message) {
    console.log('[Referral] ' + message);
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
                    first_name: 'Referral User',
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
}

// Load referral data
async function loadReferralData() {
    try {
        debugLog('🎁 Loading referral data...');
        
        if (!currentUser) {
            debugLog('⚠️ No user data available for referral');
            return;
        }
        
        const response = await fetch(`${API_URL}/referral/my-referral`, {
            headers: {
                'X-Telegram-User-Id': currentUser.telegram_id
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            debugLog('✅ Referral data loaded: ' + JSON.stringify(data));
            
            updateReferralCode(data.referral_code, data.referral_link);
            updateReferralStats(data.stats);
            updateReferralList(data.referrals);
        } else {
            throw new Error('Failed to load referral data');
        }
        
    } catch (error) {
        debugLog('❌ Error loading referral data: ' + error.message);
        
        // Fallback to generated code if API fails
        if (currentUser) {
            const referralCode = generateReferralCode(currentUser.telegram_id);
            const referralLink = `https://t.me/kelalbingo_bot?start=${referralCode}`;
            
            updateReferralCode(referralCode, referralLink);
            updateReferralStats({
                total_referrals: 0,
                referral_bonus: 0,
                active_referrals: 0
            });
            updateReferralList([]);
        }
    }
}

// Generate referral code
function generateReferralCode(userId) {
    return 'REF' + userId.toString().padStart(6, '0');
}

// Update referral code and link
function updateReferralCode(code, link) {
    const codeElement = document.getElementById('referral-code');
    const linkElement = document.getElementById('referral-link');
    
    if (codeElement) {
        codeElement.textContent = code;
    }
    
    if (linkElement) {
        linkElement.textContent = link;
    }
    
    setupCopyButtons();
}

// Update referral statistics
function updateReferralStats(stats) {
    const elements = {
        'total-referrals': stats.total_referrals,
        'referral-bonus': stats.referral_bonus + ' Birr',
        'active-referrals': stats.active_referrals
    };
    
    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = elements[id];
        }
    });
}

// Update referral list
function updateReferralList(referrals) {
    const listContent = document.getElementById('referral-list-content');
    if (!listContent) return;
    
    if (referrals.length === 0) {
        listContent.innerHTML = '<p class="empty-state">No referrals yet. Start inviting friends!</p>';
        return;
    }
    
    listContent.innerHTML = referrals.map(referral => `
        <div class="referral-item">
            <div class="referral-name">${referral.first_name || 'Anonymous'}</div>
            <div class="referral-date">${new Date(referral.created_at).toLocaleDateString()}</div>
            <div class="referral-status ${referral.active ? 'active' : 'inactive'}">
                ${referral.active ? 'Active' : 'Inactive'}
            </div>
        </div>
    `).join('');
}

// Setup copy buttons
function setupCopyButtons() {
    const copyReferralBtn = document.getElementById('copy-referral-btn');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    
    if (copyReferralBtn) {
        copyReferralBtn.addEventListener('click', async () => {
            const code = document.getElementById('referral-code').textContent;
            await copyToClipboard(code);
            showNotification('Referral code copied!');
        });
    }
    
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', async () => {
            const link = document.getElementById('referral-link').textContent;
            await copyToClipboard(link);
            showNotification('Referral link copied!');
        });
    }
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

// Show notification
function showNotification(message) {
    if (tg && tg.showAlert) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
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

// Initialize referral page
async function initReferralPage() {
    debugLog('🚀 Referral page init started');
    
    await initTelegram();
    
    if (currentUser) {
        updateUI(currentUser, { balance: 0, profit: 0 });
        
        loadReferralData();
        registerUser(currentUser);
    }
    
    debugLog('✅ Referral page init completed');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReferralPage);
} else {
    initReferralPage();
}
