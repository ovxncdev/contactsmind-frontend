// modals.js - Modal Management

let editingContactId = null;
let importedContacts = [];

// ============== QUICK ADD ==============

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
}

function openQuickAddWithText(prefillText) {
  openQuickAdd();
  
  // Try to extract a name from the text
  const words = prefillText.split(/\s+/);
  let possibleName = '';
  
  // Take first 1-3 words as possible name
  for (let i = 0; i < Math.min(3, words.length); i++) {
    const word = words[i].replace(/[^a-zA-Z\s]/g, '').trim();
    if (word && !['met', 'saw', 'called', 'add', 'new', 'contact', 'the', 'a', 'an'].includes(word.toLowerCase())) {
      possibleName += (possibleName ? ' ' : '') + word;
    }
  }
  
  // Prefill the name field
  const nameInput = document.getElementById('qa-name');
  if (nameInput && possibleName) {
    nameInput.value = possibleName.toLowerCase();
  }
  
  // Try to extract phone
  const phoneMatch = prefillText.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{10,11})/);
  if (phoneMatch) {
    const phoneInput = document.getElementById('qa-phone');
    if (phoneInput) phoneInput.value = phoneMatch[1];
  }
  
  // Try to extract email
  const emailMatch = prefillText.match(/([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
  if (emailMatch) {
    const emailInput = document.getElementById('qa-email');
    if (emailInput) emailInput.value = emailMatch[1];
  }
  
  // Try to extract skills
  const skillPatterns = [
    /does\s+(.+?)(?:\.|,|$)/i,
    /is\s+(?:a|an)\s+(.+?)(?:\.|,|$)/i,
    /works\s+(?:in|with|on|as|at)\s+(.+?)(?:\.|,|$)/i,
  ];
  
  for (const pattern of skillPatterns) {
    const match = prefillText.match(pattern);
    if (match) {
      const skillInput = document.getElementById('qa-skills');
      if (skillInput) skillInput.value = match[1].trim();
      break;
    }
  }
}

async function submitQuickAdd() {
  let name = document.getElementById('qa-name').value.trim().toLowerCase();
  let phone = document.getElementById('qa-phone').value.trim() || null;
  let email = document.getElementById('qa-email').value.trim() || null;
  let skillsInput = document.getElementById('qa-skills').value.trim();
  
  // Security: Sanitize inputs
  if (typeof Security !== 'undefined') {
    name = Security.sanitize(name);
    if (phone) phone = Security.sanitize(phone);
    if (email) email = Security.sanitize(email);
    if (skillsInput) skillsInput = Security.sanitize(skillsInput);
  }
  
  if (!name) {
    alert('Name is required!');
    return;
  }
  
  // Validate email if provided
  if (email && typeof Security !== 'undefined' && !Security.isValidEmail(email)) {
    alert('Please enter a valid email address');
    return;
  }
  
  // Validate phone if provided
  if (phone && typeof Security !== 'undefined' && !Security.isValidPhone(phone)) {
    alert('Please enter a valid phone number');
    return;
  }
  
  const skills = skillsInput ? skillsInput.split(',').map(s => s.trim()).filter(s => s) : [];
  
  const newContact = {
    id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    phone,
    email,
    skills,
    notes: [],
    debts: [],
    reminders: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  await syncContacts([newContact]);
  Analytics.track('contact_added', { method: 'quick_add' });
  
  closeQuickAdd();
  addBotMessage(`Added **${name}**!`);
}

// ============== EDIT CONTACT ==============

function editContact(contactId) {
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  editingContactId = contactId;
  Analytics.track('edit_contact_opened');
  
  document.getElementById('edit-name').value = contact.name || '';
  document.getElementById('edit-phone').value = contact.phone || '';
  document.getElementById('edit-email').value = contact.email || '';
  document.getElementById('edit-skills').value = (contact.skills || []).join(', ');
  
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  editingContactId = null;
}

async function submitEdit() {
  if (!editingContactId) return;
  
  const contact = contacts.find(c => (c._id || c.id) === editingContactId);
  if (!contact) return;
  
  let name = document.getElementById('edit-name').value.trim().toLowerCase();
  let phone = document.getElementById('edit-phone').value.trim() || null;
  let email = document.getElementById('edit-email').value.trim() || null;
  let skillsInput = document.getElementById('edit-skills').value.trim();
  
  // Security: Sanitize inputs
  if (typeof Security !== 'undefined') {
    name = Security.sanitize(name);
    if (phone) phone = Security.sanitize(phone);
    if (email) email = Security.sanitize(email);
    if (skillsInput) skillsInput = Security.sanitize(skillsInput);
  }
  
  if (!name) {
    alert('Name is required!');
    return;
  }
  
  contact.name = name;
  contact.phone = phone;
  contact.email = email;
  contact.skills = skillsInput ? skillsInput.split(',').map(s => s.trim()).filter(s => s) : [];
  contact.updatedAt = new Date().toISOString();
  
  await saveContact(contact);
  renderContacts();
  
  Analytics.track('contact_edited');
  closeEditModal();
  addBotMessage(`Updated **${name}**!`);
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
  const ratingBtn = document.querySelector('.rating-btn.selected');
  const rating = ratingBtn ? ratingBtn.dataset.rating : null;
  
  if (!text && !rating) {
    alert('Please provide feedback or select a rating');
    return;
  }
  
  Analytics.track('feedback_submitted', { rating, hasText: !!text });
  
  // Send to backend if online
  if (navigator.onLine) {
    try {
      await fetch(`${CONFIG.API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ text, rating })
      });
    } catch (e) {
      console.error('Feedback send error:', e);
    }
  }
  
  closeFeedback();
  addBotMessage('Thanks for your feedback! 🙏');
}

// ============== EXPORT/IMPORT ==============

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

// ============== LOGOUT ==============

function handleLogout() {
  Analytics.track('logout');
  Analytics.reset();
  
  if (typeof Security !== 'undefined') {
    Security.clearSensitiveData();
  } else {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
  }
  
  window.location.href = CONFIG.AUTH_PAGE;
}