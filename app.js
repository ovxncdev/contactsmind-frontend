// app.js - Main Application Logic

// State
let authToken = localStorage.getItem('authToken');
let currentUser = null;
let contacts = [];
let currentView = 'chat';
let isProcessing = false;
let pendingConfirmation = null; // For duplicate detection

// Initialize
function init() {
  // Check if logged in
  if (!authToken) {
    window.location.href = CONFIG.AUTH_PAGE;
    return;
  }

  // Verify token and load app
  verifyToken();
  
  // Setup event listeners
  setupEventListeners();
}

async function verifyToken() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      currentUser = await response.json();
      await loadContacts();
      addBotMessage(`Welcome back! You have ${contacts.length} contacts saved.`);
    } else {
      // Token invalid, redirect to login
      localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      window.location.href = CONFIG.AUTH_PAGE;
    }
  } catch (error) {
    console.error('Token verification failed:', error);
    window.location.href = CONFIG.AUTH_PAGE;
  }
}

function setupEventListeners() {
  // Enter key for message input
  document.getElementById('save-edit-btn')?.addEventListener('click', submitEdit);
  document.getElementById('message-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

// ========================================
// CONTACT MANAGEMENT
// ========================================

async function loadContacts() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/contacts`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.ok) {
      contacts = await response.json();
      updateContactCount();
      renderContacts();
    }
  } catch (error) {
    console.error('Load contacts error:', error);
  }
}

async function syncContacts(newContacts) {
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
      updateContactCount();
      renderContacts();
      return data.stats;
    }
  } catch (error) {
    console.error('Sync error:', error);
    return null;
  }
}

// ========================================
// CONTACT PARSING
// ========================================
// === FUZZY NAME MATCHING ===
function findSimilarContacts(name) {
  const similar = [];
  const nameLower = name.toLowerCase();
  
  contacts.forEach(contact => {
    const contactNameLower = contact.name.toLowerCase();
    
    // Exact match
    if (contactNameLower === nameLower) {
      similar.push({ contact, similarity: 1.0, reason: 'exact' });
      return;
    }
    
    // Nickname/shortened (Sam vs Samson)
    if (nameLower.startsWith(contactNameLower) || contactNameLower.startsWith(nameLower)) {
      similar.push({ contact, similarity: 0.9, reason: 'nickname' });
      return;
    }
    
    // Typo/close match (Samson vs Samsoon)
    const distance = levenshteinDistance(nameLower, contactNameLower);
    if (distance <= 2) {
      similar.push({ contact, similarity: 0.8, reason: 'typo' });
      return;
    }
    
    // Same first name, different last (John Smith vs John Doe)
    const firstName1 = nameLower.split(' ')[0];
    const firstName2 = contactNameLower.split(' ')[0];
    if (firstName1 === firstName2 && nameLower.includes(' ') && contactNameLower.includes(' ')) {
      similar.push({ contact, similarity: 0.7, reason: 'same_first_name' });
    }
  });
  
  return similar.sort((a, b) => b.similarity - a.similarity);
}

// Levenshtein distance (edit distance)
function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}


// Enhanced parseContactInfo with context tracking
function parseContactInfo(text) {
  const result = { contacts: [] };
  const sentences = text.split(/[.!?\n,]+/).filter(s => s.trim()); // Split on commas too
  let currentPerson = null;
  let lastMentionedName = null; // Track the last name mentioned
  
  sentences.forEach(sentence => {
    sentence = sentence.trim();
    const lowerSentence = sentence.toLowerCase();
    
    // === NAME EXTRACTION ===
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
    
    // Fallback: Find capitalized words
    if (!name) {
        const commonWords = ['i', 'me', 'my', 'the', 'a', 'an', 'is', 'was', 'were', 'are', 'he', 'she', 'it', 'this', 'that', 'yesterday', 'today', 'tomorrow', 'last', 'next', 'week', 'month', 'year', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const words = sentence.split(' ');
      for (const word of words) {
        const cleanWord = word.replace(/[^a-zA-Z]/g, '');
        if (cleanWord.length > 2 && 
            cleanWord[0] === cleanWord[0].toUpperCase() && 
            cleanWord === cleanWord[0] + cleanWord.slice(1).toLowerCase() &&
            !commonWords.includes(cleanWord.toLowerCase()) &&
            !/\d/.test(word)) {
          name = cleanWord.toLowerCase();
          break;
        }
      }
    }

    // Handle pronouns (he/she/they) referring to last mentioned person
    if (!name && lastMentionedName && /^(he|she|they|him|her|them)\s+/i.test(sentence)) {
      name = lastMentionedName;
    }

    // Create or find contact
    if (name) {
      lastMentionedName = name; // Remember this name for next sentence
      
      // Check if we already have this contact in current parse
      currentPerson = result.contacts.find(c => c.name === name);
      
      // If new contact, validate we have meaningful info
      if (!currentPerson) {
        const phoneMatch = sentence.match(/(\d{3}[-.]?\d{3}[-.]?\d{4}|\d{10})/);
        const emailMatch = sentence.match(/([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
        const hasContactInfo = phoneMatch || emailMatch;
        const hasSkills = lowerSentence.match(/does\s+\w+|is\s+a\s+\w+|works\s+|specializes\s+in/);
        const hasContext = sentence.length > 20;
        
        // Skip if just a name with no other info
        if (!hasContactInfo && !hasSkills && !hasContext) {
          return; // Don't create contact
        }
        
        // Create new contact
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
      // === CONTACT INFO ===
      const phoneMatch = sentence.match(/(\d{3}[-.]?\d{3}[-.]?\d{4}|\d{10})/);
      if (phoneMatch) currentPerson.phone = phoneMatch[1];
      
      const emailMatch = sentence.match(/([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
      if (emailMatch) currentPerson.email = emailMatch[1];
      
      // === SKILLS ===
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
          // AGGRESSIVE CLEANING
          skillText = skillText.split(/\s+(his|her|their|the|number|phone|email|with\s+number|and\s+his|and\s+her)/i)[0].trim();
          skillText = skillText.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
          skillText = skillText.replace(/\s+(with|at|is)$/i, '').trim();
          
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
      
      // === DEBTS ===
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
      
      // === REMINDERS/MEETINGS ===
      const reminderPatterns = [
        /meeting\s+(?:with\s+)?(?:on|by|next)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)/i,
        /(?:on|by)\s+([a-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i,
        /(?:call|email|contact|reach out to)\s+(?:him|her|them)?\s*(?:on|by|about)/i
      ];
      
      for (const pattern of reminderPatterns) {
        const match = sentence.match(pattern);
        if (match) {
          currentPerson.reminders.push({
            text: sentence,
            date: match[1] || 'unspecified',
            createdAt: new Date().toISOString()
          });
        }
      }
      
      // === PREFERENCES/METADATA ===
      const preferencePatterns = [
        /likes?\s+([\w\s]+?)(?:\s+and|\s*,|$)/i,
        /allergic to\s+([\w\s]+?)(?:\s+and|\s*,|$)/i,
        /(?:works?|worked)\s+at\s+([\w\s]+?)(?:\s+as|\s*,|$)/i,
        /(?:lives?|lived)\s+(?:in|at)\s+([\w\s]+?)(?:\s*,|$)/i,
        /birthday\s+(?:is\s+)?(?:on\s+)?([a-z]+\s+\d{1,2})/i
      ];
      
      for (const pattern of preferencePatterns) {
        const match = lowerSentence.match(pattern);
        if (match) {
          const key = pattern.source.split(/[\s(]/)[0];
          currentPerson.metadata[key] = match[1].trim();
        }
      }
      
      // === GENERAL NOTES ===
      const isInfoExtraction = lowerSentence.match(/number is|email is|does\s+\w+|is\s+a\s+\w+/);
      if (sentence.length > 15 && !isInfoExtraction) {
        currentPerson.notes.push({
          text: sentence,
          date: new Date().toISOString()
        });
      }
    }
  });
  
  return result;
}
// === AI-POWERED PARSING (Optional Enhancement) ===
async function parseWithAI(text) {
  // Check if online
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
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log('AI parsing unavailable, using regex fallback');
  }
  
  return null;
}

// === SIMPLE AI-FIRST PARSER ===
async function parseContactHybrid(text) {
  // If online, always use AI
  if (navigator.onLine) {
    console.log('🤖 Using AI parsing...');
    try {
      const aiResult = await parseWithAI(text);
      console.log('📦 AI returned:', aiResult);
      
      if (aiResult && aiResult.contacts && aiResult.contacts.length > 0) {
        console.log('✅ AI result:', aiResult);
        return aiResult;
      }
    } catch (err) {
      console.error('❌ AI error:', err);
    }
  }
  
  // Fallback to regex
  console.log('⚠️ Using regex fallback');
  return parseContactInfo(text);
}

// Cache messages for offline sync
function cacheMessageForSync(text) {
  const cached = JSON.parse(localStorage.getItem('pendingMessages') || '[]');
  cached.push({
    text: text,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('pendingMessages', JSON.stringify(cached));
}

// Sync cached messages when back online
async function syncCachedMessages() {
  const cached = JSON.parse(localStorage.getItem('pendingMessages') || '[]');
  
  if (cached.length === 0) return;
  
  console.log(`📤 Syncing ${cached.length} cached messages...`);
  
  for (const msg of cached) {
    const result = await parseWithAI(msg.text);
    if (result && result.contacts && result.contacts.length > 0) {
      await syncContacts(result.contacts);
    }
  }
  
  // Clear cache after sync
  localStorage.removeItem('pendingMessages');
  console.log('✅ Cached messages synced!');
}

// Check for cached messages on load
window.addEventListener('online', () => {
  console.log('🌐 Back online - syncing cached messages...');
  syncCachedMessages();
});

function searchContacts(query) {
  query = query.toLowerCase().trim();
  
  return contacts.filter(contact => {
    // Search in name
    if (contact.name.toLowerCase().includes(query)) return true;
    
    // Search in skills
    if (contact.skills && contact.skills.length > 0) {
      for (const skill of contact.skills) {
        const skillLower = skill.toLowerCase();
        // Direct match
        if (skillLower.includes(query)) return true;
        
        // Multi-word query: check if ALL words in query exist in skill
        const queryWords = query.split(/\s+/).filter(w => w.length > 2); // Filter out "who", "does"
        if (queryWords.length > 0 && queryWords.every(word => skillLower.includes(word))) {
          return true;
        }
      }
    }
    
    // Search in notes
    if (contact.notes && contact.notes.length > 0) {
      for (const note of contact.notes) {
        const noteText = typeof note === 'string' ? note : note.text;
        if (noteText && noteText.toLowerCase().includes(query)) return true;
      }
    }
    
    return false;
  });
}

// ========================================
// MESSAGE HANDLING
// ========================================

async function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  
  if (!text || isProcessing) return;
  
  input.value = '';
  isProcessing = true;
  
  addUserMessage(text);
  showLoading();
  
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Handle pending confirmations
  if (pendingConfirmation) {
    const response = text.toLowerCase();
    
    if (response.includes('yes') || response.includes('same')) {
      // Merge with existing contact
      const existing = pendingConfirmation.existingContact;
      const newInfo = pendingConfirmation.newInfo;
      
      // Merge data
      if (newInfo.phone && !existing.phone) existing.phone = newInfo.phone;
      if (newInfo.email && !existing.email) existing.email = newInfo.email;
      if (newInfo.skills) existing.skills = [...new Set([...existing.skills, ...newInfo.skills])];
      if (newInfo.notes) existing.notes = [...existing.notes, ...newInfo.notes];
      if (newInfo.debts) existing.debts = [...(existing.debts || []), ...newInfo.debts];
      if (newInfo.reminders) existing.reminders = [...(existing.reminders || []), ...newInfo.reminders];
      if (newInfo.paymentMethods) existing.paymentMethods = [...(existing.paymentMethods || []), ...newInfo.paymentMethods];

      existing.updatedAt = new Date().toISOString();
      
      await syncContacts([existing]);
      addBotMessage(`Updated ${existing.name}'s info!`);
      
      pendingConfirmation = null;
      hideLoading();
      isProcessing = false;
      return;
    } else if (response.includes('no') || response.includes('different')) {
      // Create new contact
      const newContact = pendingConfirmation.newInfo;
      await syncContacts([newContact]);
      addBotMessage(`Added new contact: ${newContact.name}`);
      
      pendingConfirmation = null;
      hideLoading();
      isProcessing = false;
      return;
    } else {
      addBotMessage("Please answer 'yes' if same person, or 'no' if different person.");
      hideLoading();
      isProcessing = false;
      return;
    }
  }
  
  // Check if query
  let isQuery = false;
    if (navigator.onLine && contacts.length > 0) {
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
        console.log('🧠 AI Intent:', intentData.intent);
        }
    } catch (err) {
        console.log('Intent detection failed, using fallback');
        // Fallback to keyword matching
        const queryWords = ['who', 'find', 'search', 'show', 'list', 'how much', 'owe', '?'];
        isQuery = queryWords.some(word => text.toLowerCase().includes(word));
    }
    }
 
  if (isQuery && contacts.length > 0) {
    // Use AI for smart search
    if (navigator.onLine) {
        try {
        const searchResult = await fetch(`${CONFIG.API_URL}/api/contacts/search-ai`, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ query: text, contacts: contacts })
        });
        
        if (searchResult.ok) {
            const data = await searchResult.json();
            addBotMessage(data.response);
            hideLoading();
            isProcessing = false;
            return;
        }
        } catch (err) {
        console.log('AI search failed, using local search');
        }
    }
    
    // Fallback to local search
    const results = searchContacts(text);
    
    if (results.length > 0) {
        let response = `Found ${results.length} match${results.length > 1 ? 'es' : ''}:\n\n`;
        results.forEach(contact => {
        response += `**${contact.name.toUpperCase()}**\n`;
        if (contact.skills && contact.skills.length > 0) {
            response += `Skills: ${contact.skills.join(', ')}\n`;
        }
        if (contact.phone) response += `Phone: ${contact.phone}\n`;
        if (contact.email) response += `Email: ${contact.email}\n`;
        if (contact.paymentMethods && contact.paymentMethods.length > 0) {
            response += `Payment: ${contact.paymentMethods.map(p => p.type).join(', ')}\n`;
        }
        if (contact.debts && contact.debts.length > 0) {
            contact.debts.forEach(debt => {
            const dir = debt.direction === 'i_owe_them' ? 'You owe' : 'They owe you';
            response += `${dir}: $${debt.amount}\n`;
            });
        }
        response += '\n';
        });
        addBotMessage(response);
    } else {
        addBotMessage("No matches found. Try a different search!");
    }
    } else {
    // Parse new contact
    const parsed = await parseContactHybrid(text);
    
    if (parsed.contacts.length > 0) {
      const newContact = parsed.contacts[0];
      
      // Check for similar existing contacts
      const similar = findSimilarContacts(newContact.name);
      
      if (similar.length > 0 && similar[0].similarity >= 0.7) {
        const match = similar[0];
        let reason = '';
        
        if (match.reason === 'exact') {
          reason = 'I already have this exact name.';
        } else if (match.reason === 'nickname') {
          reason = `This looks like a nickname of "${match.contact.name}".`;
        } else if (match.reason === 'typo') {
          reason = `This is very similar to "${match.contact.name}".`;
        } else if (match.reason === 'same_first_name') {
          reason = `I have another "${match.contact.name.split(' ')[0]}" with a different last name.`;
        }
        
        pendingConfirmation = {
          existingContact: match.contact,
          newInfo: newContact
        };
        
        addBotMessage(`${reason}\n\nIs this the same person? (yes/no)`);
      } else {
        // No duplicates, create new
        const stats = await syncContacts([newContact]);
        
        if (stats) {
          let response = 'Got it! ';
          if (stats.created > 0) response += `Added ${newContact.name}.`;
          if (stats.updated > 0) response += `Updated info.`;
          addBotMessage(response);
        } else {
          addBotMessage("Saved locally. Will sync when connection is available.");
        }
      }
    } else {
      addBotMessage("I didn't catch any contact info. Try 'John does photography, his number is 555-1234'");
    }
  }
  
  hideLoading();
  isProcessing = false;
}

// ========================================
// UI FUNCTIONS
// ========================================

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

function switchView(view) {
  currentView = view;
  
  const tabs = document.querySelectorAll('.tab:not(.logout-btn)');
  tabs.forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');
  
  if (view === 'chat') {
    document.getElementById('chat-view').classList.remove('hidden');
    document.getElementById('contacts-view').classList.add('hidden');
  } else {
    document.getElementById('chat-view').classList.add('hidden');
    document.getElementById('contacts-view').classList.remove('hidden');
    renderContacts();
  }
}

function renderContacts() {
  const grid = document.getElementById('contacts-grid');
  
  if (contacts.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-title">No contacts yet</div><div class="empty-state-text">Start adding some!</div></div>';
    return;
  }
  
  // Update count text
  const countText = document.getElementById('contacts-count-text');
  if (countText) countText.textContent = `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`;
  
  grid.innerHTML = '';
  contacts.forEach((contact, index) => {
    const card = document.createElement('div');
    card.className = 'contact-card';
    card.dataset.index = index;
    
    const contactId = contact._id || contact.id;
    
    let html = `
      <div class="contact-card-header">
        <h3 class="contact-name">${escapeHtml(contact.name)}</h3>
        <div class="contact-actions">
          <button class="icon-btn-sm edit-btn" data-index="${index}" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="icon-btn-sm delete delete-btn" data-index="${index}" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    if (contact.skills && contact.skills.length > 0) {
      html += '<div class="skills">';
      contact.skills.forEach(skill => {
        html += `<span class="skill-badge">${escapeHtml(skill)}</span>`;
      });
      html += '</div>';
    }
    
    if (contact.phone) {
      html += `<div class="contact-detail"><strong>Phone:</strong> ${escapeHtml(contact.phone)}</div>`;
    }
    
    if (contact.email) {
      html += `<div class="contact-detail"><strong>Email:</strong> ${escapeHtml(contact.email)}</div>`;
    }
    
    if (contact.debts && contact.debts.length > 0) {
      contact.debts.forEach(debt => {
        const direction = debt.direction === 'i_owe_them' ? 'You owe' : 'They owe you';
        const badgeClass = debt.direction === 'i_owe_them' ? 'owe-them' : 'owe-me';
        html += `<span class="debt-badge ${badgeClass}">💰 ${direction}: $${debt.amount}</span>`;
      });
    }
    
    if (contact.paymentMethods && contact.paymentMethods.length > 0) {
      contact.paymentMethods.forEach(pm => {
        const username = pm.username ? `: ${pm.username}` : '';
        html += `<span class="payment-badge ${pm.type}">💳 ${pm.type}${username}</span>`;
      });
    }
    
    card.innerHTML = html;
    grid.appendChild(card);
  });
  
  // Add event listeners after rendering
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = e.currentTarget.dataset.index;
      const contact = contacts[index];
      if (contact) editContact(contact._id || contact.id);
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = e.currentTarget.dataset.index;
      const contact = contacts[index];
      if (contact) deleteContact(contact._id || contact.id);
    });
  });
}

function updateContactCount() {
  document.getElementById('contact-count').textContent = contacts.length;
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
    window.location.href = CONFIG.AUTH_PAGE;
  }
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start the app
document.addEventListener('DOMContentLoaded', init);

// ========================================
// QUICK ADD FUNCTIONS
// ========================================

function openQuickAdd() {
  document.getElementById('quick-add-modal').classList.remove('hidden');
}

function closeQuickAdd() {
  document.getElementById('quick-add-modal').classList.add('hidden');
  // Clear form
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
    name: name,
    skills: skills,
    phone: phone,
    email: email,
    notes: notes,
    debts: [],
    reminders: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Check for duplicates
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
      addBotMessage(`Updated ${existing.name}'s info!`);
    } else {
      await syncContacts([newContact]);
      addBotMessage(`Added ${name}!`);
    }
  } else {
    await syncContacts([newContact]);
    addBotMessage(`Added ${name}!`);
  }
  
  closeQuickAdd();
}
// ========================================
// DELETE & EDIT FUNCTIONS
// ========================================

async function deleteContact(contactId) {
  if (!confirm('Delete this contact?')) return;
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/contacts/${contactId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.ok) {
      contacts = contacts.filter(c => c.id !== contactId);
      updateContactCount();
      renderContacts();
      addBotMessage('Contact deleted!');
    } else {
      addBotMessage('Failed to delete contact.');
    }
  } catch (error) {
    console.error('Delete error:', error);
    addBotMessage('Error deleting contact.');
  }
}

function editContact(contactId) {
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  // Populate edit modal
  document.getElementById('edit-contact-id').value = contact._id || contact.id;
  document.getElementById('edit-name').value = contact.name || '';
  document.getElementById('edit-phone').value = contact.phone || '';
  document.getElementById('edit-email').value = contact.email || '';
  document.getElementById('edit-skills').value = (contact.skills || []).join(', ');
  
  // Show modal
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

async function submitEdit() {
  const contactId = document.getElementById('edit-contact-id').value;
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  // Update contact data
  contact.name = document.getElementById('edit-name').value.trim().toLowerCase();
  contact.phone = document.getElementById('edit-phone').value.trim() || null;
  contact.email = document.getElementById('edit-email').value.trim() || null;
  contact.skills = document.getElementById('edit-skills').value
    .split(',')
    .map(s => s.trim())
    .filter(s => s);
  contact.updatedAt = new Date().toISOString();
  
  // Sync to server
  // Update on server
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
    renderContacts();
  }
} catch (error) {
  console.error('Update error:', error);
}
  
  closeEditModal();
  addBotMessage(`Updated ${contact.name}!`);
}
// ========================================
// MOBILE UX: SWIPE TO DELETE
// ========================================

let touchStartX = 0;
let touchCurrentX = 0;
let swipingCard = null;
const SWIPE_THRESHOLD = 100;

function initSwipeToDelete() {
  const grid = document.getElementById('contacts-grid');
  if (!grid) return;

  grid.addEventListener('touchstart', handleTouchStart, { passive: true });
  grid.addEventListener('touchmove', handleTouchMove, { passive: false });
  grid.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function handleTouchStart(e) {
  const card = e.target.closest('.contact-card');
  if (!card) return;
  
  touchStartX = e.touches[0].clientX;
  swipingCard = card;
}

function handleTouchMove(e) {
  if (!swipingCard) return;
  
  touchCurrentX = e.touches[0].clientX;
  const diffX = touchStartX - touchCurrentX;
  
  // Only allow left swipe
  if (diffX > 0) {
    e.preventDefault();
    const moveX = Math.min(diffX, 150);
    swipingCard.style.transform = `translateX(-${moveX}px)`;
    swipingCard.classList.add('swiping');
  }
}

function handleTouchEnd(e) {
  if (!swipingCard) return;
  
  const diffX = touchStartX - touchCurrentX;
  
  if (diffX > SWIPE_THRESHOLD) {
    // Trigger delete
    const index = swipingCard.dataset.index;
    const contact = contacts[index];
    if (contact) {
      // Vibrate if available
      if (navigator.vibrate) navigator.vibrate(50);
      
      // Animate out
      swipingCard.style.transform = 'translateX(-100%)';
      swipingCard.style.opacity = '0';
      
      setTimeout(() => {
        deleteContact(contact._id || contact.id);
      }, 200);
    }
  } else {
    // Reset position
    swipingCard.style.transform = '';
  }
  
  swipingCard.classList.remove('swiping');
  swipingCard = null;
  touchStartX = 0;
  touchCurrentX = 0;
}

// ========================================
// MOBILE UX: PULL TO REFRESH
// ========================================

let pullStartY = 0;
let isPulling = false;
const PULL_THRESHOLD = 80;

function initPullToRefresh() {
  const contactsView = document.getElementById('contacts-view');
  if (!contactsView) return;
  
  // Add pull indicator
  const pullIndicator = document.createElement('div');
  pullIndicator.className = 'pull-to-refresh';
  pullIndicator.innerHTML = `
    <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    <span class="pull-text">Pull to refresh</span>
  `;
  contactsView.insertBefore(pullIndicator, contactsView.firstChild);
  
  contactsView.addEventListener('touchstart', (e) => {
    if (contactsView.scrollTop === 0) {
      pullStartY = e.touches[0].clientY;
      isPulling = true;
    }
  }, { passive: true });
  
  contactsView.addEventListener('touchmove', (e) => {
    if (!isPulling) return;
    
    const pullDistance = e.touches[0].clientY - pullStartY;
    
    if (pullDistance > 0 && contactsView.scrollTop === 0) {
      const pull = Math.min(pullDistance * 0.5, 100);
      pullIndicator.style.transform = `translateY(${pull}px)`;
      
      if (pull > PULL_THRESHOLD) {
        pullIndicator.querySelector('.pull-text').textContent = 'Release to refresh';
      } else {
        pullIndicator.querySelector('.pull-text').textContent = 'Pull to refresh';
      }
    }
  }, { passive: true });
  
  contactsView.addEventListener('touchend', async () => {
    if (!isPulling) return;
    
    const pullIndicatorEl = document.querySelector('.pull-to-refresh');
    const currentPull = parseFloat(pullIndicatorEl.style.transform.replace(/[^0-9.-]/g, '')) || 0;
    
    if (currentPull > PULL_THRESHOLD) {
      // Trigger refresh
      pullIndicatorEl.classList.add('refreshing');
      pullIndicatorEl.querySelector('.pull-text').textContent = 'Refreshing...';
      
      if (navigator.vibrate) navigator.vibrate(30);
      
      await loadContacts();
      
      pullIndicatorEl.classList.remove('refreshing');
    }
    
    pullIndicatorEl.style.transform = '';
    isPulling = false;
    pullStartY = 0;
  }, { passive: true });
}

// Initialize mobile UX on load
document.addEventListener('DOMContentLoaded', () => {
  initSwipeToDelete();
  initPullToRefresh();
});