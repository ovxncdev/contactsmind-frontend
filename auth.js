// auth.js - Authentication Logic

const GOOGLE_CLIENT_ID = '451843973142-34lm4ei2pb2k0ufr6g4ijqtkph8orhf9.apps.googleusercontent.com';

// Initialize Google Sign-In
function initGoogleSignIn() {
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
      auto_select: false,
      cancel_on_tap_outside: true
    });
  } else {
    // Retry if Google script not loaded yet
    setTimeout(initGoogleSignIn, 100);
  }
}

// Trigger Google Sign-In popup
// Trigger Google Sign-In popup
function signInWithGoogle() {
  console.log('Google sign-in clicked');
  
  if (typeof google === 'undefined' || !google.accounts) {
    console.log('Google not loaded, using redirect');
    // Fallback: direct OAuth redirect
    const redirectUri = window.location.origin + '/auth.html';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=id_token` +
      `&scope=email%20profile` +
      `&nonce=${Math.random().toString(36).substring(2)}`;
    
    window.location.href = authUrl;
    return;
  }

  // Try Google One Tap first
  google.accounts.id.prompt((notification) => {
    console.log('Google prompt notification:', notification);
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      console.log('One Tap not displayed, using redirect');
      // Fallback to redirect
      const redirectUri = window.location.origin + '/auth.html';
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=id_token` +
        `&scope=email%20profile` +
        `&nonce=${Math.random().toString(36).substring(2)}`;
      
      window.location.href = authUrl;
    }
  });
}

// Handle Google callback
async function handleGoogleCallback(response) {
  console.log('Google response received');
  
  if (!response.credential) {
    showError('Google sign-in failed. Please try again.');
    return;
  }

  // Disable buttons during processing
  const googleBtns = document.querySelectorAll('.google-btn');
  googleBtns.forEach(btn => {
    btn.disabled = true;
    btn.innerHTML = '<span>Signing in...</span>';
  });

  try {
    const res = await fetch(`${CONFIG.API_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, data.token);
      localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
      window.location.replace(CONFIG.APP_PAGE);
    } else {
      showError(data.error || 'Google sign-in failed');
      resetGoogleButtons();
    }
  } catch (error) {
    console.error('Google auth error:', error);
    showError('Network error. Please try again.');
    resetGoogleButtons();
  }
}

function resetGoogleButtons() {
  const googleBtns = document.querySelectorAll('.google-btn');
  googleBtns.forEach(btn => {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    `;
  });
}

// Check for OAuth redirect response
function checkOAuthRedirect() {
  const hash = window.location.hash;
  if (hash && hash.includes('id_token')) {
    const params = new URLSearchParams(hash.substring(1));
    const idToken = params.get('id_token');
    if (idToken) {
      handleGoogleCallback({ credential: idToken });
      window.history.replaceState(null, '', window.location.pathname);
    }
  }
}

function showLogin() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
  hideError();
}

function showRegister() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  hideError();
}

function showError(message) {
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function hideError() {
  const errorEl = document.getElementById('auth-error');
  if (errorEl) errorEl.classList.add('hidden');
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const response = await fetch(`${CONFIG.API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, data.token);
      localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
      window.location.replace(CONFIG.APP_PAGE);
    } else {
      showError(data.error || 'Login failed');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  } catch (error) {
    showError('Network error. Please check your connection.');
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleRegister() {
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;

  if (!name || !email || !password) {
    showError('Please fill in all fields');
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters');
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Creating account...';

  try {
    const response = await fetch(`${CONFIG.API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, data.token);
      localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
      window.location.replace(CONFIG.APP_PAGE);
    } else {
      showError(data.error || 'Registration failed');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  } catch (error) {
    showError('Network error. Please check your connection.');
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

async function checkAuth() {
  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  if (token) {
    try {
      const response = await fetch(`${CONFIG.API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        window.location.replace(CONFIG.APP_PAGE);
      } else {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
      }
    } catch (error) {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  checkOAuthRedirect();
  initGoogleSignIn();
  await checkAuth();
  
  document.getElementById('login-password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('register-password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleRegister();
  });
});