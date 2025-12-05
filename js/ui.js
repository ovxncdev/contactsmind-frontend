// ui.js - UI Rendering & View Management

let currentView = 'chat';

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