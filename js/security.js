// security.js - Security utilities

const Security = {
  // Sanitize user input
  sanitize(input) {
    if (typeof input !== 'string') return input;
    return input
      .replace(/[<>]/g, '') // Remove < >
      .trim()
      .slice(0, 10000); // Limit length
  },
  
  // Validate email format
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  
  // Validate phone format
  isValidPhone(phone) {
    const re = /^[\d\s\-\+\(\)\.]{7,20}$/;
    return re.test(phone);
  },
  
  // Check token expiry
  isTokenExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  },
  
  // Clear sensitive data on logout
  clearSensitiveData() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    sessionStorage.clear();
    
    // Clear any cached data
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
  },
  
  // Detect suspicious activity
  detectSuspiciousInput(input) {
    const suspicious = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i,
      /eval\(/i,
      /document\./i,
      /window\./i
    ];
    return suspicious.some(pattern => pattern.test(input));
  }
};