// Initialize Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// API Configuration
const API_URL = window.location.origin + '/api';

// State
let currentUser = null;
let selectedCards = [];
let currentRound = 1;

// Initialize app
async function init() {
    try {
        showScreen('loading');
        
        // Get Telegram user data
        const initData = tg.initData;
        const user = tg.initDataUnsafe.user;
        
        if (!user) {
            throw new Error('No Telegram user data');
        }

        // Login/Register
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData,
                'X-Telegram-User-Id': user.id
            },
            body: JSON.stringify({ initData })
        });

        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            updateUI(data.user, data.balance);
            await loadGameData();
            showScreen('game-screen');
        } else {
            throw new Error('Login failed');
        }
    } catch (error) {
        console.error('Init error:', error);
        tg.showAlert('Failed to initialize app. Please try again.');
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
                'X-Telegram-User-Id': tg.initDataUnsafe.user.id
            }
        });
        const data = await response.json();
        displayCards(data.cards);
    } catch (error) {
        console.error('Load cards error:', error);
    }
}

// Display cards
function displayCards(cards) {
    const container = document.getElementById('cards-list');
    
    if (cards.length === 0) {
        container.innerHTML = '<p class="empty-state">No cards available</p>';
        return;
    }

    container.innerHTML = cards.map(card => `
        <div class="card-item" data-card-id="${card.id}" onclick="selectCard(${card.id}, ${card.card_number})">
            <div class="card-number">Card #${card.card_number}</div>
        </div>
    `).join('');
}

// Select card
function selectCard(cardId, cardNumber) {
    const cardIndex = selectedCards.findIndex(c => c.id === cardId);
    
    if (cardIndex > -1) {
        selectedCards.splice(cardIndex, 1);
    } else {
        selectedCards.push({ id: cardId, number: cardNumber });
    }
    
    updateSelectedCards();
    updateStartButton();
}

// Update selected cards display
function updateSelectedCards() {
    const container = document.getElementById('selected-cards');
    
    if (selectedCards.length === 0) {
        container.innerHTML = '<p class="empty-state">No cards selected</p>';
        return;
    }

    container.innerHTML = selectedCards.map(card => `
        <div class="selected-card">
            <span>Card #${card.number}</span>
            <button class="remove-card" onclick="selectCard(${card.id}, ${card.number})">Remove</button>
        </div>
    `).join('');
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
    tg.showAlert('Game functionality coming soon!');
});

// Initialize on load
init();
