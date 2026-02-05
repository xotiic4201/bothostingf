// Configuration
const API_BASE_URL = 'https://xotiicsverify-api.onrender.com'; // Replace with your Render URL
const FRONTEND_URL = window.location.origin;

// State
let currentUser = null;
let userSession = null;
let userServers = [];

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const mobileLoginBtn = document.getElementById('mobileLoginBtn');
const userMenu = document.getElementById('userMenu');
const usernameText = document.getElementById('usernameText');
const loadingState = document.getElementById('loadingState');
const notLoggedIn = document.getElementById('notLoggedIn');
const dashboardContent = document.getElementById('dashboardContent');
const statsOverview = document.getElementById('statsOverview');
const statsGrid = document.getElementById('statsGrid');
const serversList = document.getElementById('serversList');
const noServers = document.getElementById('noServers');
const mobileMenu = document.getElementById('mobileMenu');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    // Check for auth callback
    const urlParams = new URLSearchParams(window.location.search);
    const authData = urlParams.get('auth_data');
    
    if (authData) {
        handleAuthCallback(decodeURIComponent(authData));
        // Clean URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    } else {
        checkAuth();
    }
}

function setupEventListeners() {
    loginBtn.addEventListener('click', openLogin);
    if (mobileLoginBtn) {
        mobileLoginBtn.addEventListener('click', openLogin);
    }
}

// Auth Functions
function openLogin() {
    const redirectUrl = encodeURIComponent(`${FRONTEND_URL}/dashboard`);
    window.location.href = `${API_BASE_URL}/api/auth/discord?redirect_url=${redirectUrl}`;
}

function handleAuthCallback(authData) {
    try {
        const data = JSON.parse(authData);
        
        if (data.success && data.user) {
            currentUser = data.user;
            userSession = {
                token: data.session_token,
                expires_at: data.user.expires_at
            };
            
            saveToLocalStorage('xotiicsverify_user', currentUser);
            saveToLocalStorage('xotiicsverify_session', userSession);
            
            updateUI();
            loadDashboard();
            showAlert('success', 'Successfully logged in!');
        }
    } catch (error) {
        console.error('Auth callback error:', error);
        showAlert('error', 'Failed to process login. Please try again.');
    }
}

function checkAuth() {
    const savedUser = getFromLocalStorage('xotiicsverify_user');
    const savedSession = getFromLocalStorage('xotiicsverify_session');
    
    if (savedUser && savedSession) {
        // Check if session is expired
        const expiresAt = new Date(savedSession.expires_at);
        if (expiresAt > new Date()) {
            currentUser = savedUser;
            userSession = savedSession;
            updateUI();
            loadDashboard();
        } else {
            logout();
        }
    } else {
        showLoginPrompt();
    }
}

function updateUI() {
    if (currentUser) {
        loginBtn.style.display = 'none';
        if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
        userMenu.style.display = 'flex';
        usernameText.textContent = `${currentUser.username}#${currentUser.discriminator}`;
        
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${currentUser.username}!`;
        }
        
        loadingState.style.display = 'none';
        notLoggedIn.style.display = 'none';
        dashboardContent.style.display = 'block';
    }
}

function showLoginPrompt() {
    loadingState.style.display = 'none';
    notLoggedIn.style.display = 'block';
    dashboardContent.style.display = 'none';
}

function logout() {
    currentUser = null;
    userSession = null;
    userServers = [];
    
    localStorage.removeItem('xotiicsverify_user');
    localStorage.removeItem('xotiicsverify_session');
    
    loginBtn.style.display = 'flex';
    if (mobileLoginBtn) mobileLoginBtn.style.display = 'flex';
    userMenu.style.display = 'none';
    
    showLoginPrompt();
    showAlert('success', 'Successfully logged out.');
}

// Dashboard Functions
async function loadDashboard() {
    if (!currentUser) return;
    
    try {
        // Load user servers
        await loadUserServers();
        
        // Load stats if we have servers
        if (userServers.length > 0) {
            loadStats();
            statsOverview.style.display = 'block';
        } else {
            statsOverview.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAlert('error', 'Failed to load dashboard data.');
    }
}

async function loadUserServers() {
    try {
        // Show loading
        serversList.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading servers...</p>
            </div>
        `;
        
        // Fetch servers from API
        const response = await fetch(`${API_BASE_URL}/api/servers?user_id=${currentUser.id}`, {
            headers: {
                'Authorization': `Bearer ${userSession.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch servers');
        }
        
        const data = await response.json();
        
        if (data.success && data.servers && data.servers.length > 0) {
            userServers = data.servers;
            renderServersList();
            noServers.style.display = 'none';
        } else {
            showNoServers();
        }
        
    } catch (error) {
        console.error('Error loading servers:', error);
        showNoServers();
        showAlert('error', 'Failed to load servers. Please try again.');
    }
}

function renderServersList() {
    serversList.innerHTML = '';
    
    userServers.forEach(server => {
        const serverCard = document.createElement('div');
        serverCard.className = 'server-card';
        serverCard.onclick = () => openServerModal(server);
        
        serverCard.innerHTML = `
            <div class="server-header">
                <div class="server-id">Server: ${server.guild_id}</div>
                <span class="badge">${server.verified_count || 0} verified</span>
            </div>
            <div class="server-stats">
                <span><i class="fas fa-cog"></i> ${Object.keys(server.settings || {}).length} settings</span>
                <span><i class="fas fa-clock"></i> Last updated: ${formatRelativeTime(server.updated_at)}</span>
            </div>
        `;
        
        serversList.appendChild(serverCard);
    });
}

function showNoServers() {
    serversList.innerHTML = '';
    noServers.style.display = 'block';
}

function loadStats() {
    if (!userServers.length) return;
    
    const totalVerified = userServers.reduce((sum, server) => sum + (server.verified_count || 0), 0);
    const totalServers = userServers.length;
    
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Total Servers</div>
            <div class="stat-number">${totalServers}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total Verified</div>
            <div class="stat-number">${totalVerified}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Avg per Server</div>
            <div class="stat-number">${Math.round(totalVerified / totalServers)}</div>
        </div>
    `;
}

// Modal Functions
function openServerModal(server) {
    const modal = document.getElementById('serverModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    
    modalTitle.textContent = `Server Settings: ${server.guild_id}`;
    
    modalContent.innerHTML = `
        <div class="form-group">
            <label class="form-label">Server ID</label>
            <input type="text" class="form-input" value="${server.guild_id}" readonly>
        </div>
        
        <div class="form-group">
            <label class="form-label">Verified Users Count</label>
            <input type="text" class="form-input" value="${server.verified_count || 0}" readonly>
        </div>
        
        <div class="form-group">
            <label class="form-label">Welcome Message</label>
            <textarea id="welcomeMessageInput" class="form-textarea" rows="3">${server.settings?.welcome_message || 'Welcome to the server!'}</textarea>
        </div>
        
        <div class="form-group">
            <label class="form-label">Verification Role ID (Optional)</label>
            <input type="text" id="roleIdInput" class="form-input" 
                   value="${server.settings?.verified_role_id || ''}" 
                   placeholder="Enter Discord Role ID">
        </div>
        
        <div class="modal-actions">
            <button onclick="saveSettings('${server.guild_id}')" class="btn btn-primary">
                <i class="fas fa-save"></i> Save Settings
            </button>
            <button onclick="startRestoration('${server.guild_id}')" class="btn btn-success">
                <i class="fas fa-sync-alt"></i> Restore Users
            </button>
            <button onclick="closeModal()" class="btn btn-outline">
                Cancel
            </button>
        </div>
        
        <div id="restoreStatus" style="display: none; margin-top: 1rem;">
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Restoring users...</p>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

async function saveSettings(guildId) {
    try {
        const welcomeMessage = document.getElementById('welcomeMessageInput').value;
        const roleId = document.getElementById('roleIdInput').value;
        
        const settings = {
            owner_id: currentUser.id,
            welcome_message: welcomeMessage,
            verified_role_id: roleId || null
        };
        
        const response = await fetch(`${API_BASE_URL}/api/settings/${guildId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${userSession.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save settings');
        }
        
        showAlert('success', 'Settings saved successfully!');
        closeModal();
        refreshDashboard();
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showAlert('error', 'Failed to save settings. Please try again.');
    }
}

async function startRestoration(guildId) {
    try {
        const restoreStatus = document.getElementById('restoreStatus');
        restoreStatus.style.display = 'block';
        
        const response = await fetch(`${API_BASE_URL}/api/restore`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userSession.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ guild_id: guildId })
        });
        
        if (!response.ok) {
            throw new Error('Failed to start restoration');
        }
        
        const data = await response.json();
        
        showAlert('success', `Restoration started! Task ID: ${data.task_id}`);
        restoreStatus.style.display = 'none';
        
    } catch (error) {
        console.error('Error starting restoration:', error);
        showAlert('error', 'Failed to start restoration. Please try again.');
        document.getElementById('restoreStatus').style.display = 'none';
    }
}

function closeModal() {
    document.getElementById('serverModal').style.display = 'none';
}

// Utility Functions
function refreshDashboard() {
    loadDashboard();
    showAlert('info', 'Refreshing dashboard...');
}

function refreshServers() {
    loadUserServers();
    showAlert('info', 'Refreshing servers...');
}

function toggleMobileMenu() {
    mobileMenu.classList.toggle('show');
}

function showAlert(type, message) {
    const container = document.getElementById('alertContainer');
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <i class="fas fa-${getAlertIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(alert);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function getAlertIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

function formatRelativeTime(dateString) {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
}

function saveToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function getFromLocalStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
    }
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    const modal = document.getElementById('serverModal');
    if (event.target === modal) {
        closeModal();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeModal();
    }
    if (event.key === 'r' && event.ctrlKey) {
        event.preventDefault();
        refreshDashboard();
    }
});