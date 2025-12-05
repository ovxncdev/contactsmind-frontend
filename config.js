// config.js - ContactsMind Configuration

const CONFIG = {
  AI_PARSING: true,
  API_URL: 'https://contactsmind-backend-production.up.railway.app',
  AUTH_PAGE: 'auth.html',
  APP_PAGE: 'app.html',
  SYNC_INTERVAL: 30000,
  STORAGE_KEYS: {
    AUTH_TOKEN: 'authToken',
    CURRENT_USER: 'currentUser',
    CONTACTS: 'contacts'
  },
  // PostHog - safe to be public (it's a write-only key)
  // Leave empty or remove to disable analytics
  POSTHOG_KEY: 'phc_hiVyhEOOywZ23vZcMYcJGj8Bq7i8latPnDUQ5NNKUxJ',  // e.g., 'phc_xxxxxxxxxxxx'
  POSTHOG_HOST: 'https://us.i.posthog.com'
};