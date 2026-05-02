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
