// onboarding.js - New User Onboarding

const Onboarding = {
  KEY: 'contactsmind_onboarded',
  
  shouldShow() {
    return !localStorage.getItem(this.KEY);
  },
  
  complete() {
    localStorage.setItem(this.KEY, 'true');
    Analytics.track('onboarding_completed');
  },
  
  show() {
    if (!this.shouldShow()) return;
    
    Analytics.track('onboarding_started');
    
    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-slides">
          
          <div class="onboarding-slide active" data-slide="0">
            <div class="onboarding-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h2>Welcome to ContactsMind</h2>
            <p>Your AI-powered contact manager that understands natural language.</p>
          </div>
          
          <div class="onboarding-slide" data-slide="1">
            <div class="onboarding-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h2>Just Type Naturally</h2>
            <p>Say things like "Met John at the coffee shop, he does photography, his number is 555-1234"</p>
          </div>
          
          <div class="onboarding-slide" data-slide="2">
            <div class="onboarding-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <h2>Search Smartly</h2>
            <p>Ask "Who knows photography?" or "Find contacts from last week" and get instant answers.</p>
          </div>
          
          <div class="onboarding-slide" data-slide="3">
            <div class="onboarding-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="m9 12 2 2 4-4"></path>
              </svg>
            </div>
            <h2>Works Offline</h2>
            <p>Your contacts sync automatically and work even without internet.</p>
          </div>
          
        </div>
        
        <div class="onboarding-dots">
          <span class="dot active" data-dot="0"></span>
          <span class="dot" data-dot="1"></span>
          <span class="dot" data-dot="2"></span>
          <span class="dot" data-dot="3"></span>
        </div>
        
        <div class="onboarding-actions">
          <button class="btn btn-secondary" id="onboarding-skip">Skip</button>
          <button class="btn btn-primary" id="onboarding-next">Next</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    let currentSlide = 0;
    const totalSlides = 4;
    
    const updateSlide = (index) => {
      document.querySelectorAll('.onboarding-slide').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.onboarding-dots .dot').forEach(d => d.classList.remove('active'));
      
      document.querySelector(`.onboarding-slide[data-slide="${index}"]`).classList.add('active');
      document.querySelector(`.dot[data-dot="${index}"]`).classList.add('active');
      
      const nextBtn = document.getElementById('onboarding-next');
      nextBtn.textContent = index === totalSlides - 1 ? 'Get Started' : 'Next';
    };
    
    document.getElementById('onboarding-next').addEventListener('click', () => {
      if (currentSlide < totalSlides - 1) {
        currentSlide++;
        updateSlide(currentSlide);
      } else {
        this.close();
      }
    });
    
    document.getElementById('onboarding-skip').addEventListener('click', () => {
      Analytics.track('onboarding_skipped', { slide: currentSlide });
      this.close();
    });
    
    document.querySelectorAll('.onboarding-dots .dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        currentSlide = parseInt(e.target.dataset.dot);
        updateSlide(currentSlide);
      });
    });
  },
  
  close() {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 300);
    }
    this.complete();
  }
};