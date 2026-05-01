// Initialize Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

console.log('🎮 KELALBINGO Starting...');
console.log('Telegram WebApp:', tg);

// API Configuration
const API_URL = window.location.origin + '/api';

// Initialize Socket.IO
const socket = io(window.location.origin);

// State
let currentUser = null;
let selectedCards = [];
let currentRound = 1;
let allCards = []; // Store all available cards
let takenCards = {}; // Track cards taken by others: { cardId: userId }

// Force show game screen immediately (no loading)
setTimeout(() => {
    console.log('⏰ Timeout: Forcing game screen to show');
    showScreen('game-screen');
}, 100);
let takenCards = {}; // Track cards taken by others: { cardId: userId }

// Initialize app
async function init() {
    console.log('🚀 Initializing app...');
    
    // Get Telegram user data
    const user = tg.initDataUnsafe.user;
    
    if (user) {
        console.log('✅ Telegram user found:', user.id, user.username);
        currentUser = {
            id: user.id,
            telegram_id: user.id,
            username: user.username || user.first_name,
            first_name: user.first_name
        };
    } else {
        console.log('⚠️ No Telegram user, using guest');
        currentUser = {
            id: Date.now(),
            telegram_id: Date.now(),
            username: 'Guest',
            first_name: 'Guest'
        };
    }
    
    // Update UI immediately
    updateUI(currentUser, { balance: 0, profit: 0 });
    
    // Show interface immediately
    showScreen('game-screen');
    
    // Load data in background
    loadGameData().catch(err => {
        console.error('Failed to load game data:', err);
    });
    
    // Register user in background (don't wait)
    registerUser(currentUser).catch(err => {
        console.error('Failed to register user:', err);
    });
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
    document.getElementById('username').textContent = user.username || user.first_name;
    document.getElementById('balance').textContent = balance.balance || 0;
    document.getElementById('profit').textContent = balance.profit || 0;
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
    } catch (error) {
        console.error('Load cards error:', error);
        const container = document.getElementById('cards-grid');
        if (container) {
            container.innerHTML = `<p class="error">Failed to load cards. <button onclick="loadCards()" class="btn btn-secondary">Retry</button></p>`;
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
        tg.showAlert(`Card #${cardNumber} is already selected by another player`);
        return;
    }
    
    const cardIndex = selectedCards.findIndex(c => c.id === cardId);
    
    if (cardIndex > -1) {
        // Deselect this specific card
        selectedCards.splice(cardIndex, 1);
        
        // Remove from taken cards
        delete takenCards[cardId];
        
        // Emit to server (real-time)
        socket.emit('deselect-card', {
            roundNumber: currentRound,
            cardId: cardId,
            cardNumber: cardNumber,
            userId: myUserId
        });
        
        console.log(`Deselected card #${cardNumber}`);
    } else {
        // Select card
        selectedCards.push({ id: cardId, number: cardNumber });
        
        // Mark as taken by me
        takenCards[cardId] = myUserId;
        
        // Emit to server (real-time)
        socket.emit('select-card', {
            roundNumber: currentRound,
            cardId: cardId,
            cardNumber: cardNumber,
            userId: myUserId
        });
        
        console.log(`Selected card #${cardNumber}`);
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
document.getElementById('start-game-btn').addEventListener('click', () => {
    if (selectedCards.length === 0) {
        tg.showAlert('Please select at least one card');
        return;
    }
    tg.showAlert(`Starting game with ${selectedCards.length} card(s)!\n\nGame functionality coming soon!`);
});

// Initialize on load
init();


// Socket.IO real-time events
socket.on('connect', () => {
    console.log('🔌 Connected to server');
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
    // Continue without real-time features
});

socket.on('disconnect', () => {
    console.log('🔌 Disconnected from server');
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
    tg.showAlert(`Card #${data.cardNumber} is already selected by another player`);
    loadCards(); // Refresh
});
