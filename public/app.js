// Initialize Telegram Web App with better user data handling
let tg = null;
let telegramUser = null;
let isInitialized = false;

function waitForTelegram() {
    return new Promise((resolve) => {
        // Check if Telegram is already available
        if (window.Telegram && window.Telegram.WebApp) {
            resolve(window.Telegram.WebApp);
            return;
        }

        // Wait for Telegram to load
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max

        const checkTelegram = () => {
            attempts++;
            if (window.Telegram && window.Telegram.WebApp) {
                resolve(window.Telegram.WebApp);
            } else if (attempts < maxAttempts) {
                setTimeout(checkTelegram, 100);
            } else {
                // Timeout - create fallback
                resolve({
                    initDataUnsafe: {},
                    ready: () => {},
                    expand: () => {},
                    showAlert: (msg) => alert(msg),
                    enableClosingConfirmation: () => {}
                });
            }
        };

        setTimeout(checkTelegram, 100);
    });
}

async function initTelegram() {
    try {
        debugLog('🔄 Waiting for Telegram WebApp...');

        // Wait for Telegram to be available
        tg = await waitForTelegram();

        if (tg && tg.ready) {
            debugLog('✅ Telegram WebApp found');

            // Initialize Telegram WebApp
            tg.ready();
            tg.expand();

            // Enable closing confirmation if available
            if (tg.enableClosingConfirmation) {
                tg.enableClosingConfirmation();
            }

            // Get user data with multiple attempts and better debugging
            let attempts = 0;
            const maxAttempts = 15; // Increased attempts

            debugLog('🔍 Checking for user data...');
            debugLog('🔍 Initial initDataUnsafe: ' + JSON.stringify(tg.initDataUnsafe));

            while (attempts < maxAttempts && (!tg.initDataUnsafe || !tg.initDataUnsafe.user)) {
                debugLog(`🔄 Attempt ${attempts + 1}/${maxAttempts}: Waiting for user data...`);
                await new Promise(resolve => setTimeout(resolve, 300)); // Increased wait time
                attempts++;

                // Log what we have so far
                if (tg.initDataUnsafe) {
                    debugLog('🔍 Available keys: ' + Object.keys(tg.initDataUnsafe).join(', '));
                }
            }

            // Get user data
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                telegramUser = tg.initDataUnsafe.user;
                debugLog('✅ Telegram user found after ' + attempts + ' attempts');
                debugLog('📱 User ID: ' + telegramUser.id);
                debugLog('👤 Username: ' + (telegramUser.username || 'Not set'));
                debugLog('👤 First name: ' + (telegramUser.first_name || 'Not set'));
                debugLog('👤 Last name: ' + (telegramUser.last_name || 'Not set'));
                debugLog('📞 Phone: ' + (telegramUser.phone_number || 'Not provided'));
                debugLog('🌐 Language: ' + (telegramUser.language_code || 'Not set'));

                // Validate init data
                if (tg.initData) {
                    debugLog('✅ Init data available: ' + tg.initData.length + ' chars');
                } else {
                    debugLog('⚠️ No init data - running in test mode');
                }
            } else {
                debugLog('⚠️ No user data in initDataUnsafe after ' + attempts + ' attempts');
                debugLog('🔍 Final initDataUnsafe state: ' + JSON.stringify(tg.initDataUnsafe));

                // Try alternative methods to get user data
                if (tg.WebAppUser) {
                    telegramUser = tg.WebAppUser;
                    debugLog('✅ Found user in WebAppUser: ' + JSON.stringify(telegramUser));
                } else if (tg.initDataUnsafe && Object.keys(tg.initDataUnsafe).length > 0) {
                    debugLog('🔍 InitDataUnsafe has data but no user: ' + JSON.stringify(tg.initDataUnsafe));
                }
            }

            // Set theme if available
            if (tg.themeParams) {
                document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
                document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
            }

        } else {
            debugLog('❌ Telegram WebApp not available - using fallback');
        }

        isInitialized = true;

    } catch (error) {
        debugLog('❌ Telegram init error: ' + error.message);
        isInitialized = true;

        // Create fallback tg object
        tg = {
            initDataUnsafe: {},
            ready: () => {},
            expand: () => {},
            showAlert: (msg) => alert(msg),
            enableClosingConfirmation: () => {}
        };
    }
}

// API Configuration
const API_URL = window.location.origin + '/api';

// Initialize Socket.IO with better error handling
let socket = null;
let socketReady = false;

function initSocket() {
    try {
        if (typeof io !== 'undefined') {
            socket = io(window.location.origin, {
                transports: ['websocket', 'polling'],
                timeout: 5000,
                forceNew: true
            });

            socket.on('connect', () => {
                socketReady = true;
                console.log('🔌 Socket connected');
            });

            socket.on('connect_error', (error) => {
                console.error('Socket error:', error);
                socketReady = false;
            });
        } else {
            console.warn('Socket.IO not available, using fallback mode');
        }
    } catch (e) {
        console.error('Socket.IO initialization error:', e);
    }

    // Create fallback socket object
    if (!socket) {
        socket = {
            on: () => {},
            emit: () => {},
            connected: false
        };
    }
}

// State
let currentUser = null;
let selectedCards = [];
let currentRound = 1;
let allCards = [];
let takenCards = {};

// Debug on screen
function debugLog(message) {
    console.log(message);
    try {
        const debugEl = document.getElementById('debug-log');
        if (debugEl) {
            debugEl.innerHTML += message + '<br>';
            debugEl.scrollTop = debugEl.scrollHeight;
        }
    } catch (e) {
        console.error('Debug log error:', e);
    }
}

// Show interface immediately - no delays
debugLog('🎮 KELALBINGO Starting...');

// Force show game screen immediately
function forceShowInterface() {
    debugLog('📺 Showing screen: game-screen');
    try {
        // Hide loading screen
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
            loading.classList.remove('active');
        }

        // Show game screen
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) {
            gameScreen.style.display = 'block';
            gameScreen.classList.add('active');
            debugLog('✅ Showing: game-screen');
        } else {
            debugLog('❌ Game screen not found');
        }
    } catch (e) {
        debugLog('❌ Error showing interface: ' + e.message);
    }
}

// Show interface immediately when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceShowInterface);
} else {
    forceShowInterface();
}

// Initialize app
async function init() {
    debugLog('🚀 Init started');

    // Wait for Telegram to be initialized
    if (!isInitialized) {
        debugLog('⏳ Waiting for Telegram initialization...');
        await initTelegram();
    }

    // Initialize Socket.IO
    initSocket();

    // Get user data from multiple sources with better debugging
    let user = null;

    debugLog('🔍 Checking user data sources...');

    // Method 1: Try Telegram WebApp user data (best method)
    if (telegramUser) {
        user = telegramUser;
        debugLog('✅ Using Telegram WebApp user: ' + JSON.stringify({
            id: user.id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name
        }));
    }
    // Method 2: Try URL parameters (fallback for inline buttons)
    else {
        debugLog('⚠️ No Telegram user data, checking URL parameters...');
        const urlParams = new URLSearchParams(window.location.search);
        const urlUserId = urlParams.get('user_id');
        const urlUsername = urlParams.get('username');
        const urlFirstName = urlParams.get('first_name');
        const urlLastName = urlParams.get('last_name');

        debugLog('🔗 URL params: ' + JSON.stringify({
            user_id: urlUserId,
            username: urlUsername,
            first_name: urlFirstName,
            last_name: urlLastName,
            source: urlParams.get('source')
        }));

        if (urlUserId) {
            user = {
                id: parseInt(urlUserId),
                username: urlUsername || null,
                first_name: urlFirstName || null,
                last_name: urlLastName || null,
                phone_number: null,
                language_code: 'en'
            };
            debugLog('✅ Using URL parameters user: ' + JSON.stringify(user));
        } else {
            // Method 3: Try to extract from Telegram init data string
            debugLog('⚠️ No URL params, trying to parse init data...');
            if (tg && tg.initData) {
                try {
                    const params = new URLSearchParams(tg.initData);
                    const userJson = params.get('user');
                    if (userJson) {
                        user = JSON.parse(userJson);
                        debugLog('✅ Extracted user from init data: ' + JSON.stringify(user));
                    }
                } catch (parseError) {
                    debugLog('❌ Failed to parse init data: ' + parseError.message);
                }
            }
        }
    }

    if (user) {
        currentUser = {
            id: user.id,
            telegram_id: user.id,
            username: user.username || null,
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            phone_number: user.phone_number || null,
            language_code: user.language_code || 'en'
        };

        // Display all available user info
        debugLog('📋 Final user object:');
        debugLog('  - ID: ' + currentUser.telegram_id);
        debugLog('  - Username: ' + (currentUser.username || 'Not set'));
        debugLog('  - First name: ' + (currentUser.first_name || 'Not set'));
        debugLog('  - Last name: ' + (currentUser.last_name || 'Not set'));
        debugLog('  - Phone: ' + (currentUser.phone_number || 'Not provided'));
        debugLog('  - Language: ' + currentUser.language_code);

    } else {
        debugLog('⚠️ No user data available from any source, trying server fallback...');

        // Try to get user data from server based on Telegram environment
        try {
            const response = await fetch('/api/user/current', {
                headers: {
                    'X-Telegram-Init-Data': (tg && tg.initData) || '',
                    'X-User-Agent': navigator.userAgent
                }
            });

            if (response.ok) {
                const serverUser = await response.json();
                if (serverUser && serverUser.user) {
                    debugLog('✅ Got user data from server: ' + JSON.stringify(serverUser.user));
                    currentUser = {
                        id: serverUser.user.telegram_id,
                        telegram_id: serverUser.user.telegram_id,
                        username: serverUser.user.username,
                        first_name: serverUser.user.first_name,
                        last_name: serverUser.user.last_name,
                        phone_number: serverUser.user.phone_number,
                        language_code: serverUser.user.language_code || 'en'
                    };
                } else {
                    throw new Error('No user data from server');
                }
            } else {
                throw new Error('Server request failed');
            }
        } catch (serverError) {
            debugLog('⚠️ Server fallback failed: ' + serverError.message);

            // Try to detect if we're in Telegram environment
            const userAgent = navigator.userAgent;
            const isTelegramApp = userAgent.includes('Telegram') ||
                window.location.href.includes('tgWebAppData') ||
                document.referrer.includes('telegram');

            debugLog('🔍 Environment check:');
            debugLog('  - User Agent: ' + userAgent);
            debugLog('  - URL: ' + window.location.href);
            debugLog('  - Referrer: ' + document.referrer);
            debugLog('  - Is Telegram App: ' + isTelegramApp);

            if (isTelegramApp) {
                debugLog('🔍 Detected Telegram environment but no user data');
                debugLog('🔍 This might be a Telegram WebApp configuration issue');

                // Create a more descriptive guest user for Telegram environment
                currentUser = {
                    id: Date.now(),
                    telegram_id: Date.now(),
                    username: null,
                    first_name: 'Telegram User',
                    last_name: null,
                    phone_number: null,
                    language_code: 'en'
                };
            } else {
                // Regular web browser
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

            debugLog('📋 Created fallback user: ' + JSON.stringify(currentUser));
        }
    }

    // Update UI immediately with all available info
    debugLog('🎨 Updating UI with user: ' + JSON.stringify({
        first_name: currentUser.first_name,
        username: currentUser.username
    }));

    // Force update the UI multiple times to ensure it sticks
    updateUI(currentUser, { balance: 0, profit: 0 });

    // Also update after a short delay to handle any timing issues
    setTimeout(() => {
        debugLog('🔄 Secondary UI update...');
        updateUI(currentUser, { balance: 0, profit: 0 });
    }, 500);

    // And one more time after 2 seconds
    setTimeout(() => {
        debugLog('🔄 Final UI update...');
        updateUI(currentUser, { balance: 0, profit: 0 });
    }, 2000);

    // Load data in background (don't wait)
    debugLog('📊 Loading data in background...');
    loadGameData().catch(err => {
        debugLog('❌ Load error: ' + err.message);
        // Generate sample cards as fallback
        generateSampleCards();
    });

    // Register user in background (don't wait)
    registerUser(currentUser).catch(err => {
        debugLog('❌ Register error: ' + err.message);
    });

    debugLog('✅ Init completed');
}

// Generate sample cards as fallback
function generateSampleCards() {
    debugLog('📊 Generating sample cards...');
    allCards = [];
    for (let i = 1; i <= 50; i++) {
        allCards.push({
            id: i,
            card_number: i,
            b_column: [1, 2, 3, 4, 5],
            i_column: [16, 17, 18, 19, 20],
            n_column: [31, 32, 0, 34, 35],
            g_column: [46, 47, 48, 49, 50],
            o_column: [61, 62, 63, 64, 65]
        });
    }
    displayCards(allCards);
    debugLog('✅ Sample cards generated');
}

// Register user in database (background task)
async function registerUser(user) {
    try {
        debugLog('📝 Registering user: ' + JSON.stringify(user));

        // Prepare user data for API
        const userData = { user };

        // Add Telegram init data if available
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
                // Update current user with server data
                currentUser = {
                    ...currentUser,
                    ...data.user
                };

                // Force UI update with complete user data
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

// Load cards from server
async function loadCards() {
    try {
        debugLog('� Loading cards from server...');
        const response = await fetch(`${API_URL}/cards`, {
            headers: {
                'X-Telegram-User-Id': (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || (currentUser && currentUser.telegram_id) || 1
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        allCards = data.cards; // Store globally

        // Also load user's selected cards
        await loadMyCards();

        displayCards(data.cards);
        debugLog('✅ Cards loaded from server');
    } catch (error) {
        debugLog('❌ Server cards failed: ' + error.message);
        console.error('Load cards error:', error);

        // Use sample cards as fallback
        generateSampleCards();

        const container = document.getElementById('cards-grid');
        if (container && allCards.length === 0) {
            container.innerHTML = `<p class="error">Using sample cards. <button onclick="loadCards()" class="btn btn-secondary">Retry Server</button></p>`;
        }
    }
}

// Load user's selected cards
async function loadMyCards() {
    try {
        const response = await fetch(`${API_URL}/cards/my-cards`, {
            headers: {
                'X-Telegram-User-Id': (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || 1
            }
        });
        const data = await response.json();

        // Update selected cards array
        selectedCards = data.cards.map(card => ({
            id: card.id,
            number: card.card_number
        }));

        updateSelectedCards();
        updateStartButton();
    } catch (error) {
        console.error('Load my cards error:', error);
    }
}

// Toggle card selection (real-time via WebSocket, no database)
function toggleCardSelection(cardId, cardNumber) {
    const myUserId = (currentUser && currentUser.telegram_id) || (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id);

    // Check if card is taken by someone else
    if (takenCards[cardId] && takenCards[cardId] !== myUserId) {
        const alertMsg = `Card #${cardNumber} is already selected by another player`;

        // ...
        // Use version-compatible alert
        if (tg && tg.showAlert && typeof tg.showAlert === 'function') {
            try {
                tg.showAlert(alertMsg);
            } catch (e) {
                alert(alertMsg);
            }
        } else {
            alert(alertMsg);
        }
        return;
    }

    const cardIndex = selectedCards.findIndex(c => c.id === cardId);

    if (cardIndex > -1) {
        // Deselect this specific card
        selectedCards.splice(cardIndex, 1);

        // Remove from taken cards
        delete takenCards[cardId];

        // Emit to server (real-time) - only if socket is ready
        if (socketReady && socket) {
            socket.emit('deselect-card', {
                roundNumber: currentRound,
                cardId: cardId,
                cardNumber: cardNumber,
                userId: myUserId
            });
        }

        debugLog(`➖ Deselected card #${cardNumber}`);
    } else {
        // Select card
        selectedCards.push({ id: cardId, number: cardNumber });

        // Mark as taken by me
        takenCards[cardId] = myUserId;

        // Emit to server (real-time) - only if socket is ready
        if (socketReady && socket) {
            socket.emit('select-card', {
                roundNumber: currentRound,
                cardId: cardId,
                cardNumber: cardNumber,
                userId: myUserId
            });
        }

        debugLog(`➕ Selected card #${cardNumber}`);
    }

    updateSelectedCards();
    updateStartButton();
    displayCards(allCards);
}

// View card details
function viewCard(cardId) {
    const card = allCards.find(c => c.id === cardId);
    if (!card) {
        console.error('Card not found:', cardId);
        return;
    }

    const modalHtml = `
        <div class="modal" id="card-modal" onclick="closeModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Card #${card.card_number}</h3>
                    <button class="close-btn" onclick="closeModal()">×</button>
                </div>
                <div class="bingo-card">
                    <div class="bingo-header">
                        <div class="bingo-letter">B</div>
                        <div class="bingo-letter">I</div>
                        <div class="bingo-letter">N</div>
                        <div class="bingo-letter">G</div>
                        <div class="bingo-letter">O</div>
                    </div>
                    ${generateCardRows(card)}
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="selectCardFromModal(${card.id}, ${card.card_number})">
                        Select This Card
                    </button>
                    <button class="btn btn-secondary" onclick="closeModal()">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Generate card rows
function generateCardRows(card) {
    let html = '';
    for (let row = 0; row < 5; row++) {
        html += '<div class="bingo-row">';
        html += `<div class="bingo-cell">${card.b_column[row]}</div>`;
        html += `<div class="bingo-cell">${card.i_column[row]}</div>`;
        html += `<div class="bingo-cell ${card.n_column[row] === 0 ? 'free-space' : ''}">${card.n_column[row] === 0 ? 'FREE' : card.n_column[row]}</div>`;
        html += `<div class="bingo-cell">${card.g_column[row]}</div>`;
        html += `<div class="bingo-cell">${card.o_column[row]}</div>`;
        html += '</div>';
    }
    return html;
}

// Close modal
function closeModal() {
    const modal = document.getElementById('card-modal');
    if (modal) {
        modal.remove();
    }
}

// Select card from modal
function selectCardFromModal(cardId, cardNumber) {
    selectCard(cardId, cardNumber);
    closeModal();
    // Switch to play tab
    document.querySelector('[data-tab="play"]').click();
}

// Select card
function selectCard(cardId, cardNumber) {
    const cardIndex = selectedCards.findIndex(c => c.id === cardId);

    if (cardIndex > -1) {
        // Remove card
        selectedCards.splice(cardIndex, 1);
    } else {
        // Add card
        selectedCards.push({ id: cardId, number: cardNumber });
    }

    updateSelectedCards();
    updateStartButton();
}

// Update selected cards display
function updateSelectedCards() {
    const container = document.getElementById('selected-cards');

    if (selectedCards.length === 0) {
        container.innerHTML = '<p class="empty-state">No cards selected. Tap card numbers above to select.</p>';
        return;
    }

    container.innerHTML = selectedCards.map(card => `
        <div class="selected-card">
            <span>Card #${card.number}</span>
            <button class="remove-card" onclick="removeCard(${card.id})">✕</button>
        </div>
    `).join('');
}

// Remove card
function removeCard(cardId) {
    const card = selectedCards.find(c => c.id === cardId);
    if (card) {
        toggleCardSelection(cardId, card.number);
    }
}

// Update start button
function updateStartButton() {
    const btn = document.getElementById('start-game-btn');
    btn.disabled = selectedCards.length === 0;
}

// Load history
async function loadHistory() {
    try {
        const response = await fetch(`${API_URL}/game/history`, {
            headers: {
                'X-Telegram-User-Id': tg.initDataUnsafe.user.id
            }
        });
        const data = await response.json();
        displayHistory(data.history);
    } catch (error) {
        console.error('Load history error:', error);
    }
}

// Display history
function displayHistory(history) {
    const container = document.getElementById('history-list');

    if (history.length === 0) {
        container.innerHTML = '<p class="empty-state">No games played yet</p>';
        return;
    }

    container.innerHTML = history.map(game => `
        <div class="history-item">
            <div class="round">Round ${game.round_number}</div>
            <div>Cards: ${game.cards_count} | Bet: ${game.bet_amount} Birr</div>
            <div class="${game.profit >= 0 ? 'profit' : 'loss'}">
                ${game.profit >= 0 ? '+' : ''}${game.profit} Birr
            </div>
        </div>
    `).join('');
}

// Load stats
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/game/stats`, {
            headers: {
                'X-Telegram-User-Id': tg.initDataUnsafe.user.id
            }
        });
        const data = await response.json();
        displayStats(data.stats);
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// Display stats
function displayStats(stats) {
    const container = document.getElementById('stats');
    container.innerHTML = `
        <div class="stat-row">
            <span>Total Games:</span>
            <strong>${stats.total_games || 0}</strong>
        </div>
        <div class="stat-row">
            <span>Total Bet:</span>
            <strong>${stats.total_bet || 0} Birr</strong>
        </div>
        <div class="stat-row">
            <span>Total Payout:</span>
            <strong>${stats.total_payout || 0} Birr</strong>
        </div>
        <div class="stat-row">
            <span>Total Profit:</span>
            <strong class="${stats.total_profit >= 0 ? 'profit' : 'loss'}">
                ${stats.total_profit || 0} Birr
            </strong>
        </div>
    `;
}

// Show screen
function showScreen(screenId) {
    console.log('📺 Showing screen:', screenId);
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        console.log('  Hiding:', s.id);
    });
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
        console.log('  ✅ Showing:', screenId);
    } else {
        console.error('  ❌ Screen not found:', screenId);
    }
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});

// Start game button
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (selectedCards.length === 0) {
                const alertMsg = 'Please select at least one card';
                if (tg.showAlert) {
                    tg.showAlert(alertMsg);
                } else {
                    alert(alertMsg);
                }
                return;
            }
            const gameMsg = `Starting game with ${selectedCards.length} card(s)!\n\nGame functionality coming soon!`;
            if (tg.showAlert) {
                tg.showAlert(gameMsg);
            } else {
                alert(gameMsg);
            }
        });
    }
});

// Initialize on load - wait for DOM and Telegram
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async() => {
        await initTelegram();
        await init();
    });
} else {
    // DOM already loaded
    (async() => {
        await initTelegram();
        await init();
    })();
}


// Socket.IO real-time events
function setupSocketEvents() {
    if (!socket) return;

    socket.on('connect', () => {
        socketReady = true;
        debugLog('🔌 Connected to server');
        // Join current round room with user ID
        if (currentUser) {
            socket.emit('join-round', {
                roundNumber: currentRound,
                userId: currentUser.telegram_id
            });
        }
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        socketReady = false;
        debugLog('❌ Socket error: ' + error.message);
        // Continue without real-time features
    });

    socket.on('disconnect', () => {
        socketReady = false;
        debugLog('🔌 Disconnected from server');
    });

    // Receive current card selections when joining
    socket.on('current-selections', (selections) => {
        console.log('Current selections:', selections);
        const myUserId = (currentUser && currentUser.telegram_id) || (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id);

        // Clear and rebuild taken cards
        takenCards = {};
        selectedCards = [];

        // Process all selections
        Object.keys(selections).forEach(cardId => {
            const userId = selections[cardId];
            takenCards[parseInt(cardId)] = userId;

            // If it's my card, add to selected cards
            if (userId === myUserId) {
                const card = allCards.find(c => c.id === parseInt(cardId));
                if (card) {
                    selectedCards.push({ id: parseInt(cardId), number: card.card_number });
                }
            }
        });

        displayCards(allCards);
        updateSelectedCards();
        updateStartButton();
    });

    // Real-time: Card selected by any user
    socket.on('card-selected', (data) => {
        console.log('Card selected:', data);

        // Mark card as taken
        takenCards[data.cardId] = data.userId;

        // If it's my card, add to selected
        const myUserId = (currentUser && currentUser.telegram_id) || (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id);
        if (data.userId === myUserId) {
            if (!selectedCards.some(c => c.id === data.cardId)) {
                selectedCards.push({ id: data.cardId, number: data.cardNumber });
                updateSelectedCards();
                updateStartButton();
            }
        }

        // Refresh display to show taken card
        displayCards(allCards);
    });

    // Real-time: Card deselected by any user
    socket.on('card-deselected', (data) => {
        console.log('Card released:', data);

        // Remove from taken cards
        delete takenCards[data.cardId];

        // If it was my card, remove from selected
        const myUserId = (currentUser && currentUser.telegram_id) || (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id);
        if (data.userId === myUserId) {
            selectedCards = selectedCards.filter(c => c.id !== data.cardId);
            updateSelectedCards();
            updateStartButton();
        }

        // Refresh display to show available card
        displayCards(allCards);
    });

    // Card already taken by someone else
    socket.on('card-taken', (data) => {
        const alertMsg = `Card #${data.cardNumber} is already selected by another player`;
        if (tg.showAlert) {
            tg.showAlert(alertMsg);
        } else {
            alert(alertMsg);
        }
        loadCards(); // Refresh
    });
}

// Setup socket events after initialization
setTimeout(() => {
    setupSocketEvents();
}, 1000);