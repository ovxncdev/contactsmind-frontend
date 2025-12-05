// modals.js - Modal Management

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

// Export/Import Modals
let importedContacts = [];

function openExportModal() {
  Analytics.track('export_modal_opened');
  document.getElementById('export-modal').classList.remove('hidden');
}

function closeExportModal() {
  document.getElementById('export-modal').classList.add('hidden');
}

function openImportModal() {
  Analytics.track('import_modal_opened');
  importedContacts = [];
  document.getElementById('import-file').value = '';
  document.getElementById('import-preview').classList.add('hidden');
  document.getElementById('import-confirm-btn').classList.add('hidden');
  document.getElementById('import-modal').classList.remove('hidden');
}

function closeImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    
    if (file.name.endsWith('.csv')) {
      importedContacts = parseCSV(content);
    } else if (file.name.endsWith('.vcf') || file.name.endsWith('.vcard')) {
      importedContacts = parseVCard(content);
    }
    
    if (importedContacts.length > 0) {
      document.getElementById('import-preview').innerHTML = `
        <span class="import-preview-count">${importedContacts.length} contacts</span> found in file
      `;
      document.getElementById('import-preview').classList.remove('hidden');
      document.getElementById('import-confirm-btn').classList.remove('hidden');
    } else {
      document.getElementById('import-preview').innerHTML = 'No valid contacts found in file';
      document.getElementById('import-preview').classList.remove('hidden');
    }
  };
  reader.readAsText(file);
}

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const contacts = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
    const cleaned = values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    
    const nameIdx = headers.findIndex(h => h.includes('name'));
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('tel'));
    const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));
    const skillsIdx = headers.findIndex(h => h.includes('skill'));
    
    const name = cleaned[nameIdx] || cleaned[0];
    if (!name || name.toLowerCase() === 'name') continue;
    
    contacts.push({
      id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.toLowerCase(),
      phone: cleaned[phoneIdx] || null,
      email: cleaned[emailIdx] || null,
      skills: cleaned[skillsIdx] ? cleaned[skillsIdx].split(';').map(s => s.trim()).filter(s => s) : [],
      notes: [],
      debts: [],
      reminders: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  return contacts;
}

function parseVCard(content) {
  const vcards = content.split('BEGIN:VCARD').filter(v => v.trim());
  const contacts = [];
  
  vcards.forEach(vcard => {
    const lines = vcard.split('\n');
    let name = '', phone = '', email = '', skills = [];
    
    lines.forEach(line => {
      if (line.startsWith('FN:')) {
        name = line.substring(3).trim();
      } else if (line.startsWith('TEL')) {
        phone = line.split(':').pop().trim();
      } else if (line.startsWith('EMAIL')) {
        email = line.split(':').pop().trim();
      } else if (line.startsWith('NOTE:')) {
        const note = line.substring(5).trim();
        if (note.toLowerCase().startsWith('skills:')) {
          skills = note.substring(7).split(',').map(s => s.trim()).filter(s => s);
        }
      }
    });
    
    if (name) {
      contacts.push({
        id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: name.toLowerCase(),
        phone: phone || null,
        email: email || null,
        skills,
        notes: [],
        debts: [],
        reminders: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  });
  
  return contacts;
}

async function confirmImport() {
  if (importedContacts.length === 0) return;
  
  const result = await syncContacts(importedContacts);
  Analytics.track('contacts_imported', { count: importedContacts.length });
  
  closeImportModal();
  addBotMessage(`Imported ${importedContacts.length} contacts!`);
  importedContacts = [];
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    Analytics.track('user_logout');
    Analytics.reset();
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
    window.location.replace(CONFIG.AUTH_PAGE);
  }
}