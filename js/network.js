// network.js - Network Status

const NetworkStatus = {
  isOnline: navigator.onLine,
  
  init() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    this.updateUI();
  },
  
  handleOnline() {
    this.isOnline = true;
    console.log('🌐 Back online');
    this.updateUI();
    addBotMessage("You're back online! Syncing...");
    this.syncOfflineChanges();
  },
  
  handleOffline() {
    this.isOnline = false;
    console.log('📴 Gone offline');
    this.updateUI();
    addBotMessage("You're offline. Changes will sync when you reconnect.");
  },
  
  updateUI() {
    let indicator = document.getElementById('network-status');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'network-status';
      document.body.appendChild(indicator);
    }
    
    if (this.isOnline) {
      indicator.className = 'network-status online';
      indicator.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
          <path d="m9 12 2 2 4-4"></path>
        </svg>
        Synced
      `;
      setTimeout(() => indicator.classList.add('hidden'), 3000);
    } else {
      indicator.className = 'network-status offline';
      indicator.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 2l20 20"></path>
          <path d="M17.5 19H9a7 7 0 0 1-5.2-11.8"></path>
          <path d="M22 14.5a4.5 4.5 0 0 0-7.5-3.4"></path>
          <path d="M8 5a7 7 0 0 1 8.7 4"></path>
        </svg>
        Offline
      `;
      indicator.classList.remove('hidden');
    }
  },
  
  showSyncing() {
    let indicator = document.getElementById('network-status');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'network-status';
      document.body.appendChild(indicator);
    }
    
    indicator.className = 'network-status online syncing';
    indicator.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
        <path d="M21 3v5h-5"></path>
      </svg>
      Syncing...
    `;
    indicator.classList.remove('hidden');
  },
  
  async syncOfflineChanges() {
    if (!this.isOnline || !OfflineQueue.hasItems()) return;
    
    this.showSyncing();
    const queue = OfflineQueue.getQueue();
    console.log(`🔄 Syncing ${queue.length} offline changes...`);
    
    for (const item of queue) {
      try {
        let success = false;
        
        switch (item.type) {
          case 'add_contact':
            const addResult = await syncContacts([item.contact]);
            success = !!addResult;
            break;
            
          case 'update_contact':
            const updateRes = await fetch(`${CONFIG.API_URL}/api/contacts/${item.contactId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify(item.contact)
            });
            success = updateRes.ok;
            break;
            
          case 'delete_contact':
            const deleteRes = await fetch(`${CONFIG.API_URL}/api/contacts/${item.contactId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
            success = deleteRes.ok;
            break;
        }
        
        if (success) {
          OfflineQueue.removeFromQueue(item.id);
        }
      } catch (error) {
        console.error('Sync failed for item:', item, error);
      }
    }
    
    await loadContacts();
    this.updateUI();
    
    if (!OfflineQueue.hasItems()) {
      addBotMessage("All changes synced! ✓");
    }
  }
};