// contacts.js - Contact Management

let contacts = [];

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

async function saveContact(contact) {
  const contactId = contact._id || contact.id;
  
  if (!navigator.onLine) {
    const index = contacts.findIndex(c => (c._id || c.id) === contactId);
    if (index !== -1) contacts[index] = contact;
    OfflineCache.saveContacts(contacts);
    OfflineQueue.addToQueue({ type: 'update_contact', contactId, contact });
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
    OfflineQueue.addToQueue({ type: 'update_contact', contactId, contact });
  }
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
// Add to js/contacts.js

function exportContactsCSV() {
  if (contacts.length === 0) {
    addBotMessage("No contacts to export!");
    return;
  }
  
  const headers = ['Name', 'Phone', 'Email', 'Skills', 'Notes', 'Created'];
  const rows = contacts.map(c => [
    c.name || '',
    c.phone || '',
    c.email || '',
    (c.skills || []).join('; '),
    (c.notes || []).map(n => typeof n === 'string' ? n : n.text).join('; '),
    c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  downloadFile(csvContent, 'contacts.csv', 'text/csv');
  Analytics.track('contacts_exported', { format: 'csv', count: contacts.length });
  addBotMessage(`Exported ${contacts.length} contacts as CSV!`);
}

function exportContactsVCard() {
  if (contacts.length === 0) {
    addBotMessage("No contacts to export!");
    return;
  }
  
  const vcards = contacts.map(c => {
    const nameParts = (c.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
    vcard += `N:${lastName};${firstName};;;\n`;
    vcard += `FN:${c.name || ''}\n`;
    if (c.phone) vcard += `TEL:${c.phone}\n`;
    if (c.email) vcard += `EMAIL:${c.email}\n`;
    if (c.skills?.length) vcard += `NOTE:Skills: ${c.skills.join(', ')}\n`;
    vcard += 'END:VCARD';
    return vcard;
  }).join('\n\n');
  
  downloadFile(vcards, 'contacts.vcf', 'text/vcard');
  Analytics.track('contacts_exported', { format: 'vcard', count: contacts.length });
  addBotMessage(`Exported ${contacts.length} contacts as vCard!`);
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// Contact Sharing

function shareContact(contactId) {
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  const shareText = formatContactForShare(contact);
  
  // Check if Web Share API is available (mobile)
  if (navigator.share) {
    navigator.share({
      title: `Contact: ${contact.name}`,
      text: shareText
    }).then(() => {
      Analytics.track('contact_shared', { method: 'native' });
    }).catch(err => {
      if (err.name !== 'AbortError') {
        copyContactToClipboard(contact, shareText);
      }
    });
  } else {
    copyContactToClipboard(contact, shareText);
  }
}

function formatContactForShare(contact) {
  let text = `📇 ${contact.name.toUpperCase()}\n`;
  if (contact.phone) text += `📱 ${contact.phone}\n`;
  if (contact.email) text += `📧 ${contact.email}\n`;
  if (contact.skills?.length) text += `💼 ${contact.skills.join(', ')}\n`;
  text += `\nShared from ContactsMind`;
  return text;
}

function copyContactToClipboard(contact, text) {
  navigator.clipboard.writeText(text).then(() => {
    Analytics.track('contact_shared', { method: 'clipboard' });
    addBotMessage(`${contact.name}'s info copied to clipboard!`);
  }).catch(() => {
    addBotMessage('Failed to copy. Please try again.');
  });
}

function generateContactLink(contactId) {
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  // Create a shareable vCard data URL
  const vcard = createVCardString(contact);
  const blob = new Blob([vcard], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  
  // Create temporary link and trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = `${contact.name.replace(/\s+/g, '_')}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
  
  Analytics.track('contact_shared', { method: 'vcard_download' });
  addBotMessage(`Downloaded ${contact.name}'s contact card!`);
}

function createVCardString(contact) {
  const nameParts = (contact.name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
  vcard += `N:${lastName};${firstName};;;\n`;
  vcard += `FN:${contact.name || ''}\n`;
  if (contact.phone) vcard += `TEL:${contact.phone}\n`;
  if (contact.email) vcard += `EMAIL:${contact.email}\n`;
  if (contact.skills?.length) vcard += `NOTE:Skills: ${contact.skills.join(', ')}\n`;
  vcard += 'END:VCARD';
  return vcard;
}

// Contact Sharing

function shareContact(contactId) {
  const contact = contacts.find(c => (c._id || c.id) === contactId);
  if (!contact) return;
  
  const shareText = formatContactForShare(contact);
  
  if (navigator.share) {
    navigator.share({
      title: `Contact: ${contact.name}`,
      text: shareText
    }).then(() => {
      Analytics.track('contact_shared', { method: 'native' });
    }).catch(err => {
      if (err.name !== 'AbortError') {
        copyContactToClipboard(contact, shareText);
      }
    });
  } else {
    copyContactToClipboard(contact, shareText);
  }
}

function formatContactForShare(contact) {
  let text = `📇 ${contact.name.toUpperCase()}\n`;
  if (contact.phone) text += `📱 ${contact.phone}\n`;
  if (contact.email) text += `📧 ${contact.email}\n`;
  if (contact.skills?.length) text += `💼 ${contact.skills.join(', ')}\n`;
  text += `\nShared from ContactsMind`;
  return text;
}

function copyContactToClipboard(contact, text) {
  navigator.clipboard.writeText(text).then(() => {
    Analytics.track('contact_shared', { method: 'clipboard' });
    addBotMessage(`${contact.name}'s info copied to clipboard!`);
  }).catch(() => {
    addBotMessage('Failed to copy. Please try again.');
  });
}

function updateContactCount() {
  document.getElementById('contact-count').textContent = contacts.length;
}