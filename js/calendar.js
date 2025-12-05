// calendar.js - Google Calendar Integration

const Calendar = {
  connected: false,
  
  async init() {
    await this.checkStatus();
  },
  
  async checkStatus() {
    try {
      const response = await fetch(`${CONFIG.API_URL}/api/calendar/status`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.connected = data.connected;
        this.updateUI();
      }
    } catch (error) {
      console.error('Calendar status check failed:', error);
    }
  },
  
  updateUI() {
    const btn = document.getElementById('calendar-connect-btn');
    if (btn) {
      if (this.connected) {
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <path d="m9 16 2 2 4-4"></path>
          </svg>
          Calendar Connected
        `;
        btn.classList.add('connected');
        btn.onclick = () => this.showOptions();
      } else {
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          Connect Calendar
        `;
        btn.classList.remove('connected');
        btn.onclick = () => this.connect();
      }
    }
  },
  
  async connect() {
    try {
      Analytics.track('calendar_connect_started');
      
      const response = await fetch(`${CONFIG.API_URL}/api/calendar/auth-url`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authUrl;
      } else {
        addBotMessage('Failed to start calendar connection. Please try again.');
      }
    } catch (error) {
      console.error('Calendar connect error:', error);
      addBotMessage('Failed to connect calendar. Please try again.');
    }
  },
  
  async disconnect() {
    if (!confirm('Disconnect Google Calendar?')) return;
    
    try {
      const response = await fetch(`${CONFIG.API_URL}/api/calendar/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        this.connected = false;
        this.updateUI();
        localStorage.removeItem('calendarConnected');
        Analytics.track('calendar_disconnected');
        addBotMessage('Google Calendar disconnected.');
      }
    } catch (error) {
      console.error('Calendar disconnect error:', error);
    }
  },
  
  showOptions() {
    const modal = document.getElementById('calendar-options-modal');
    if (modal) modal.classList.remove('hidden');
  },
  
  closeOptions() {
    const modal = document.getElementById('calendar-options-modal');
    if (modal) modal.classList.add('hidden');
  },
  
  async syncAllReminders() {
    try {
      addBotMessage('Syncing reminders to calendar...');
      
      const response = await fetch(`${CONFIG.API_URL}/api/calendar/sync-reminders`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        Analytics.track('calendar_sync_completed', { count: data.synced });
        addBotMessage(`Synced ${data.synced} reminders to Google Calendar! ✓`);
        this.closeOptions();
      } else {
        addBotMessage('Failed to sync reminders. Please try again.');
      }
    } catch (error) {
      console.error('Sync reminders error:', error);
      addBotMessage('Failed to sync reminders. Please try again.');
    }
  },
  
  async addToCalendar(reminder, contactName) {
    if (!this.connected) {
      addBotMessage('Please connect Google Calendar first.');
      return null;
    }
    
    try {
      const response = await fetch(`${CONFIG.API_URL}/api/calendar/create-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          title: reminder.title,
          description: reminder.notes,
          date: reminder.date,
          time: reminder.time,
          contactName
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        Analytics.track('calendar_event_created');
        return data;
      }
    } catch (error) {
      console.error('Add to calendar error:', error);
    }
    
    return null;
  }
};