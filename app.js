// app.js - Main Application Logic with Offline Support, Notes & Reminders

let authToken = localStorage.getItem('authToken');
let currentUser = null;
let contacts = [];
let currentView = 'chat';
let isProcessing = false;
let pendingConfirmation = null;

// ============== OFFLINE QUEUE ==============
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

// ============== OFFLINE CACHE ==============
const OfflineCache = {
  CONTACTS_KEY: 'contactsmind_contacts_cache',
  
  saveContacts(contacts) {
    try {
      localStorage.setItem(this.CONTACTS_KEY, JSON.stringify({
        contacts,
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

// ============== NETWORK STATUS ==============
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

// ============== POSTHOG ANALYTICS ==============
const Analytics = {
  ready: false,
  
  init() {
    try {
      if (CONFIG.POSTHOG_KEY && 
          CONFIG.POSTHOG_KEY.length > 10 && 
          CONFIG.POSTHOG_KEY.startsWith('phc_')) {
        
        const initPostHog = () => {
          if (typeof posthog !== 'undefined' && posthog.init) {
            posthog.init(CONFIG.POSTHOG_KEY, {
              api_host: CONFIG.POSTHOG_HOST || 'https://us.i.posthog.com',
              loaded: () => {
                this.ready = true;
                console.log('✅ Analytics ready');
              }
            });
          } else {
            setTimeout(initPostHog, 100);
          }
        };
        initPostHog();
      }
    } catch (e) {
      console.log('Analytics disabled:', e);
    }
  },
  
  track(event, properties = {}) {
    try {
      if (this.ready && typeof posthog !== 'undefined') {
        posthog.capture(event, properties);
      }
    } catch (e) {}
  },
  
  identify(user) {
    try {
      if (this.ready && typeof posthog !== 'undefined' && user) {
        posthog.identify(user._id || user.id, {
          email: user.email,
          name: user.name
        });
      }
    } catch (e) {}
  },
  
  reset() {
    try {
      if (this.ready && typeof posthog !== 'undefined') {
        posthog.reset();
      }
    } catch (e) {}
  }
};

// ============== APP INITIALIZATION ==============
function init() {
  Analytics.init();
  NetworkStatus.init();
  
  if (!authToken) {
    window.location.replace(CONFIG.AUTH_PAGE);
    return;
  }
  verifyToken();
  setupEventListeners();
}

async function verifyToken() {
  if (!navigator.onLine) {
    contacts = OfflineCache.getContacts();
    updateContactCount();
    renderContacts();
    const lastUpdated = OfflineCache.getLastUpdated();
    const timeAgo = lastUpdated ? getTimeAgo(new Date(lastUpdated)) : 'unknown';
    addBotMessage(`You're offline. Showing ${contacts.length} cached contacts (last synced ${timeAgo}).`);
    return;
  }
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (response.ok) {
      currentUser = await response.json();
      Analytics.identify(currentUser);
      Analytics.track('app_opened');
      await loadContacts();
      
      if (OfflineQueue.hasItems()) {
        NetworkStatus.syncOfflineChanges();
      } else {
        addBotMessage(`Welcome back! You have ${contacts.length} contacts.`);
      }
    } else {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
      window.location.replace(CONFIG.AUTH_PAGE);
    }
  } catch (error) {
    console.error('verifyToken error:', error);
    contacts = OfflineCache.getContacts();
    if (contacts.length > 0) {
      updateContactCount();
      renderContacts();
      addBotMessage(`Connection failed. Showing ${contacts.length} cached contacts.`);
    } else {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
      window.location.replace(CONFIG.AUTH_PAGE);
    }
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function setupEventListeners() {
  document.getElementById('save-edit-btn')?.addEventListener('click', submitEdit);
  document.getElementById('message-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  // Rating buttons
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

async function loadContacts() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/contacts`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (response.ok) {
      contacts = await response.json();
      OfflineCache.saveContacts(contacts);
      updateContactCount();
      renderContacts();
    }
  } catch (error) {
    console.error('Load contacts error:', error);
    contacts = OfflineCache.getContacts();
    updateContactCount();
    renderContacts();
  }
}

async function syncContacts(newContacts) {
  if (!navigator.onLine) {
    newContacts.forEach(contact => {
      const existingIndex = contacts.findIndex(c => c.name === contact.name);
      if (existingIndex >= 0) {
        contacts[existingIndex] = { ...contacts[existingIndex], ...contact };
      } else {
        contacts.push(contact);
      }
      OfflineQueue.addToQueue({ type: 'add_contact', contact });
    });
    
    OfflineCache.saveContacts(contacts);
    updateContactCount();
    renderContacts();
    return { created: newContacts.length, updated: 0 };
  }
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/contacts/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ contacts: newContacts })
    });
    if (response.ok) {
      const data = await response.json();
      contacts = data.contacts;
      OfflineCache.saveContacts(contacts);
      updateContactCount();
      renderContacts();
      return data.stats;
    }
  } catch (error) {
    console.error('Sync error:', error);
    newContacts.forEach(contact => {
      OfflineQueue.addToQueue({ type: 'add_contact', contact });
    });
    return null;
  }
}

// ============== NOTES FUNCTIONS ==============
function openNotesModal(contactId) {
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  Analytics.track('notes_opened', { contact: contact.name });
  
  document.getElementById('notes-contact-id').value = contactId;
  document.getElementById('notes-contact-name').textContent = contact.name;
  document.getElementById('new-note-text').value = '';
  
  renderNotesList(contact);
  document.getElementById('notes-modal').classList.remove('hidden');
}

function closeNotesModal() {
  document.getElementById('notes-modal').classList.add('hidden');
}

function renderNotesList(contact) {
  const list = document.getElementById('notes-list');
  const notes = contact.notes || [];
  
  if (notes.length === 0) {
    list.innerHTML = '<div class="notes-empty">No notes yet</div>';
    return;
  }
  
  list.innerHTML = notes.map((note, index) => {
    const noteText = typeof note === 'string' ? note : note.text;
    const noteDate = note.date ? new Date(note.date).toLocaleDateString() : '';
    
    return `
      <div class="note-item" data-index="${index}">
        <div class="note-text">${escapeHtml(noteText)}</div>
        ${noteDate ? `<div class="note-date">${noteDate}</div>` : ''}
        <button class="note-delete" onclick="deleteNote(${index})" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }).join('');
}

async function addNote() {
  const contactId = document.getElementById('notes-contact-id').value;
  const noteText = document.getElementById('new-note-text').value.trim();
  
  if (!noteText) {
    alert('Please enter a note');
    return;
  }
  
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  if (!contact.notes) contact.notes = [];
  contact.notes.push({
    text: noteText,
    date: new Date().toISOString()
  });
  contact.updatedAt = new Date().toISOString();
  
  await saveContact(contact);
  
  document.getElementById('new-note-text').value = '';
  renderNotesList(contact);
  renderContacts();
  
  Analytics.track('note_added', { contact: contact.name });
}

async function deleteNote(index) {
  const contactId = document.getElementById('notes-contact-id').value;
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact || !contact.notes) return;
  
  contact.notes.splice(index, 1);
  contact.updatedAt = new Date().toISOString();
  
  await saveContact(contact);
  renderNotesList(contact);
  renderContacts();
  
  Analytics.track('note_deleted');
}

// ============== REMINDERS FUNCTIONS ==============
function openRemindersModal(contactId) {
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  Analytics.track('reminders_opened', { contact: contact.name });
  
  document.getElementById('reminders-contact-id').value = contactId;
  document.getElementById('reminders-contact-name').textContent = contact.name;
  
  // Set default date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('reminder-date').value = tomorrow.toISOString().split('T')[0];
  document.getElementById('reminder-title').value = '';
  document.getElementById('reminder-notes').value = '';
  
  renderRemindersList(contact);
  document.getElementById('reminders-modal').classList.remove('hidden');
}

function closeRemindersModal() {
  document.getElementById('reminders-modal').classList.add('hidden');
}

function renderRemindersList(contact) {
  const list = document.getElementById('reminders-list');
  const reminders = contact.reminders || [];
  
  if (reminders.length === 0) {
    list.innerHTML = '<div class="reminders-empty">No reminders yet</div>';
    return;
  }
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  list.innerHTML = reminders.map((reminder, index) => {
    const reminderDate = new Date(reminder.date);
    const reminderDay = new Date(reminderDate.getFullYear(), reminderDate.getMonth(), reminderDate.getDate());
    
    let statusClass = '';
    if (reminderDay < today) statusClass = 'overdue';
    else if (reminderDay.getTime() === today.getTime()) statusClass = 'today';
    
    const dateStr = reminderDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    const timeStr = reminder.time || '';
    
    return `
      <div class="reminder-item ${statusClass}" data-index="${index}">
        <div class="reminder-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div class="reminder-content">
          <div class="reminder-title">${escapeHtml(reminder.title)}</div>
          <div class="reminder-datetime">${dateStr}${timeStr ? ' at ' + timeStr : ''}</div>
          ${reminder.notes ? `<div class="reminder-notes">${escapeHtml(reminder.notes)}</div>` : ''}
        </div>
        <button class="reminder-delete" onclick="deleteReminder(${index})" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }).join('');
}

async function addReminder() {
  const contactId = document.getElementById('reminders-contact-id').value;
  const title = document.getElementById('reminder-title').value.trim();
  const date = document.getElementById('reminder-date').value;
  const time = document.getElementById('reminder-time').value;
  const notes = document.getElementById('reminder-notes').value.trim();
  
  if (!title || !date) {
    alert('Please enter a title and date');
    return;
  }
  
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  if (!contact.reminders) contact.reminders = [];
  contact.reminders.push({
    title,
    date,
    time,
    notes,
    createdAt: new Date().toISOString()
  });
  contact.updatedAt = new Date().toISOString();
  
  // Sort reminders by date
  contact.reminders.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  await saveContact(contact);
  
  document.getElementById('reminder-title').value = '';
  document.getElementById('reminder-notes').value = '';
  renderRemindersList(contact);
  renderContacts();
  
  Analytics.track('reminder_added', { contact: contact.name });
  addBotMessage(`Reminder added for ${contact.name}: "${title}" on ${new Date(date).toLocaleDateString()}`);
}

async function deleteReminder(index) {
  const contactId = document.getElementById('reminders-contact-id').value;
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact || !contact.reminders) return;
  
  contact.reminders.splice(index, 1);
  contact.updatedAt = new Date().toISOString();
  
  await saveContact(contact);
  renderRemindersList(contact);
  renderContacts();
  
  Analytics.track('reminder_deleted');
}

// ============== SAVE CONTACT HELPER ==============
async function saveContact(contact) {
  const contactId = contact._id || contact.id;
  
  if (!navigator.onLine) {
    const index = contacts.findIndex(c => (c._id || c.id) === contactId);
    if (index !== -1) contacts[index] = contact;
    OfflineCache.saveContacts(contacts);
    OfflineQueue.addToQueue({
      type: 'update_contact',
      contactId,
      contact
    });
    return;
  }
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(contact)
    });
    
    if (response.ok) {
      const updated = await response.json();
      const index = contacts.findIndex(c => (c._id || c.id) === contactId);
      if (index !== -1) contacts[index] = updated;
      OfflineCache.saveContacts(contacts);
    }
  } catch (error) {
    console.error('Save error:', error);
    OfflineQueue.addToQueue({
      type: 'update_contact',
      contactId,
      contact
    });
  }
}

// ============== CONTACT PARSING ==============
function findSimilarContacts(name) {
  const similar = [];
  const nameLower = name.toLowerCase();
  
  contacts.forEach(contact => {
    const contactNameLower = contact.name.toLowerCase();
    if (contactNameLower === nameLower) {
      similar.push({ contact, similarity: 1.0, reason: 'exact' });
      return;
    }
    if (nameLower.startsWith(contactNameLower) || contactNameLower.startsWith(nameLower)) {
      similar.push({ contact, similarity: 0.9, reason: 'nickname' });
      return;
    }
    const distance = levenshteinDistance(nameLower, contactNameLower);
    if (distance <= 2) {
      similar.push({ contact, similarity: 0.8, reason: 'typo' });
      return;
    }
    const firstName1 = nameLower.split(' ')[0];
    const firstName2 = contactNameLower.split(' ')[0];
    if (firstName1 === firstName2 && nameLower.includes(' ') && contactNameLower.includes(' ')) {
      similar.push({ contact, similarity: 0.7, reason: 'same_first_name' });
    }
  });
  
  return similar.sort((a, b) => b.similarity - a.similarity);
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[str2.length][str1.length];
}

function parseContactInfo(text) {
  const result = { contacts: [] };
  const sentences = text.split(/[.!?\n,]+/).filter(s => s.trim());
  let currentPerson = null;
  let lastMentionedName = null;
  
  sentences.forEach(sentence => {
    sentence = sentence.trim();
    const lowerSentence = sentence.toLowerCase();
    
    const namePatterns = [
      /(?:met|spoke with|talked to|connected with|saw)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:does|is|works|owes|likes|wants)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'s?\s+(?:number|email|phone|birthday|meeting)/i,
      /(?:owe|owes|owed)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:meeting|call|lunch|dinner)\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:i\s+)?owe(?:s|d)?\s+([a-z]+(?:\s+[a-z]+)?)/i,
    ];
    
    let name = null;
    for (const pattern of namePatterns) {
      const match = sentence.match(pattern);
      if (match) {
        name = match[1].toLowerCase();
        break;
      }
    }
    
    if (!name) {
      const commonWords = ['i', 'me', 'my', 'the', 'a', 'an', 'is', 'was', 'were', 'are', 'he', 'she', 'it', 'this', 'that', 'yesterday', 'today', 'tomorrow', 'last', 'next', 'week', 'month', 'year', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const words = sentence.split(' ');
      for (const word of words) {
        const cleanWord = word.replace(/[^a-zA-Z]/g, '');
        if (cleanWord.length > 2 && cleanWord[0] === cleanWord[0].toUpperCase() && cleanWord === cleanWord[0] + cleanWord.slice(1).toLowerCase() && !commonWords.includes(cleanWord.toLowerCase()) && !/\d/.test(word)) {
          name = cleanWord.toLowerCase();
          break;
        }
      }
    }

    if (!name && lastMentionedName && /^(he|she|they|him|her|them)\s+/i.test(sentence)) {
      name = lastMentionedName;
    }

    if (name) {
      lastMentionedName = name;
      currentPerson = result.contacts.find(c => c.name === name);
      
      if (!currentPerson) {
        const phoneMatch = sentence.match(/(\d{3}[-.]?\d{3}[-.]?\d{4}|\d{10})/);
        const emailMatch = sentence.match(/([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
        const hasContactInfo = phoneMatch || emailMatch;
        const hasSkills = lowerSentence.match(/does\s+\w+|is\s+a\s+\w+|works\s+|specializes\s+in/);
        const hasContext = sentence.length > 20;
        
        if (!hasContactInfo && !hasSkills && !hasContext) return;
        
        currentPerson = {
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: name,
          skills: [],
          phone: null,
          email: null,
          notes: [],
          debts: [],
          reminders: [],
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        result.contacts.push(currentPerson);
      }
    }
    
    if (currentPerson) {
      const phoneMatch = sentence.match(/(\d{3}[-.]?\d{3}[-.]?\d{4}|\d{10})/);
      if (phoneMatch) currentPerson.phone = phoneMatch[1];
      
      const emailMatch = sentence.match(/([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
      if (emailMatch) currentPerson.email = emailMatch[1];
      
      const skillPatterns = [
        /(?:he|she|they)?\s*does\s+([\w\s]+?)(?:\s*,|\s+his|\s+her|\s+their|$)/i,
        /is\s+(?:a|an)\s+([\w\s]+?)(?:\s*,|\s+and|$)/i,
        /works?\s+(?:in|with|on|as)\s+([\w\s]+?)(?:\s*,|\s+and|$)/i,
        /specializes?\s+in\s+([\w\s]+?)(?:\s*,|\s+and|$)/i
      ];

      for (const pattern of skillPatterns) {
        const match = lowerSentence.match(pattern);
        if (match) {
          let skillText = match[1].trim();
          skillText = skillText.split(/\s+(his|her|their|the|number|phone|email)/i)[0].trim();
          skillText = skillText.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
          
          if (skillText.length > 2) {
            const skills = skillText.split(/\s+and\s+|\s*,\s+/);
            skills.forEach(skill => {
              skill = skill.trim();
              if (skill && skill.length > 2 && !/^\d+$/.test(skill) && !currentPerson.skills.includes(skill)) {
                currentPerson.skills.push(skill);
              }
            });
          }
        }
      }
      
      const debtPatterns = [
        /(?:i\s+)?owe(?:s|d)?\s+(?:him|her|them)?\s*\$?(\d+)/i,
        /(?:he|she|they)\s+owe(?:s)?\s+me\s*\$?(\d+)/i,
        /borrowed\s*\$?(\d+)\s+(?:from|to)/i,
        /lent\s+(?:him|her|them)?\s*\$?(\d+)/i
      ];
      
      for (const pattern of debtPatterns) {
        const match = lowerSentence.match(pattern);
        if (match) {
          const amount = match[1];
          const direction = lowerSentence.match(/owe(?:s|d)?\s+me|lent/) ? 'they_owe_me' : 'i_owe_them';
          currentPerson.debts.push({
            amount: parseFloat(amount),
            direction: direction,
            note: sentence,
            date: new Date().toISOString()
          });
        }
      }
    }
  });
  
  return result;
}

async function parseWithAI(text) {
  if (!navigator.onLine) return null;
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/contacts/parse-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ text })
    });
    if (response.ok) return await response.json();
  } catch (error) {
    console.log('AI parsing unavailable');
  }
  return null;
}

async function parseContactHybrid(text) {
  if (navigator.onLine) {
    try {
      const aiResult = await parseWithAI(text);
      if (aiResult && aiResult.contacts && aiResult.contacts.length > 0) {
        return aiResult;
      }
    } catch (err) {
      console.error('AI error:', err);
    }
  }
  return parseContactInfo(text);
}

function searchContacts(query) {
  query = query.toLowerCase().trim();
  return contacts.filter(contact => {
    if (contact.name.toLowerCase().includes(query)) return true;
    if (contact.skills && contact.skills.some(skill => skill.toLowerCase().includes(query))) return true;
    if (contact.notes && contact.notes.some(note => {
      const noteText = typeof note === 'string' ? note : note.text;
      return noteText && noteText.toLowerCase().includes(query);
    })) return true;
    return false;
  });
}

// ============== CHAT ==============
async function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  
  if (!text || isProcessing) return;
  
  input.value = '';
  isProcessing = true;
  
  addUserMessage(text);
  showLoading();
  
  await new Promise(resolve => setTimeout(resolve, 300));
  
  if (pendingConfirmation) {
    const response = text.toLowerCase();
    
    if (response.includes('yes') || response.includes('same')) {
      const existing = pendingConfirmation.existingContact;
      const newInfo = pendingConfirmation.newInfo;
      
      if (newInfo.phone && !existing.phone) existing.phone = newInfo.phone;
      if (newInfo.email && !existing.email) existing.email = newInfo.email;
      if (newInfo.skills) existing.skills = [...new Set([...existing.skills, ...newInfo.skills])];
      if (newInfo.notes) existing.notes = [...existing.notes, ...newInfo.notes];
      if (newInfo.debts) existing.debts = [...(existing.debts || []), ...newInfo.debts];
      if (newInfo.paymentMethods) existing.paymentMethods = [...(existing.paymentMethods || []), ...newInfo.paymentMethods];
      existing.updatedAt = new Date().toISOString();
      
      await syncContacts([existing]);
      Analytics.track('contact_merged', { name: existing.name });
      addBotMessage(`Updated ${existing.name}'s info!`);
      
      pendingConfirmation = null;
      hideLoading();
      isProcessing = false;
      return;
    } else if (response.includes('no') || response.includes('different')) {
      const newContact = pendingConfirmation.newInfo;
      await syncContacts([newContact]);
      Analytics.track('contact_added', { name: newContact.name });
      addBotMessage(`Added new contact: ${newContact.name}`);
      
      pendingConfirmation = null;
      hideLoading();
      isProcessing = false;
      return;
    } else {
      addBotMessage("Please answer 'yes' if same person, or 'no' if different.");
      hideLoading();
      isProcessing = false;
      return;
    }
  }
  
  let isQuery = false;
  if (contacts.length > 0) {
    if (navigator.onLine) {
      try {
        const intentResponse = await fetch(`${CONFIG.API_URL}/api/detect-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ text })
        });
        if (intentResponse.ok) {
          const intentData = await intentResponse.json();
          isQuery = intentData.intent === 'query';
        }
      } catch (err) {
        const queryWords = ['who', 'find', 'search', 'show', 'list', 'how much', 'owe', '?'];
        isQuery = queryWords.some(word => text.toLowerCase().includes(word));
      }
    } else {
      const queryWords = ['who', 'find', 'search', 'show', 'list', 'how much', 'owe', '?'];
      isQuery = queryWords.some(word => text.toLowerCase().includes(word));
    }
  }
 
  if (isQuery && contacts.length > 0) {
    Analytics.track('search_query', { query: text });
    
    if (navigator.onLine) {
      try {
        const searchResult = await fetch(`${CONFIG.API_URL}/api/contacts/search-ai`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ query: text, contacts })
        });
        if (searchResult.ok) {
          const data = await searchResult.json();
          addBotMessage(data.response);
          hideLoading();
          isProcessing = false;
          return;
        }
      } catch (err) {
        console.log('AI search failed');
      }
    }
    
    const results = searchContacts(text);
    if (results.length > 0) {
      let response = `Found ${results.length} match${results.length > 1 ? 'es' : ''}:\n\n`;
      results.forEach(contact => {
        response += `• ${contact.name.toUpperCase()}`;
        if (contact.skills?.length > 0) response += ` - ${contact.skills.join(', ')}`;
        if (contact.phone) response += ` | ${contact.phone}`;
        response += '\n';
      });
      addBotMessage(response);
    } else {
      addBotMessage("No matches found. Try a different search!");
    }
  } else {
    const parsed = await parseContactHybrid(text);
    
    if (parsed.contacts.length > 0) {
      const newContact = parsed.contacts[0];
      const similar = findSimilarContacts(newContact.name);
      
      if (similar.length > 0 && similar[0].similarity >= 0.7) {
        const match = similar[0];
        let reason = match.reason === 'exact' ? 'I already have this exact name.' :
                     match.reason === 'nickname' ? `This looks like a nickname of "${match.contact.name}".` :
                     match.reason === 'typo' ? `This is very similar to "${match.contact.name}".` :
                     `I have another "${match.contact.name.split(' ')[0]}" with a different last name.`;
        
        pendingConfirmation = { existingContact: match.contact, newInfo: newContact };
        addBotMessage(`${reason}\n\nIs this the same person? (yes/no)`);
      } else {
        const stats = await syncContacts([newContact]);
        if (stats) {
          Analytics.track('contact_added', { name: newContact.name });
          let response = `Added ${newContact.name}`;
          if (!navigator.onLine) response += ' (will sync when online)';
          addBotMessage(response);
        } else {
          addBotMessage("Saved locally. Will sync when online.");
        }
      }
    } else {
      addBotMessage("I didn't catch any contact info. Try 'John does photography, his number is 555-1234'");
    }
  }
  
  hideLoading();
  isProcessing = false;
}

function addUserMessage(text) {
  const messagesDiv = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user';
  messageDiv.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addBotMessage(text) {
  const messagesDiv = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message bot';
  messageDiv.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function showLoading() {
  const messagesDiv = document.getElementById('messages');
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loading';
  loadingDiv.className = 'loading';
  loadingDiv.innerHTML = '<div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div>';
  messagesDiv.appendChild(loadingDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.remove();
}

// ============== VIEW SWITCHING ==============
function switchView(view) {
  currentView = view;
  Analytics.track('view_switched', { view });
  
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  event.target.closest('.tab').classList.add('active');
  
  if (view === 'chat') {
    document.getElementById('chat-view').classList.remove('hidden');
    document.getElementById('contacts-view').classList.add('hidden');
  } else {
    document.getElementById('chat-view').classList.add('hidden');
    document.getElementById('contacts-view').classList.remove('hidden');
    renderContacts();
  }
}

// ============== RENDER CONTACTS ==============
function renderContacts() {
  const grid = document.getElementById('contacts-grid');
  
  if (contacts.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-title">No contacts yet</div><div class="empty-state-text">Start adding some!</div></div>';
    return;
  }
  
  const countText = document.getElementById('contacts-count-text');
  if (countText) countText.textContent = `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`;
  
  grid.innerHTML = '';
  contacts.forEach((contact, index) => {
    const card = document.createElement('div');
    card.className = 'contact-card';
    card.dataset.index = index;
    
    const isPending = OfflineQueue.getQueue().some(q => 
      q.contact?.name === contact.name || q.contactId === (contact._id || contact.id)
    );
    
    const notesCount = (contact.notes || []).length;
    const remindersCount = (contact.reminders || []).length;
    const contactId = contact._id || contact.id;
    
    let html = `
      <div class="contact-card-header">
        <h3 class="contact-name">${escapeHtml(contact.name)}${isPending ? ' <span class="pending-badge">⏳</span>' : ''}</h3>
        <div class="contact-actions">
          <button class="icon-btn-sm notes" onclick="openNotesModal('${contactId}')" title="Notes">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </button>
          <button class="icon-btn-sm reminder" onclick="openRemindersModal('${contactId}')" title="Reminders">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>
          <button class="icon-btn-sm" onclick="editContact('${contactId}')" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="icon-btn-sm delete" onclick="deleteContact('${contactId}')" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    if (contact.skills?.length > 0) {
      html += '<div class="skills">';
      contact.skills.forEach(skill => html += `<span class="skill-badge">${escapeHtml(skill)}</span>`);
      html += '</div>';
    }
    
    if (contact.phone) html += `<div class="contact-detail"><strong>Phone:</strong> ${escapeHtml(contact.phone)}</div>`;
    if (contact.email) html += `<div class="contact-detail"><strong>Email:</strong> ${escapeHtml(contact.email)}</div>`;
    
    // Notes & Reminders badges
    if (notesCount > 0 || remindersCount > 0) {
      html += '<div class="contact-meta">';
      if (notesCount > 0) {
        html += `<span class="meta-badge notes" onclick="openNotesModal('${contactId}')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
          </svg>
          ${notesCount} note${notesCount > 1 ? 's' : ''}
        </span>`;
      }
      if (remindersCount > 0) {
        html += `<span class="meta-badge reminders" onclick="openRemindersModal('${contactId}')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${remindersCount} reminder${remindersCount > 1 ? 's' : ''}
        </span>`;
      }
      html += '</div>';
    }
    
    if (contact.debts?.length > 0) {
      contact.debts.forEach(debt => {
        const direction = debt.direction === 'i_owe_them' ? 'You owe' : 'They owe you';
        const badgeClass = debt.direction === 'i_owe_them' ? 'owe-them' : 'owe-me';
        html += `<span class="debt-badge ${badgeClass}">💰 ${direction}: $${debt.amount}</span>`;
      });
    }
    
    if (contact.paymentMethods?.length > 0) {
      contact.paymentMethods.forEach(pm => {
        const username = pm.username ? `: ${pm.username}` : '';
        html += `<span class="payment-badge ${pm.type}">💳 ${pm.type}${username}</span>`;
      });
    }
    
    card.innerHTML = html;
    grid.appendChild(card);
  });
  
  initSwipeToDelete();
}

function updateContactCount() {
  document.getElementById('contact-count').textContent = contacts.length;
}

// ============== MODALS ==============
function openQuickAdd() {
  Analytics.track('quick_add_opened');
  document.getElementById('quick-add-modal').classList.remove('hidden');
  document.getElementById('qa-name').focus();
}

function closeQuickAdd() {
  document.getElementById('quick-add-modal').classList.add('hidden');
  document.getElementById('qa-name').value = '';
  document.getElementById('qa-phone').value = '';
  document.getElementById('qa-email').value = '';
  document.getElementById('qa-skills').value = '';
  document.getElementById('qa-notes').value = '';
}

async function submitQuickAdd() {
  const name = document.getElementById('qa-name').value.trim().toLowerCase();
  const phone = document.getElementById('qa-phone').value.trim() || null;
  const email = document.getElementById('qa-email').value.trim() || null;
  const skillsText = document.getElementById('qa-skills').value.trim();
  const notesText = document.getElementById('qa-notes').value.trim();
  
  if (!name) {
    alert('Name is required!');
    return;
  }
  
  const skills = skillsText ? skillsText.split(',').map(s => s.trim()).filter(s => s) : [];
  const notes = notesText ? [{ text: notesText, date: new Date().toISOString() }] : [];
  
  const newContact = {
    id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name, skills, phone, email, notes,
    debts: [], reminders: [], metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const similar = findSimilarContacts(name);
  
  if (similar.length > 0 && similar[0].similarity >= 0.7) {
    const merge = confirm(`Similar contact "${similar[0].contact.name}" exists. Merge info?`);
    if (merge) {
      const existing = similar[0].contact;
      if (phone && !existing.phone) existing.phone = phone;
      if (email && !existing.email) existing.email = email;
      existing.skills = [...new Set([...existing.skills, ...skills])];
      existing.notes = [...existing.notes, ...notes];
      existing.updatedAt = new Date().toISOString();
      await syncContacts([existing]);
      Analytics.track('contact_merged', { name: existing.name });
      addBotMessage(`Updated ${existing.name}!`);
    } else {
      await syncContacts([newContact]);
      Analytics.track('contact_added', { name: newContact.name });
      addBotMessage(`Added ${name}!`);
    }
  } else {
    await syncContacts([newContact]);
    Analytics.track('contact_added', { name: newContact.name });
    addBotMessage(`Added ${name}!`);
  }
  
  closeQuickAdd();
}

function editContact(contactId) {
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  Analytics.track('contact_edit_opened');
  
  document.getElementById('edit-contact-id').value = contactId;
  document.getElementById('edit-name').value = contact.name || '';
  document.getElementById('edit-phone').value = contact.phone || '';
  document.getElementById('edit-email').value = contact.email || '';
  document.getElementById('edit-skills').value = (contact.skills || []).join(', ');
  
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

async function submitEdit() {
  const contactId = document.getElementById('edit-contact-id').value;
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  contact.name = document.getElementById('edit-name').value.trim().toLowerCase();
  contact.phone = document.getElementById('edit-phone').value.trim() || null;
  contact.email = document.getElementById('edit-email').value.trim() || null;
  contact.skills = document.getElementById('edit-skills').value.split(',').map(s => s.trim()).filter(s => s);
  contact.updatedAt = new Date().toISOString();
  
  await saveContact(contact);
  renderContacts();
  closeEditModal();
  
  Analytics.track('contact_edited');
  addBotMessage(`Updated ${contact.name}!`);
}

async function deleteContact(contactId) {
  if (!confirm('Delete this contact?')) return;
  
  if (!navigator.onLine) {
    contacts = contacts.filter(c => (c._id || c.id) !== contactId);
    OfflineCache.saveContacts(contacts);
    OfflineQueue.addToQueue({ type: 'delete_contact', contactId });
    updateContactCount();
    renderContacts();
    Analytics.track('contact_deleted');
    addBotMessage('Contact deleted! (will sync when online)');
    return;
  }
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/contacts/${contactId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      Analytics.track('contact_deleted');
      contacts = contacts.filter(c => (c._id || c.id) !== contactId);
      OfflineCache.saveContacts(contacts);
      updateContactCount();
      renderContacts();
      addBotMessage('Contact deleted!');
    } else {
      addBotMessage('Failed to delete contact.');
    }
  } catch (error) {
    console.error('Delete error:', error);
    OfflineQueue.addToQueue({ type: 'delete_contact', contactId });
    contacts = contacts.filter(c => (c._id || c.id) !== contactId);
    OfflineCache.saveContacts(contacts);
    updateContactCount();
    renderContacts();
    addBotMessage('Contact deleted locally. Will sync when online.');
  }
}

// ============== FEEDBACK ==============
function openFeedback() {
  Analytics.track('feedback_opened');
  document.getElementById('feedback-modal').classList.remove('hidden');
}

function closeFeedback() {
  document.getElementById('feedback-modal').classList.add('hidden');
  document.getElementById('feedback-text').value = '';
  document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
}

async function submitFeedback() {
  const text = document.getElementById('feedback-text').value.trim();
  const type = document.getElementById('feedback-type').value;
  
  let rating = 0;
  document.querySelectorAll('.rating-btn.selected').forEach(btn => {
    rating = parseInt(btn.dataset.rating);
  });
  
  if (!rating && !text) {
    alert('Please rate your experience or leave a comment!');
    return;
  }
  
  Analytics.track('feedback_submitted', { rating, type });
  
  if (navigator.onLine) {
    try {
      await fetch(`${CONFIG.API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ rating, text, type, timestamp: new Date().toISOString() })
      });
    } catch (err) {
      console.log('Feedback error:', err);
    }
  }
  
  closeFeedback();
  addBotMessage('Thanks for your feedback! 💜');
}

// ============== LOGOUT ==============
function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    Analytics.track('user_logout');
    Analytics.reset();
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
    window.location.replace(CONFIG.AUTH_PAGE);
  }
}

// ============== UTILITIES ==============
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============== SWIPE TO DELETE ==============
let touchStartX = 0;
let touchCurrentX = 0;
let swipingCard = null;
const SWIPE_THRESHOLD = 100;

function initSwipeToDelete() {
  const grid = document.getElementById('contacts-grid');
  if (!grid) return;
  
  grid.removeEventListener('touchstart', handleTouchStart);
  grid.removeEventListener('touchmove', handleTouchMove);
  grid.removeEventListener('touchend', handleTouchEnd);
  
  grid.addEventListener('touchstart', handleTouchStart, { passive: true });
  grid.addEventListener('touchmove', handleTouchMove, { passive: false });
  grid.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function handleTouchStart(e) {
  const card = e.target.closest('.contact-card');
  if (!card) return;
  touchStartX = e.touches[0].clientX;
  touchCurrentX = 0;
  swipingCard = card;
}

function handleTouchMove(e) {
  if (!swipingCard) return;
  touchCurrentX = e.touches[0].clientX;
  const diffX = touchStartX - touchCurrentX;
  if (diffX > 0) {
    e.preventDefault();
    const moveX = Math.min(diffX, 150);
    swipingCard.style.transform = `translateX(-${moveX}px)`;
    swipingCard.classList.add('swiping');
  }
}

function handleTouchEnd() {
  if (!swipingCard) return;
  const diffX = touchStartX - touchCurrentX;
  
  if (diffX > SWIPE_THRESHOLD && touchCurrentX !== 0) {
    const index = swipingCard.dataset.index;
    const contact = contacts[index];
    if (contact) {
      if (navigator.vibrate) navigator.vibrate(50);
      swipingCard.style.transform = 'translateX(-100%)';
      swipingCard.style.opacity = '0';
      setTimeout(() => deleteContact(contact._id || contact.id), 200);
    }
  } else {
    swipingCard.style.transform = '';
    swipingCard.classList.remove('swiping');
  }
  
  swipingCard = null;
  touchStartX = 0;
  touchCurrentX = 0;
}

// ============== INIT ==============
document.addEventListener('DOMContentLoaded', init);