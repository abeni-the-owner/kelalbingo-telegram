// Game page specific JavaScript

// Global variables
let tg = null;
let currentUser = null;
let allCards = [];
let selectedCards = [];
let takenCards = {};
let socket = null;
let socketReady = false;
let currentRound = 1;
let isInitialized = false;
let heartbeatInterval = null;

// API URL
const API_URL = window.location.origin + '/api';

// Debug log function
function debugLog(message) {
    const debugElement = document.getElementById('debug-log');
    if (debugElement) {
        const timestamp = new Date().toLocaleTimeString();
        debugElement.innerHTML += `<div>[${timestamp}] ${message}</div>`;
        debugElement.scrollTop = debugElement.scrollHeight;

        // Keep only last 50 messages
        const messages = debugElement.children;
        if (messages.length > 50) {
            debugElement.removeChild(messages[0]);
        }
    }
    console.log(message);
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

        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve(null);
        }, 5000);
    });
}

// Initialize Telegram WebApp
async function initTelegram() {
    try {
        debugLog('🔄 Waiting for Telegram WebApp...');

        tg = await waitForTelegram();

        if (tg && tg.ready) {
            debugLog('✅ Telegram WebApp found');

            tg.ready();
            tg.expand();

            if (tg.enableClosingConfirmation) {
                tg.enableClosingConfirmation();
            }

            // Get user data
            let attempts = 0;
            const maxAttempts = 15;

            debugLog('🔍 Checking for user data...');
            debugLog('🔍 Initial initDataUnsafe: ' + JSON.stringify(tg.initDataUnsafe));

            while (attempts < maxAttempts && (!tg.initDataUnsafe || !tg.initDataUnsafe.user)) {
                debugLog(`🔄 Attempt ${attempts + 1}/${maxAttempts}: Waiting for user data...`);
                await new Promise(resolve => setTimeout(resolve, 300));
                attempts++;

                if (tg.initDataUnsafe) {
                    debugLog('🔍 Available keys: ' + Object.keys(tg.initDataUnsafe).join(', '));
                }
            }

            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                const telegramUser = tg.initDataUnsafe.user;
                debugLog('✅ Telegram user found after ' + attempts + ' attempts');
                debugLog('📱 User ID: ' + telegramUser.id);
                debugLog('👤 Username: ' + (telegramUser.username || 'Not set'));
                debugLog('👤 First name: ' + (telegramUser.first_name || 'Not set'));

                currentUser = {
                    id: telegramUser.id,
                    telegram_id: telegramUser.id,
                    username: telegramUser.username || null,
                    first_name: telegramUser.first_name || null,
                    last_name: telegramUser.last_name || null,
                    phone_number: telegramUser.phone_number || null,
                    language_code: telegramUser.language_code || 'en'
                };
            } else {
                debugLog('⚠️ No user data found, creating fallback user');
                currentUser = {
                    id: Date.now(),
                    telegram_id: Date.now(),
                    username: null,
                    first_name: 'Game User',
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
            debugLog('❌ Telegram WebApp not available - using fallback');
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

        isInitialized = true;

    } catch (error) {
        debugLog('❌ Telegram init error: ' + error.message);
        isInitialized = true;

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
    debugLog('🎨 updateUI called with user: ' + JSON.stringify({
        first_name: user.first_name,
        username: user.username,
        id: user.id || user.telegram_id
    }));

    let displayName = user.first_name || user.username || 'Guest User';

    if (user.first_name && user.username) {
        displayName = `${user.first_name} (@${user.username})`;
    } else if (user.username && !user.first_name) {
        displayName = `@${user.username}`;
    }

    debugLog('🏷️ Final display name: ' + displayName);

    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        usernameElement.textContent = displayName;
        usernameElement.innerText = displayName;
        usernameElement.innerHTML = displayName;

        usernameElement.style.display = 'none';
        usernameElement.offsetHeight;
        usernameElement.style.display = '';

        debugLog('✅ Username element updated to: ' + displayName);
    }

    const balanceElement = document.getElementById('balance');
    const profitElement = document.getElementById('profit');

    if (balanceElement) {
        balanceElement.textContent = balance.balance || 0;
    }
    if (profitElement) {
        profitElement.textContent = balance.profit || 0;
    }

    debugLog('👤 Display name: ' + displayName);
}

// Initialize Socket.IO
function initSocket() {
    if (!window.socketIOLoaded) {
        debugLog('⚠️ Socket.IO not loaded, continuing without real-time features');
        return;
    }

    try {
        socket = io(window.location.origin);
        setupSocketEvents();
        debugLog('🔌 Socket.IO initialized');
    } catch (error) {
        debugLog('❌ Socket.IO init error: ' + error.message);
    }
}

// Start heartbeat system
function startHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }

    heartbeatInterval = setInterval(() => {
        if (socketReady && socket && currentUser) {
            socket.emit('heartbeat', {
                userId: currentUser.telegram_id,
                timestamp: Date.now()
            });
            debugLog('💓 Heartbeat sent');
        }
    }, 30000); // Send heartbeat every 30 seconds

    debugLog('💓 Heartbeat system started');
}

// Stop heartbeat system
function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        debugLog('💓 Heartbeat system stopped');
    }
}

// Cleanup function to release cards
function cleanupCardSelections() {
    if (socketReady && socket && currentUser && selectedCards.length > 0) {
        debugLog('🧹 Cleaning up card selections before disconnect');

        // Release all selected cards
        selectedCards.forEach(card => {
            socket.emit('deselect-card', {
                roundNumber: currentRound,
                cardId: card.id,
                cardNumber: card.number,
                userId: currentUser.telegram_id,
                cleanup: true // Flag to indicate this is a cleanup
            });
        });

        // Notify server that user is leaving
        socket.emit('user-leaving', {
            userId: currentUser.telegram_id,
            timestamp: Date.now()
        });
    }
}

// Setup Socket.IO events
function setupSocketEvents() {
    if (!socket) return;

    socket.on('connect', () => {
        socketReady = true;
        debugLog('🔌 Connected to server');

        if (currentUser) {
            socket.emit('join-round', {
                roundNumber: currentRound,
                userId: currentUser.telegram_id
            });

            // Start heartbeat after connecting
            startHeartbeat();
        }
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        socketReady = false;
        debugLog('❌ Socket error: ' + error.message);
        stopHeartbeat();
    });

    socket.on('disconnect', () => {
        socketReady = false;
        debugLog('🔌 Disconnected from server');
        stopHeartbeat();
        cleanupCardSelections();
    });

    socket.on('current-selections', (selections) => {
        console.log('Current selections:', selections);
        const myUserId = (currentUser && currentUser.telegram_id) || 1;

        takenCards = {};
        selectedCards = [];

        Object.keys(selections).forEach(cardId => {
            const userId = selections[cardId];
            takenCards[parseInt(cardId)] = userId;

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

    socket.on('card-selected', (data) => {
        console.log('Card selected:', data);
        takenCards[data.cardId] = data.userId;

        const myUserId = (currentUser && currentUser.telegram_id) || 1;
        if (data.userId === myUserId) {
            const card = allCards.find(c => c.id === data.cardId);
            if (card) {
                selectedCards.push({ id: data.cardId, number: card.card_number });
            }
        }

        displayCards(allCards);
        updateSelectedCards();
        updateStartButton();
    });

    socket.on('card-deselected', (data) => {
        console.log('Card deselected:', data);
        delete takenCards[data.cardId];

        const myUserId = (currentUser && currentUser.telegram_id) || 1;
        if (data.userId === myUserId) {
            const cardIndex = selectedCards.findIndex(c => c.id === data.cardId);
            if (cardIndex > -1) {
                selectedCards.splice(cardIndex, 1);
            }
        }

        displayCards(allCards);
        updateSelectedCards();
        updateStartButton();
    });
}

// Generate sample cards
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

// Load cards from server
async function loadCards() {
    try {
        debugLog('🔄 Loading cards from server...');
        const response = await fetch(`${API_URL}/cards`, {
            headers: {
                'X-Telegram-User-Id': (currentUser && currentUser.telegram_id) || 1
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        allCards = data.cards;

        displayCards(data.cards);
        debugLog('✅ Cards loaded from server');
    } catch (error) {
        debugLog('❌ Server cards failed: ' + error.message);
        generateSampleCards();
        debugLog('📊 Using sample cards as fallback');
    }
}

// Display cards in the grid (numbers only for mobile)
function displayCards(cards) {
    const container = document.getElementById('cards-grid');
    if (!container) {
        debugLog('❌ Cards grid container not found');
        return;
    }

    if (!cards || cards.length === 0) {
        container.innerHTML = '<p class="loading">No cards available</p>';
        return;
    }

    const myUserId = (currentUser && currentUser.telegram_id) || 1;

    container.innerHTML = cards.map(card => {
        const isTaken = takenCards[card.id];
        const isTakenByMe = isTaken === myUserId;

        return `
            <div class="card-item ${isTakenByMe ? 'selected' : ''} ${isTaken && !isTakenByMe ? 'taken' : ''}" 
                 onclick="toggleCardSelection(${card.id}, ${card.card_number})"
                 data-card-id="${card.id}">
                <div class="card-number">${card.card_number}</div>
            </div>
        `;
    }).join('');

    debugLog(`✅ Displayed ${cards.length} cards`);
}

// Generate card preview
function generateCardPreview(card) {
    let html = '<div class="mini-card">';
    for (let row = 0; row < 3; row++) {
        html += '<div class="mini-row">';
        html += `<div class="mini-cell">${card.b_column[row]}</div>`;
        html += `<div class="mini-cell">${card.i_column[row]}</div>`;
        html += `<div class="mini-cell ${card.n_column[row] === 0 ? 'free' : ''}">${card.n_column[row] === 0 ? '⭐' : card.n_column[row]}</div>`;
        html += `<div class="mini-cell">${card.g_column[row]}</div>`;
        html += `<div class="mini-cell">${card.o_column[row]}</div>`;
        html += '</div>';
    }
    html += '</div>';
    return html;
}

// Toggle card selection
function toggleCardSelection(cardId, cardNumber) {
    const myUserId = (currentUser && currentUser.telegram_id) || 1;

    if (takenCards[cardId] && takenCards[cardId] !== myUserId) {
        const alertMsg = `Card #${cardNumber} is already selected by another player`;

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
        selectedCards.splice(cardIndex, 1);
        delete takenCards[cardId];

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
        // Prevent duplicates by checking if card already exists
        const existingCard = selectedCards.find(c => c.id === cardId);
        if (!existingCard) {
            selectedCards.push({ id: cardId, number: cardNumber });
            takenCards[cardId] = myUserId;

            if (socketReady && socket) {
                socket.emit('select-card', {
                    roundNumber: currentRound,
                    cardId: cardId,
                    cardNumber: cardNumber,
                    userId: myUserId
                });
            }

            debugLog(`➕ Selected card #${cardNumber}`);
        } else {
            debugLog(`⚠️ Card #${cardNumber} already selected, skipping`);
        }
    }

    displayCards(allCards);
    updateSelectedCards();
    updateStartButton();
}

// Update selected cards display with medium bingo grids
function updateSelectedCards() {
    const container = document.getElementById('selected-cards');

    if (selectedCards.length === 0) {
        container.innerHTML = '<p class="empty-state">No cards selected. Tap card numbers above to select.</p>';
        return;
    }

    // Remove duplicates by using a Set to track unique card IDs
    const uniqueCards = [];
    const seenIds = new Set();

    selectedCards.forEach(card => {
        if (!seenIds.has(card.id)) {
            seenIds.add(card.id);
            uniqueCards.push(card);
        }
    });

    container.innerHTML = uniqueCards.map(card => {
        const cardData = allCards.find(c => c.id === card.id);
        if (!cardData) return '';

        return `
            <div class="selected-card">
                <div class="selected-card-info">
                    <span class="selected-card-number">#${card.number}</span>
                    <div class="selected-card-grid">
                        ${generateMediumBingoGrid(cardData)}
                    </div>
                </div>
                <button class="remove-card" onclick="removeCard(${card.id})">✕</button>
            </div>
        `;
    }).join('');
}

// Generate medium bingo grid for selected card with BINGO header
function generateMediumBingoGrid(card) {
    let html = '';

    // BINGO header row
    html += '<div class="bingo-header-row">';
    html += '<div class="bingo-header-cell">B</div>';
    html += '<div class="bingo-header-cell">I</div>';
    html += '<div class="bingo-header-cell">N</div>';
    html += '<div class="bingo-header-cell">G</div>';
    html += '<div class="bingo-header-cell">O</div>';
    html += '</div>';

    // Number rows
    for (let row = 0; row < 5; row++) {
        html += '<div class="bingo-numbers-row">';
        html += `<div class="medium-bingo-cell">${card.b_column[row]}</div>`;
        html += `<div class="medium-bingo-cell">${card.i_column[row]}</div>`;
        html += `<div class="medium-bingo-cell ${card.n_column[row] === 0 ? 'free' : ''}">${card.n_column[row] === 0 ? '⭐' : card.n_column[row]}</div>`;
        html += `<div class="medium-bingo-cell">${card.g_column[row]}</div>`;
        html += `<div class="medium-bingo-cell">${card.o_column[row]}</div>`;
        html += '</div>';
    }

    return html;
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
    if (btn) {
        btn.disabled = selectedCards.length === 0;
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

// Setup page cleanup events
function setupCleanupEvents() {
    // Cleanup when page is unloaded
    const cleanupHandler = () => {
        debugLog('🧹 Page unloading - cleaning up card selections');
        cleanupCardSelections();
        stopHeartbeat();
    };

    // Multiple events to catch different scenarios
    window.addEventListener('beforeunload', cleanupHandler);
    window.addEventListener('unload', cleanupHandler);
    window.addEventListener('pagehide', cleanupHandler);

    // Telegram WebApp specific events
    if (tg && tg.onEvent) {
        tg.onEvent('viewportChanged', () => {
            // If viewport changes dramatically, user might be closing
            if (tg.viewportHeight < 100) {
                cleanupHandler();
            }
        });
    }

    // Handle visibility change (user switches apps)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            debugLog('👁️ Page hidden - starting cleanup timer');
            // Start a timer to cleanup if user doesn't return
            setTimeout(() => {
                if (document.hidden) {
                    cleanupHandler();
                }
            }, 60000); // Cleanup after 1 minute of being hidden
        } else {
            debugLog('👁️ Page visible - user returned');
        }
    });

    debugLog('🧹 Cleanup events setup completed');
}

// Initialize game page
async function initGamePage() {
    debugLog('🚀 Game page init started');

    if (!isInitialized) {
        await initTelegram();
    }

    initSocket();
    setupCleanupEvents();

    if (currentUser) {
        updateUI(currentUser, { balance: 0, profit: 0 });

        generateSampleCards();

        loadCards().catch(err => {
            debugLog('❌ Load cards error: ' + err.message);
        });

        registerUser(currentUser).catch(err => {
            debugLog('❌ Register error: ' + err.message);
        });
    }

    debugLog('✅ Game page init completed');
}

// Start game button handler
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (selectedCards.length === 0) {
                const alertMsg = 'Please select at least one card';
                if (tg && tg.showAlert) {
                    tg.showAlert(alertMsg);
                } else {
                    alert(alertMsg);
                }
                return;
            }
            const gameMsg = `Starting game with ${selectedCards.length} card(s)!\n\nGame functionality coming soon!`;
            if (tg && tg.showAlert) {
                tg.showAlert(gameMsg);
            } else {
                alert(gameMsg);
            }
        });
    }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGamePage);
} else {
    initGamePage();
}