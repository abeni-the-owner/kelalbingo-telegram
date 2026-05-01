// Initialize Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// API Configuration
const API_URL = window.location.origin + '/api';

// Initialize Socket.IO
const socket = io(window.location.origin);

// State
let currentUser = null;
let selectedCards = [];
let currentRound = 1;
let allCards = []; // Store all available cards
let takenCards = new Set(); // Track cards taken by others

// Initialize app
async function init() {
    try {
        showScreen('loading');
        
        // Get Telegram user data
        const initData = tg.initData;
        const user = tg.initDataUnsafe.user;
        
        if (!user) {
            // Development fallback
            console.warn('No Telegram user data, using test user');
            currentUser = { id: 1, username: 'testuser', first_name: 'Test' };
            updateUI(currentUser, { balance: 0, profit: 0 });
            await loadGameData();
            showScreen('game-screen');
            return;
        }

        // Login/Register - use simple auth for now
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-User-Id': user.id
            },
            body: JSON.stringify({ 
                user: {
                    id: user.id,
                    username: user.username,
                    first_name: user.first_name,
                    last_name: user.last_name
                }
            })
        });

        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            updateUI(data.user, data.balance);
            await loadGameData();
            showScreen('game-screen');
        } else {
            throw new Error(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Init error:', error);
        showScreen('game-screen');
        // Show error but allow to continue
        document.getElementById('username').textContent = 'Guest';
        tg.showAlert('Authentication error: ' + error.message);
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
    await Promise.all([
        loadRound(),
        loadCards(),
        loadHistory(),
        loadStats()
    ]);
}

// Load current round
async function loadRound() {
    try {
        const response = await fetch(`${API_URL}/game/round`, {
            headers: {
                'X-Telegram-User-Id': tg.initDataUnsafe.user.id
            }
        });
        const data = await response.json();
        currentRound = data.round.round_number;
        document.getElementById('round-number').textContent = currentRound;
    } catch (error) {
        console.error('Load round error:', error);
    }
}

// Load available cards
async function loadCards() {
    try {
        const response = await fetch(`${API_URL}/cards`, {
            headers: {
                'X-Telegram-User-Id': tg.initDataUnsafe.user?.id || 1
            }
        });
        const data = await response.json();
        allCards = data.cards; // Store globally
        
        // Also load user's selected cards
        await loadMyCards();
        
        displayCards(data.cards);
    } catch (error) {
        console.error('Load cards error:', error);
        const container = document.getElementById('cards-grid');
        if (container) {
            container.innerHTML = '<p class="error">Failed to load cards</p>';
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

    container.innerHTML = cards.map(card => {
        const isSelected = selectedCards.some(c => c.id === card.id);
        return `
            <button class="card-btn-compact ${isSelected ? 'selected' : ''}" 
                    data-card-id="${card.id}" 
                    onclick="toggleCardSelection(${card.id}, ${card.card_number})">
                ${card.card_number}
            </button>
        `;
    }).join('');
}

// Toggle card selection
async function toggleCardSelection(cardId, cardNumber) {
    const cardIndex = selectedCards.findIndex(c => c.id === cardId);
    
    if (cardIndex > -1) {
        // Deselect card - release it for others
        try {
            const response = await fetch(`${API_URL}/cards/deselect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-User-Id': tg.initDataUnsafe.user?.id || 1
                },
                body: JSON.stringify({ card_id: cardId })
            });

            if (response.ok) {
                selectedCards.splice(cardIndex, 1);
                updateSelectedCards();
                updateStartButton();
                displayCards(allCards);
            }
        } catch (error) {
            console.error('Deselect error:', error);
        }
    } else {
        // Select card - reserve it
        try {
            const response = await fetch(`${API_URL}/cards/select`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Telegram-User-Id': tg.initDataUnsafe.user?.id || 1
                },
                body: JSON.stringify({ card_id: cardId })
            });

            const data = await response.json();

            if (response.ok) {
                selectedCards.push({ id: cardId, number: cardNumber });
                updateSelectedCards();
                updateStartButton();
                displayCards(allCards);
            } else {
                // Card already taken
                tg.showAlert(data.error || 'Card not available');
                // Reload cards to get updated list
                await loadCards();
            }
        } catch (error) {
            console.error('Select error:', error);
            tg.showAlert('Failed to select card');
        }
    }
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
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
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
    // Join current round room
    socket.emit('join-round', currentRound);
});

socket.on('disconnect', () => {
    console.log('🔌 Disconnected from server');
});

// Real-time: Card selected by another user
socket.on('card-selected', (data) => {
    console.log('Card selected by another user:', data);
    
    // Add to taken cards
    takenCards.add(data.card_id);
    
    // Remove from available cards if not ours
    if (currentUser && data.user_id !== currentUser.id) {
        allCards = allCards.filter(card => card.id !== data.card_id);
        displayCards(allCards);
        
        // Show notification
        tg.showPopup({
            message: `Card #${data.card_number} was just selected by another player`
        });
    }
});

// Real-time: Card deselected by another user
socket.on('card-deselected', (data) => {
    console.log('Card released by another user:', data);
    
    // Remove from taken cards
    takenCards.delete(data.card_id);
    
    // Reload cards to show newly available card
    if (currentUser && data.user_id !== currentUser.id) {
        loadCards();
        
        // Show notification
        tg.showPopup({
            message: `Card #${data.card_number} is now available!`
        });
    }
});
