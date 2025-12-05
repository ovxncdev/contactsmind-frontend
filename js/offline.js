// offline.js - Offline Queue & Cache

const OfflineQueue = {
  KEY: 'contactsmind_offline_queue',
  
  getQueue() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch {
      return [];
    }
  },
  
  add(action) {
    const queue = this.getQueue();
    queue.push({
      ...action,
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(this.KEY, JSON.stringify(queue));
    console.log('📥 Added to offline queue:', action.type);
  },
  
  addToQueue(action) {
    this.add(action);
  },
  
  remove(id) {
    const queue = this.getQueue().filter(item => item.id !== id);
    localStorage.setItem(this.KEY, JSON.stringify(queue));
  },
  
  removeFromQueue(id) {
    this.remove(id);
  },
  
  clear() {
    localStorage.removeItem(this.KEY);
  },
  
  clearQueue() {
    this.clear();
  },
  
  hasItems() {
    return this.getQueue().length > 0;
  }
};

const OfflineCache = {
  KEY: 'contactsmind_contacts_cache',
  
  save(contactsList) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify({
        contacts: contactsList,
        lastUpdated: new Date().toISOString()
      }));
    } catch (e) {
      console.error('Failed to cache contacts:', e);
    }
  },
  
  saveContacts(contactsList) {
    this.save(contactsList);
  },
  
  get() {
    try {
      const data = JSON.parse(localStorage.getItem(this.KEY));
      return data?.contacts || [];
    } catch {
      return [];
    }
  },
  
  getContacts() {
    return this.get();
  },
  
  getLastUpdated() {
    try {
      const data = JSON.parse(localStorage.getItem(this.KEY));
      return data?.lastUpdated;
    } catch {
      return null;
    }
  }
};