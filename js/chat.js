// chat.js - Chat Interface

let isProcessing = false;
let pendingConfirmation = null;

async function sendMessage() {
  const input = document.getElementById('message-input');
  let text = input.value.trim();
  
  if (!text || isProcessing) return;
  
  // Security: Sanitize input
  if (typeof Security !== 'undefined') {
    text = Security.sanitize(text);
    if (Security.detectSuspiciousInput(text)) {
      addBotMessage("I couldn't process that input. Please try again.");
      input.value = '';
      return;
    }
  }
  
  input.value = '';
  isProcessing = true;
  addUserMessage(text);
  showLoading();
  
  await new Promise(r => setTimeout(r, 300));
  
  // Handle pending confirmation
  if (pendingConfirmation) {
    await handleConfirmation(text);
    hideLoading();
    isProcessing = false;
    return;
  }
  
  // Detect intent
  const intent = detectIntent(text);
  
  if (intent === 'query') {
    await handleQuery(text);
  } else {
    await handleAddContact(text);
  }
  
  hideLoading();
  isProcessing = false;
}

function detectIntent(text) {
  const queryPatterns = [
    /^(who|what|find|search|show|list|get|look\s?up)/i,
    /^(do i know|did i meet)/i,
    /\?$/,
    /^(how many|count)/i,
  ];
  
  for (const pattern of queryPatterns) {
    if (pattern.test(text.trim())) {
      return 'query';
    }
  }
  
  return 'add';
}

async function handleQuery(text) {
  const textLower = text.toLowerCase();
  
  // Count query
  if (/how many|count/i.test(textLower)) {
    Analytics.track('query_count');
    addBotMessage(`You have ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}.`);
    return;
  }
  
  // Search for contacts
  let searchTerm = text
    .replace(/^(who|what|find|search|show|list|get|look\s?up|do i know|did i meet)\s*/i, '')
    .replace(/[?]/g, '')
    .trim();
  
  // Handle "who knows X" or "who does X"
  const skillMatch = textLower.match(/who\s+(knows|does|is|works|can)\s+(.+)/i);
  if (skillMatch) {
    searchTerm = skillMatch[2].replace(/[?]/g, '').trim();
  }
  
  const results = searchContacts(searchTerm);
  
  Analytics.track('query_search', { term: searchTerm, results: results.length });
  
  if (results.length === 0) {
    addBotMessage(`No contacts found matching "${searchTerm}".`);
  } else if (results.length === 1) {
    const c = results[0];
    let msg = `Found **${c.name}**`;
    if (c.skills?.length) msg += ` — ${c.skills.join(', ')}`;
    if (c.phone) msg += ` 📱 ${c.phone}`;
    if (c.email) msg += ` ✉️ ${c.email}`;
    addBotMessage(msg);
  } else {
    const list = results.slice(0, 5).map(c => {
      let item = `• **${c.name}**`;
      if (c.skills?.length) item += ` (${c.skills.slice(0, 2).join(', ')})`;
      return item;
    }).join('\n');
    
    const more = results.length > 5 ? `\n...and ${results.length - 5} more` : '';
    addBotMessage(`Found ${results.length} contacts:\n${list}${more}`);
  }
}

async function handleAddContact(text) {
  // First, check if text mentions an existing contact
  const existingMatch = findExistingContactInText(text);
  
  if (existingMatch) {
    const { contact, remaining } = existingMatch;
    const updates = parseUpdateInfo(remaining);
    
    if (Object.keys(updates).length > 0) {
      // Apply updates to existing contact
      if (updates.skills?.length) {
        contact.skills = [...new Set([...(contact.skills || []), ...updates.skills])];
      }
      if (updates.phone) contact.phone = updates.phone;
      if (updates.email) contact.email = updates.email;
      if (updates.debt) {
        contact.debts = contact.debts || [];
        contact.debts.push(updates.debt);
      }
      if (updates.note) {
        contact.notes = contact.notes || [];
        contact.notes.push({ text: updates.note, createdAt: new Date().toISOString() });
      }
      
      contact.updatedAt = new Date().toISOString();
      
      await saveContact(contact);
      renderContacts();
      
      Analytics.track('contact_updated', { method: 'chat' });
      addBotMessage(`Updated **${contact.name}**! ${formatUpdates(updates)}`);
      return;
    } else {
      // Found contact but couldn't parse update - offer to edit
      addBotMessage(`I found **${contact.name}** but couldn't understand what to update.`);
      offerEditContact(contact);
      return;
    }
  }
  
  // No existing contact - try to parse as new contact
  const result = await parseContactHybrid(text);
  
  if (result.existingMatch) {
    await handleAddContact(text);
    return;
  }
  
  if (!result.contacts || result.contacts.length === 0) {
    // Couldn't parse - offer Quick Add form with prefilled text
    addBotMessage("I couldn't fully understand that. Would you like to add this manually?");
    offerQuickAdd(text);
    return;
  }
  
  for (const newContact of result.contacts) {
    // Check for similar existing contacts
    const similar = findSimilarContacts(newContact.name);
    
    if (similar.length > 0 && similar[0].similarity >= 0.8) {
      pendingConfirmation = {
        type: 'merge_or_new',
        newContact,
        existingContact: similar[0].contact,
        reason: similar[0].reason
      };
      
      const existing = similar[0].contact;
      addBotMessage(`I found a similar contact: **${existing.name}**. Is this the same person?\n\nReply "yes" to update them, or "no" to create a new contact.`);
      return;
    }
    
    // No similar contact - add new
    const stats = await syncContacts([newContact]);
    
    Analytics.track('contact_added', { method: 'chat', skills: newContact.skills?.length || 0 });
    
    let msg = `Added **${newContact.name}**!`;
    if (newContact.skills?.length) msg += ` Skills: ${newContact.skills.join(', ')}`;
    if (newContact.phone) msg += ` 📱 ${newContact.phone}`;
    if (newContact.email) msg += ` ✉️ ${newContact.email}`;
    
    addBotMessage(msg);
  }
}

async function handleConfirmation(response) {
  const confirm = pendingConfirmation;
  pendingConfirmation = null;
  
  const responseLower = response.toLowerCase().trim();
  
  if (confirm.type === 'merge_or_new') {
    if (responseLower === 'yes' || responseLower === 'y' || responseLower.includes('same')) {
      // Merge with existing contact
      const existing = confirm.existingContact;
      const newInfo = confirm.newContact;
      
      if (newInfo.skills?.length) {
        existing.skills = [...new Set([...(existing.skills || []), ...newInfo.skills])];
      }
      if (newInfo.phone) existing.phone = newInfo.phone;
      if (newInfo.email) existing.email = newInfo.email;
      if (newInfo.debts?.length) {
        existing.debts = [...(existing.debts || []), ...newInfo.debts];
      }
      
      existing.updatedAt = new Date().toISOString();
      
      await saveContact(existing);
      renderContacts();
      
      Analytics.track('contact_merged');
      addBotMessage(`Updated **${existing.name}** with the new info!`);
    } else if (responseLower === 'no' || responseLower === 'n' || responseLower.includes('new') || responseLower.includes('different')) {
      // Create as new contact
      await syncContacts([confirm.newContact]);
      
      Analytics.track('contact_added', { method: 'chat_confirmed' });
      addBotMessage(`Created new contact: **${confirm.newContact.name}**!`);
    } else {
      // Didn't understand
      pendingConfirmation = confirm;
      addBotMessage("Please reply 'yes' to update the existing contact, or 'no' to create a new one.");
    }
  }
}

function offerQuickAdd(prefillText) {
  const messages = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message bot';
  div.innerHTML = `
    <div class="message-bubble">
      <div class="chat-action-buttons">
        <button class="btn btn-primary btn-sm" onclick="openQuickAddWithText('${escapeHtml(prefillText.replace(/'/g, "\\'"))}')">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
          Add Contact
        </button>
        <button class="btn btn-secondary btn-sm" onclick="this.closest('.message').remove()">
          Dismiss
        </button>
      </div>
    </div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function offerEditContact(contact) {
  const contactId = contact._id || contact.id;
  const messages = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message bot';
  div.innerHTML = `
    <div class="message-bubble">
      <div class="chat-action-buttons">
        <button class="btn btn-primary btn-sm" onclick="editContact('${contactId}'); this.closest('.message').remove();">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit ${escapeHtml(contact.name)}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="openNotesModal('${contactId}'); this.closest('.message').remove();">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          Add Note
        </button>
        <button class="btn btn-secondary btn-sm" onclick="this.closest('.message').remove()">
          Dismiss
        </button>
      </div>
    </div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function addUserMessage(text) {
  const messages = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message user';
  div.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function addBotMessage(text) {
  const messages = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message bot';
  
  // Simple markdown-like formatting
  const formatted = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  
  div.innerHTML = `<div class="message-bubble">${formatted}</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function showLoading() {
  const messages = document.getElementById('messages');
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.id = 'loading-indicator';
  loading.innerHTML = '<div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div>';
  messages.appendChild(loading);
  messages.scrollTop = messages.scrollHeight;
}

function hideLoading() {
  const loading = document.getElementById('loading-indicator');
  if (loading) loading.remove();
}