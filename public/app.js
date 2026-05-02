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
    debugLog('📺 Showing interface: game-page');
    try {
        // Hide loading screen
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
            loading.classList.remove('active');
        }

        // Show game page
        const gamePage = document.getElementById('game-page');
        if (gamePage) {
            gamePage.style.display = 'block';
            gamePage.classList.add('active');
            debugLog('✅ Showing: game-page');
        } else {
            debugLog('❌ Game page not found');
        }

        // Initialize navigation
        initializeNavigation();

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

// Update UI with user data - handles emojis properly
function updateUI(user, balance) {
    debugLog('🎨 updateUI called with user: ' + JSON.stringify({
        first_name: user.first_name,
        username: user.username,
        id: user.id || user.telegram_id
    }));

    // Display name (prefer first_name, fallback to username, then Guest)
    let displayName = user.first_name || user.username || 'Guest User';

    // If we have both first_name and username, show both
    if (user.first_name && user.username) {
        displayName = `${user.first_name} (@${user.username})`;
    } else if (user.username && !user.first_name) {
        displayName = `@${user.username}`;
    }

    debugLog('🏷️ Final display name: ' + displayName);

    // Update the username element with multiple attempts and emoji handling
    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        // Try multiple methods to ensure the update sticks, especially with emojis
        usernameElement.textContent = displayName;
        usernameElement.innerText = displayName;
        usernameElement.innerHTML = displayName;

        // Force a reflow to ensure emoji rendering
        usernameElement.style.display = 'none';
        usernameElement.offsetHeight; // Trigger reflow
        usernameElement.style.display = '';

        debugLog('✅ Username element updated to: ' + displayName);
        debugLog('🔍 Element content check: "' + usernameElement.textContent + '"');
        debugLog('🔍 Element innerHTML check: "' + usernameElement.innerHTML + '"');
    } else {
        debugLog('❌ Username element not found!');

        // Try to find any element that might show user info
        const possibleElements = [
            '.user-info span',
            '.username',
            '[data-user-info]',
            '.user-name',
            '.user-display',
            '[id*="user"]',
            '[class*="user"]'
        ];

        for (const selector of possibleElements) {
            const element = document.querySelector(selector);
            if (element) {
                element.textContent = displayName;
                element.innerText = displayName;
                element.innerHTML = displayName;
                debugLog('✅ Updated alternative element: ' + selector);
                break;
            }
        }
    }

    // Update balance info
    const balanceElement = document.getElementById('balance');
    const profitElement = document.getElementById('profit');

    if (balanceElement) {
        balanceElement.textContent = balance.balance || 0;
    }
    if (profitElement) {
        profitElement.textContent = balance.profit || 0;
    }

    // Add user info to debug log
    debugLog('👤 Display name: ' + displayName);
    debugLog('👤 First name: ' + (user.first_name || 'Not set'));
    debugLog('👤 Username: ' + (user.username || 'Not set'));
    if (user.phone_number) {
        debugLog('📞 Phone: ' + user.phone_number);
    }

    // Store user data in window for debugging
    window.currentUserDebug = {
        displayName,
        user,
        balance,
        timestamp: new Date().toISOString()
    };

    // Additional emoji-specific debugging
    if (displayName && /[^\x00-\x7F]/.test(displayName)) {
        debugLog('🎨 Display name contains non-ASCII characters (emojis)');
        debugLog('🔍 Character codes: ' + Array.from(displayName).map(c => c.charCodeAt(0)).join(', '));
    }
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

    // Generate sample cards immediately to ensure cards are available
    generateSampleCards();

    // Load data in background (don't wait)
    debugLog('📊 Loading data in background...');
    loadGameData().catch(err => {
        debugLog('❌ Load error: ' + err.message);
        // Sample cards already generated above
        debugLog('📊 Sample cards already available');
    });

    // Register user in background (don't wait)
    registerUser(currentUser).catch(err => {
        debugLog('❌ Register error: ' + err.message);
    });

    debugLog('✅ Init completed');
}

// Load game data (cards, history, stats)
async function loadGameData() {
    try {
        debugLog('📊 Loading game data...');

        // Load cards first
        await loadCards();

        // Load history
        await loadHistory();

        // Load stats
        await loadStats();

        debugLog('✅ Game data loaded successfully');
    } catch (error) {
        debugLog('❌ Load game data error: ' + error.message);
        throw error;
    }
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
        debugLog('🔄 Loading cards from server...');
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

        debugLog('📊 Using sample cards as fallback');
    }
}

// Load user's selected cards
async function loadMyCards() {
    try {
        const response = await fetch(`${API_URL}/cards/my-cards`, {
            headers: {
                'X-Telegram-User-Id': (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || (currentUser && currentUser.telegram_id) || 1
            }
        });

        if (response.ok) {
            const data = await response.json();
            selectedCards = data.cards || [];
            debugLog('✅ User cards loaded');
        }
    } catch (error) {
        debugLog('❌ Load my cards error: ' + error.message);
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

// Display cards in the grid
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

    const myUserId = (currentUser && currentUser.telegram_id) || (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || 1;

    container.innerHTML = cards.map(card => {
        const isTaken = takenCards[card.id];
        const isTakenByMe = isTaken === myUserId;
        const isAvailable = !isTaken || isTakenByMe;

        return `
            <div class="card-item ${isTakenByMe ? 'selected' : ''} ${isTaken && !isTakenByMe ? 'taken' : ''}" 
                 onclick="toggleCardSelection(${card.id}, ${card.card_number})"
                 data-card-id="${card.id}">
                <div class="card-number">#${card.card_number}</div>
                <div class="card-status">
                    ${isTakenByMe ? '✓ Selected' : isTaken ? '👤 Taken' : '📋 Available'}
                </div>
                <div class="card-preview">
                    ${generateCardPreview(card)}
                </div>
            </div>
        `;
    }).join('');

    debugLog(`✅ Displayed ${cards.length} cards`);
}

// Generate card preview (simplified version)
function generateCardPreview(card) {
    let html = '<div class="mini-card">';
    for (let row = 0; row < 3; row++) { // Show only first 3 rows as preview
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
    const myUserId = (currentUser && currentUser.telegram_id) || (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || 1;

    // Check if card is taken by someone else
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
        // Deselect this card
        selectedCards.splice(cardIndex, 1);
        delete takenCards[cardId];

        // Emit to server if socket is ready
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
        takenCards[cardId] = myUserId;

        // Emit to server if socket is ready
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

    // Update displays
    displayCards(allCards);
    updateSelectedCards();
    updateStartButton();
}

// Update start button
function updateStartButton() {
    const btn = document.getElementById('start-game-btn');
    if (btn) {
        btn.disabled = selectedCards.length === 0;
    }
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

// Page Navigation System
function initializeNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const pageName = tab.dataset.page;
            switchPage(pageName);
        });
    });
}

function switchPage(pageName) {
    // Update navigation tabs
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${pageName}-page`).classList.add('active');

    // Load page-specific data
    loadPageData(pageName);

    debugLog(`📄 Switched to ${pageName} page`);
}

function loadPageData(pageName) {
    switch (pageName) {
        case 'account':
            loadAccountData();
            break;
        case 'referral':
            loadReferralData();
            break;
        case 'game':
            // Game data is already loaded in init()
            break;
    }
}

// Account Page Functions
async function loadAccountData() {
    try {
        debugLog('📊 Loading account data...');

        // Load user statistics
        const statsResponse = await fetch(`${API_URL}/game/stats`, {
            headers: {
                'X-Telegram-User-Id': (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || (currentUser && currentUser.telegram_id) || 1
            }
        });

        if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            updateAccountStats(statsData.stats);
        }

        // Load game history
        const historyResponse = await fetch(`${API_URL}/game/history`, {
            headers: {
                'X-Telegram-User-Id': (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || (currentUser && currentUser.telegram_id) || 1
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

// Referral Page Functions
async function loadReferralData() {
    try {
        debugLog('🎁 Loading referral data...');

        if (!currentUser) {
            debugLog('⚠️ No user data available for referral');
            return;
        }

        // Load referral data from server
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

function generateReferralCode(userId) {
    // Generate a simple referral code based on user ID
    return 'REF' + userId.toString().padStart(6, '0');
}

function updateReferralCode(code, link) {
    const codeElement = document.getElementById('referral-code');
    const linkElement = document.getElementById('referral-link');

    if (codeElement) {
        codeElement.textContent = code;
    }

    if (linkElement) {
        linkElement.textContent = link;
    }

    // Add copy functionality
    setupCopyButtons();
}

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

function updateReferralList(referrals) {
    const listContent = document.getElementById('referral-list-content');
    if (!listContent) return;

    if (referrals.length === 0) {
        listContent.innerHTML = '<p class="empty-state">No referrals yet. Start inviting friends!</p>';
        return;
    }

    listContent.innerHTML = referrals.map(referral => `
        <div class="referral-item">
            <div class="referral-name">${referral.name || 'Anonymous'}</div>
            <div class="referral-date">${new Date(referral.joined_date).toLocaleDateString()}</div>
            <div class="referral-status ${referral.active ? 'active' : 'inactive'}">
                ${referral.active ? 'Active' : 'Inactive'}
            </div>
        </div>
    `).join('');
}

function setupCopyButtons() {
    const copyReferralBtn = document.getElementById('copy-referral-btn');
    const copyLinkBtn = document.getElementById('copy-link-btn');

    if (copyReferralBtn) {
        copyReferralBtn.addEventListener('click', async() => {
            const code = document.getElementById('referral-code').textContent;
            await copyToClipboard(code);
            showNotification('Referral code copied!');
        });
    }

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', async() => {
            const link = document.getElementById('referral-link').textContent;
            await copyToClipboard(link);
            showNotification('Referral link copied!');
        });
    }
}

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

function showNotification(message) {
    if (tg && tg.showAlert) {
        tg.showAlert(message);
    } else {
        alert(message);
    }
}

// Initialize navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
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