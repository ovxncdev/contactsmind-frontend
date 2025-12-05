// chat.js - Chat & Message Handling

let isProcessing = false;
let pendingConfirmation = null;

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
    await handleConfirmation(text);
    hideLoading();
    isProcessing = false;
    return;
  }
  
  const isQuery = await detectIntent(text);
  
  if (isQuery && contacts.length > 0) {
    await handleQuery(text);
  } else {
    await handleAddContact(text);
  }
  
  hideLoading();
  isProcessing = false;
}

async function handleConfirmation(text) {
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
  } else if (response.includes('no') || response.includes('different')) {
    const newContact = pendingConfirmation.newInfo;
    await syncContacts([newContact]);
    Analytics.track('contact_added', { name: newContact.name });
    addBotMessage(`Added new contact: ${newContact.name}`);
    pendingConfirmation = null;
  } else {
    addBotMessage("Please answer 'yes' if same person, or 'no' if different.");
  }
}

async function detectIntent(text) {
  if (contacts.length === 0) return false;
  
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
        return intentData.intent === 'query';
      }
    } catch (err) {}
  }
  
  const queryWords = ['who', 'find', 'search', 'show', 'list', 'how much', 'owe', '?'];
  return queryWords.some(word => text.toLowerCase().includes(word));
}

async function handleQuery(text) {
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
}

async function handleAddContact(text) {
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