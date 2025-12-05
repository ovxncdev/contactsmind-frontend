// offline.js - Offline Queue & Cache

const OfflineQueue = {
  QUEUE_KEY: 'contactsmind_offline_queue',
  
  getQueue() {
    try {
      return JSON.parse(localStorage.getItem(this.QUEUE_KEY)) || [];
    } catch {
      return [];
    }
  },
  
  addToQueue(action) {
    const queue = this.getQueue();
    queue.push({
      ...action,
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    console.log('📥 Added to offline queue:', action.type);
  },
  
  removeFromQueue(id) {
    const queue = this.getQueue().filter(item => item.id !== id);
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
  },
  
  clearQueue() {
    localStorage.removeItem(this.QUEUE_KEY);
  },
  
  hasItems() {
    return this.getQueue().length > 0;
  }
};

const OfflineCache = {
  CONTACTS_KEY: 'contactsmind_contacts_cache',
  
  saveContacts(contactsList) {
    try {
      localStorage.setItem(this.CONTACTS_KEY, JSON.stringify({
        contacts: contactsList,
        lastUpdated: new Date().toISOString()
      }));
    } catch (e) {
      console.error('Failed to cache contacts:', e);
    }
  },
  
  getContacts() {
    try {
      const data = JSON.parse(localStorage.getItem(this.CONTACTS_KEY));
      return data?.contacts || [];
    } catch {
      return [];
    }
  },
  
  getLastUpdated() {
    try {
      const data = JSON.parse(localStorage.getItem(this.CONTACTS_KEY));
      return data?.lastUpdated;
    } catch {
      return null;
    }
  }
};