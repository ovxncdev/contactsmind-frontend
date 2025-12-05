// reminders.js - Reminders Management

function openRemindersModal(contactId) {
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  Analytics.track('reminders_opened', { contact: contact.name });
  
  document.getElementById('reminders-contact-id').value = contactId;
  document.getElementById('reminders-contact-name').textContent = contact.name;
  
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
      weekday: 'short', month: 'short', day: 'numeric' 
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
    title, date, time, notes,
    createdAt: new Date().toISOString()
  });
  contact.updatedAt = new Date().toISOString();
  
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