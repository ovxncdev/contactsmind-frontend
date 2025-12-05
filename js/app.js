// app.js - Main Entry Point

let authToken = localStorage.getItem('authToken');
let currentUser = null;

function init() {
  console.log('🚀 Init started');
  Theme.init();
  Analytics.init();
  NetworkStatus.init();
  
  if (!authToken || Security.isTokenExpired(authToken)) {
    Security.clearSensitiveData();
    window.location.replace(CONFIG.AUTH_PAGE);
    return;
  }
  
  verifyToken();
  setupEventListeners();
  Onboarding.show();
}

async function verifyToken() {
  console.log('🔑 Verifying token...');
  
  if (!navigator.onLine) {
    contacts = OfflineCache.get();
    console.log('📴 Offline - loaded from cache:', contacts.length);
    updateContactCount();
    renderContacts();
    const lastUpdated = OfflineCache.getLastUpdated();
    const timeAgo = lastUpdated ? getTimeAgo(new Date(lastUpdated)) : 'unknown';
    addBotMessage(`You're offline. Showing ${contacts.length} cached contacts (last synced ${timeAgo}).`);
    return;
  }
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      currentUser = await response.json();
      console.log('✅ User verified:', currentUser.email);
      Analytics.identify(currentUser);
      Analytics.track('app_opened');
      await loadContacts();
      
      if (OfflineQueue.hasItems()) {
        NetworkStatus.syncOfflineChanges();
      } else {
        addBotMessage(`Welcome back! You have ${contacts.length} contacts.`);
      }
    } else {
      console.log('❌ Token invalid, redirecting...');
      localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
      window.location.replace(CONFIG.AUTH_PAGE);
    }
  } catch (error) {
    console.error('verifyToken error:', error);
    contacts = OfflineCache.get();
    if (contacts.length > 0) {
      updateContactCount();
      renderContacts();
      addBotMessage(`Connection failed. Showing ${contacts.length} cached contacts.`);
    } else {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
      window.location.replace(CONFIG.AUTH_PAGE);
    }
  }
}

function setupEventListeners() {
  document.getElementById('save-edit-btn')?.addEventListener('click', submitEdit);
  document.getElementById('message-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

// Run init - check if DOM is already ready or wait for it
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM already loaded, run init immediately
  init();
}