// auth.js - Authentication Logic

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
  await checkAuth();
  document.getElementById('login-password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('register-password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleRegister();
  });
});