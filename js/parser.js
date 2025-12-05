// parser.js - Contact Parsing Logic

// Check if input starts with or contains an existing contact name
function findExistingContactInText(text) {
  const textLower = text.toLowerCase().trim();
  
  // Sort contacts by name length (longest first) to match "business only" before "business"
  const sortedContacts = [...contacts].sort((a, b) => 
    (b.name?.length || 0) - (a.name?.length || 0)
  );
  
  for (const contact of sortedContacts) {
    const nameLower = contact.name?.toLowerCase();
    if (!nameLower) continue;
    
    // Check if text starts with contact name
    if (textLower.startsWith(nameLower + ' ')) {
      const remaining = text.slice(contact.name.length).trim();
      return { contact, remaining };
    }
    
    // Check if text starts with contact name (no space, for possessives)
    if (textLower.startsWith(nameLower + "'s ") || textLower.startsWith(nameLower + "'s ")) {
      const remaining = text.slice(contact.name.length).trim();
      return { contact, remaining };
    }
    
    // Check for "name does..." or "name is..." patterns
    const patterns = [
      new RegExp(`^${escapeRegex(nameLower)}\\s+(does|is|has|works|owes|wants|likes|needs|said|told|gave|sent|called|texted|emailed)\\s+`, 'i'),
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(textLower)) {
        const remaining = text.slice(contact.name.length).trim();
        return { contact, remaining };
      }
    }
  }
  
  return null;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseUpdateInfo(text) {
  const updates = {};
  const textLower = text.toLowerCase();
  
  // Extract skills
  const skillPatterns = [
    /does\s+(.+?)(?:\.|,|$)/i,
    /is\s+(?:a|an)\s+(.+?)(?:\.|,|$)/i,
    /works\s+(?:in|with|on|as)\s+(.+?)(?:\.|,|$)/i,
    /works\s+at\s+(.+?)(?:\.|,|$)/i,
    /specializes\s+in\s+(.+?)(?:\.|,|$)/i,
  ];
  
  for (const pattern of skillPatterns) {
    const match = text.match(pattern);
    if (match) {
      const skill = match[1].trim().split(/\s+(and|,)\s+/)[0].trim();
      if (skill.length > 2 && skill.length < 50) {
        updates.skills = [skill];
      }
      break;
    }
  }
  
  // Extract phone
  const phoneMatch = text.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{10,11}|\+\d{10,14})/);
  if (phoneMatch) updates.phone = phoneMatch[1];
  
  // Extract email
  const emailMatch = text.match(/([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
  if (emailMatch) updates.email = emailMatch[1];
  
  // Extract debt info
  const debtPatterns = [
    { pattern: /owes\s+me\s+\$?(\d+(?:\.\d{2})?)/i, direction: 'they_owe_me' },
    { pattern: /i\s+owe\s+(?:them|him|her)?\s*\$?(\d+(?:\.\d{2})?)/i, direction: 'i_owe_them' },
    { pattern: /lent\s+(?:them|him|her)?\s*\$?(\d+(?:\.\d{2})?)/i, direction: 'they_owe_me' },
    { pattern: /borrowed\s+\$?(\d+(?:\.\d{2})?)/i, direction: 'i_owe_them' },
  ];
  
  for (const { pattern, direction } of debtPatterns) {
    const match = text.match(pattern);
    if (match) {
      updates.debt = { amount: parseFloat(match[1]), direction, note: text, date: new Date().toISOString() };
      break;
    }
  }
  
  // If nothing specific found, treat as a note
  if (!updates.skills && !updates.phone && !updates.email && !updates.debt && text.length > 3) {
    // Clean up common prefixes
    let noteText = text
      .replace(/^(does|is|has|works|said|told)\s+/i, '')
      .replace(/^'s\s+/i, '')
      .trim();
    
    if (noteText.length > 3) {
      updates.note = noteText;
    }
  }
  
  return updates;
}

function formatUpdates(updates) {
  const parts = [];
  if (updates.skills?.length) parts.push(`Added skill: ${updates.skills.join(', ')}`);
  if (updates.phone) parts.push(`Phone: ${updates.phone}`);
  if (updates.email) parts.push(`Email: ${updates.email}`);
  if (updates.debt) {
    const dir = updates.debt.direction === 'they_owe_me' ? 'They owe you' : 'You owe them';
    parts.push(`${dir}: $${updates.debt.amount}`);
  }
  if (updates.note) parts.push(`Note added`);
  return parts.join(' • ') || 'Updated!';
}

function parseContactInfo(text) {
  const result = { contacts: [] };
  const sentences = text.split(/[.!?\n]+/).filter(s => s.trim());
  let currentPerson = null;
  let lastMentionedName = null;
  
  sentences.forEach(sentence => {
    sentence = sentence.trim();
    const lowerSentence = sentence.toLowerCase();
    
    // Try to find a name
    const namePatterns = [
      /(?:met|spoke with|talked to|connected with|saw|know|contact|called)\s+([a-z][a-z\s]{1,30}?)(?:\s+(?:at|from|who|does|is|works|today|yesterday|,|\.|$))/i,
      /^([a-z][a-z\s]{1,30}?)(?:'s|'s)\s+(?:number|email|phone)/i,
      /(?:name is|named|called)\s+([a-z][a-z\s]{1,30}?)(?:\s|,|\.|$)/i,
    ];
    
    let name = null;
    for (const pattern of namePatterns) {
      const match = sentence.match(pattern);
      if (match) {
        name = match[1].trim().toLowerCase();
        break;
      }
    }
    
    // Fallback: look for capitalized words (but not common words)
    if (!name) {
      const commonWords = ['i', 'me', 'my', 'the', 'a', 'an', 'is', 'was', 'were', 'are', 'he', 'she', 'it', 'this', 'that', 'yesterday', 'today', 'tomorrow', 'met', 'saw', 'called', 'just', 'also', 'very', 'really'];
      const words = sentence.split(/\s+/);
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const clean = word.replace(/[^a-zA-Z]/g, '');
        
        if (clean.length > 1 && 
            clean[0] === clean[0].toUpperCase() && 
            !commonWords.includes(clean.toLowerCase()) &&
            !/\d/.test(word)) {
          // Check if next word is also capitalized (full name)
          if (i + 1 < words.length) {
            const nextWord = words[i + 1].replace(/[^a-zA-Z]/g, '');
            if (nextWord.length > 1 && nextWord[0] === nextWord[0].toUpperCase() && !commonWords.includes(nextWord.toLowerCase())) {
              name = (clean + ' ' + nextWord).toLowerCase();
              break;
            }
          }
          name = clean.toLowerCase();
          break;
        }
      }
    }
    
    // Use pronoun reference
    if (!name && lastMentionedName && /^(he|she|they|him|her|them)\s+/i.test(sentence)) {
      name = lastMentionedName;
    }
    
    if (name) {
      lastMentionedName = name;
      currentPerson = result.contacts.find(c => c.name === name);
      
      if (!currentPerson) {
        currentPerson = {
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name,
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
      // Extract phone
      const phoneMatch = sentence.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{10,11}|\+\d{10,14})/);
      if (phoneMatch) currentPerson.phone = phoneMatch[1];
      
      // Extract email
      const emailMatch = sentence.match(/([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
      if (emailMatch) currentPerson.email = emailMatch[1];
      
      // Extract skills
      const skillPatterns = [
        /(?:he|she|they)?\s*does\s+([\w\s]+?)(?:\s*,|\s+his|\s+her|$)/i,
        /is\s+(?:a|an)\s+([\w\s]+?)(?:\s*,|\s+and|$)/i,
        /works?\s+(?:in|with|on|as|at)\s+([\w\s]+?)(?:\s*,|$)/i,
        /specializes\s+in\s+([\w\s]+?)(?:\s*,|$)/i,
      ];
      
      for (const pattern of skillPatterns) {
        const match = lowerSentence.match(pattern);
        if (match) {
          let skillText = match[1].trim().split(/\s+(his|her|their|the|number|phone|email)/i)[0].trim();
          if (skillText.length > 2 && skillText.length < 50) {
            skillText.split(/\s+and\s+|\s*,\s+/).forEach(skill => {
              skill = skill.trim();
              if (skill && skill.length > 2 && !currentPerson.skills.includes(skill)) {
                currentPerson.skills.push(skill);
              }
            });
          }
        }
      }
      
      // Extract debts
      const debtPatterns = [
        { pattern: /(?:i\s+)?owe(?:s|d)?\s+(?:him|her|them)?\s*\$?(\d+(?:\.\d{2})?)/i, direction: 'i_owe_them' },
        { pattern: /(?:he|she|they)\s+owe(?:s)?\s+me\s*\$?(\d+(?:\.\d{2})?)/i, direction: 'they_owe_me' },
        { pattern: /owes\s+me\s*\$?(\d+(?:\.\d{2})?)/i, direction: 'they_owe_me' },
        { pattern: /lent\s+(?:him|her|them)?\s*\$?(\d+(?:\.\d{2})?)/i, direction: 'they_owe_me' },
      ];
      
      for (const { pattern, direction } of debtPatterns) {
        const match = lowerSentence.match(pattern);
        if (match) {
          currentPerson.debts.push({
            amount: parseFloat(match[1]),
            direction,
            note: sentence,
            date: new Date().toISOString()
          });
          break;
        }
      }
    }
  });
  
  // Filter out contacts with no useful info
  result.contacts = result.contacts.filter(c => 
    c.phone || c.email || c.skills.length > 0 || c.debts.length > 0
  );
  
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
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('AI parse error:', error);
  }
  
  return null;
}

async function parseContactHybrid(text) {
  // First check if it matches an existing contact
  const existingMatch = findExistingContactInText(text);
  if (existingMatch) {
    return { existingMatch };
  }
  
  // Try AI parsing if online
  if (navigator.onLine) {
    try {
      const aiResult = await parseWithAI(text);
      if (aiResult?.contacts?.length > 0) {
        return aiResult;
      }
    } catch (error) {
      console.error('AI parsing failed:', error);
    }
  }
  
  // Fallback to local parsing
  return parseContactInfo(text);
}