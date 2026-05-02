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
            
            // Get user data
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                telegramUser = tg.initDataUnsafe.user;
                debugLog('✅ Telegram user found: ' + (telegramUser.username || telegramUser.first_name));
                debugLog('📱 User ID: ' + telegramUser.id);
                debugLog('👤 Username: ' + (telegramUser.username || 'Not set'));
                debugLog('📞 Phone: ' + (telegramUser.phone_number || 'Not provided'));
                
                // Validate init data
                if (tg.initData) {
                    debugLog('✅ Init data available: ' + tg.initData.length + ' chars');
                } else {
                    debugLog('⚠️ No init data - running in test mode');
                }
            } else {
                debugLog('⚠️ No user data in initDataUnsafe');
                if (tg.initDataUnsafe) {
                    debugLog('🔍 Available data: ' + JSON.stringify(tg.initDataUnsafe));
                } else {
                    debugLog('❌ No initDataUnsafe object');
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
let takenCards = {}; // Track cards taken by others: { cardId: userId }

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
    
    // Get user data from Telegram
    let user = null;
    
    if (telegramUser) {
        user = telegramUser;
        debugLog('✅ Using Telegram user: ' + (user.username || user.first_name));
        
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
        debugLog('📋 User details:');
        debugLog('  - ID: ' + currentUser.telegram_id);
        debugLog('  - Username: ' + (currentUser.username || 'Not set'));
        debugLog('  - First name: ' + (currentUser.first_name || 'Not set'));
        debugLog('  - Last name: ' + (currentUser.last_name || 'Not set'));
        debugLog('  - Phone: ' + (currentUser.phone_number || 'Not provided'));
        debugLog('  - Language: ' + currentUser.language_code);
        
    } else {
        debugLog('⚠️ No Telegram user, creating guest user');
        
        // Try to detect if we're in Telegram environment
        const userAgent = navigator.userAgent;
        const isTelegramApp = userAgent.includes('Telegram') || 
                             window.location.href.includes('tgWebAppData') ||
                             document.referrer.includes('telegram');
        
        if (isTelegramApp) {
            debugLog('🔍 Detected Telegram environment but no user data');
            debugLog('🔍 This might be a Telegram WebApp configuration issue');
        }
        
        currentUser = {
            id: Date.now(),
            telegram_id: Date.now(),
            username: null,
            first_name: 'Guest',
            last_name: null,
            phone_number: null,
            language_code: 'en'
        };
    }
    
    // Update UI immediately with all available info
    updateUI(currentUser, { balance: 0, profit: 0 });
    
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
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': user.telegram_id
            },
            body: JSON.stringify({ user })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.balance) {
                updateUI(user, data.balance);
            }
            console.log('✅ User registered');
        }
    } catch (error) {
        console.error('Register error:', error);
    }
}

// Update UI with user data
function updateUI(user, balance) {
    // Display name (prefer first_name, fallback to username, then Guest)
    const displayName = user.first_name || user.username || 'Guest';
    document.getElementById('username').textContent = displayName;
    
    // Update balance info
    document.getElementById('balance').textContent = balance.balance || 0;
    document.getElementById('profit').textContent = balance.profit || 0;
    
    // Add user info to debug log
    debugLog('👤 Display name: ' + displayName);
    if (user.phone_number) {
        debugLog('📞 Phone: ' + user.phone_number);
    }
}

// Load game data
async function loadGameData() {
    console.log('📊 Loading game data...');
    try {
        await Promise.all([
            loadRound(),
            loadCards(),
            loadHistory(),
            loadStats()
        ]);
        console.log('✅ Game data loaded');
    } catch (error) {
        console.error('❌ Failed to load game data:', error);
    }
}

// Load current round
async function loadRound() {
    try {
        const response = await fetch(`${API_URL}/game/round`, {
            headers: {
                'X-Telegram-User-Id': currentUser?.telegram_id || 1
            }
        });
        const data = await response.json();
        currentRound = data.round.round_number;
        document.getElementById('round-number').textContent = currentRound;
        console.log('✅ Round loaded:', currentRound);
    } catch (error) {
        console.error('Load round error:', error);
        currentRound = 1;
        document.getElementById('round-number').textContent = '1';
    }
}

// Load available cards
async function loadCards() {
    try {
        debugLog('📊 Loading cards from server...');
        const response = await fetch(`${API_URL}/cards`, {
            headers: {
                'X-Telegram-User-Id': tg.initDataUnsafe.user?.id || currentUser?.telegram_id || 1
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
                'X-Telegram-User-Id': tg.initDataUnsafe.user?.id || 1
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

// Display cards in compact grid
function displayCards(cards) {
    const container = document.getElementById('cards-grid');
    
    if (cards.length === 0) {
        container.innerHTML = '<p class="empty-state">No cards available</p>';
        return;
    }

    const myUserId = currentUser?.telegram_id || tg.initDataUnsafe.user?.id;

    container.innerHTML = cards.map(card => {
        const isSelectedByMe = selectedCards.some(c => c.id === card.id);
        const isTakenByOther = takenCards[card.id] && takenCards[card.id] !== myUserId;
        
        let className = 'card-btn-compact';
        if (isSelectedByMe) {
            className += ' selected'; // Green - my card
        } else if (isTakenByOther) {
            className += ' taken'; // Gray - taken by someone else
        }
        
        return `
            <button class="${className}" 
                    data-card-id="${card.id}" 
                    onclick="toggleCardSelection(${card.id}, ${card.card_number})"
                    ${isTakenByOther ? 'disabled' : ''}>
                ${card.card_number}
            </button>
        `;
    }).join('');
}

// Toggle card selection (real-time via WebSocket, no database)
function toggleCardSelection(cardId, cardNumber) {
    const myUserId = currentUser?.telegram_id || tg.initDataUnsafe.user?.id;
    
    // Check if card is taken by someone else
    if (takenCards[cardId] && takenCards[cardId] !== myUserId) {
        const alertMsg = `Card #${cardNumber} is already selected by another player`;
        if (tg.showAlert) {
            tg.showAlert(alertMsg);
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
    document.addEventListener('DOMContentLoaded', async () => {
        await initTelegram();
        await init();
    });
} else {
    // DOM already loaded
    (async () => {
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
        const myUserId = currentUser?.telegram_id || tg.initDataUnsafe.user?.id;
        
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
        const myUserId = currentUser?.telegram_id || tg.initDataUnsafe.user?.id;
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
        const myUserId = currentUser?.telegram_id || tg.initDataUnsafe.user?.id;
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
