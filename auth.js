// auth.js - Authentication Logic

// UI Functions
function showLogin() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
  hideError();
}

function showSignup() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('signup-form').classList.remove('hidden');
  hideError();
}

function showError(message) {
  const errorEl = document.getElementById('error-message');
  errorEl.textContent = message;
  errorEl.classList.add('show');
}

function hideError() {
  document.getElementById('error-message').classList.remove('show');
}

// Login Handler
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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Save token and user
      localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, data.token);
      localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
      
      // Redirect to main app
      window.location.href = CONFIG.APP_PAGE;
    } else {
      showError(data.error || 'Login failed');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  } catch (error) {
    showError('Network error. Please check your connection.');
    console.error('Login error:', error);
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

// Signup Handler
async function handleSignup() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Save token and user
      localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, data.token);
      localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
      
      // Redirect to main app
      window.location.href = CONFIG.APP_PAGE;
    } else {
      showError(data.error || 'Signup failed');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  } catch (error) {
    showError('Network error. Please check your connection.');
    console.error('Signup error:', error);
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

// Check if already logged in
function checkAuth() {
  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  if (token) {
    window.location.href = CONFIG.APP_PAGE;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  checkAuth();

  // Enter key support
  document.getElementById('login-password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  document.getElementById('signup-password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSignup();
  });
});