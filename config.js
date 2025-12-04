// config.js - ContactsMind Configuration

const CONFIG = {
  AI_PARSING: true, // Toggle AI parsing

  // Backend API URL
  API_URL: 'https://contactsmind-backend-production.up.railway.app',
  
  // File paths
  AUTH_PAGE: 'auth.html',
  APP_PAGE: 'app.html',
  
  // Sync settings
  SYNC_INTERVAL: 30000, // 30 seconds
  
  // Storage keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'authToken',
    CURRENT_USER: 'currentUser',
    CONTACTS: 'contacts'
  }
};