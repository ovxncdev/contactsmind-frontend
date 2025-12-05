// notes.js - Notes Management

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