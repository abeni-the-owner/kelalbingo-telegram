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
        <div class="card-item" data-card-id="${card.id}" onclick="viewCard(${card.id}, ${card.card_number}, '${JSON.stringify(card).replace(/'/g, "&apos;")}')">
            <div class="card-number">Card #${card.card_number}</div>
            <div class="card-preview">Click to view</div>
        </div>
    `).join('');
}

// View card details
function viewCard(cardId, cardNumber, cardDataStr) {
    const cardData = typeof cardDataStr === 'string' ? JSON.parse(cardDataStr) : cardDataStr;
    
    const modalHtml = `
        <div class="modal" id="card-modal" onclick="closeModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Card #${cardNumber}</h3>
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
                    ${generateCardRows(cardData)}
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="selectCardFromModal(${cardId}, ${cardNumber})">
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
