// parser.js - Contact Parsing

function parseContactInfo(text) {
  const result = { contacts: [] };
  const sentences = text.split(/[.!?\n,]+/).filter(s => s.trim());
  let currentPerson = null;
  let lastMentionedName = null;
  
  sentences.forEach(sentence => {
    sentence = sentence.trim();
    const lowerSentence = sentence.toLowerCase();
    
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
    
    if (!name) {
      const commonWords = ['i', 'me', 'my', 'the', 'a', 'an', 'is', 'was', 'were', 'are', 'he', 'she', 'it', 'this', 'that', 'yesterday', 'today', 'tomorrow', 'last', 'next', 'week', 'month', 'year', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const words = sentence.split(' ');
      for (const word of words) {
        const cleanWord = word.replace(/[^a-zA-Z]/g, '');
        if (cleanWord.length > 2 && cleanWord[0] === cleanWord[0].toUpperCase() && cleanWord === cleanWord[0] + cleanWord.slice(1).toLowerCase() && !commonWords.includes(cleanWord.toLowerCase()) && !/\d/.test(word)) {
          name = cleanWord.toLowerCase();
          break;
        }
      }
    }

    if (!name && lastMentionedName && /^(he|she|they|him|her|them)\s+/i.test(sentence)) {
      name = lastMentionedName;
    }

    if (name) {
      lastMentionedName = name;
      currentPerson = result.contacts.find(c => c.name === name);
      
      if (!currentPerson) {
        const phoneMatch = sentence.match(/(\d{3}[-.]?\d{3}[-.]?\d{4}|\d{10})/);
        const emailMatch = sentence.match(/([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
        const hasContactInfo = phoneMatch || emailMatch;
        const hasSkills = lowerSentence.match(/does\s+\w+|is\s+a\s+\w+|works\s+|specializes\s+in/);
        const hasContext = sentence.length > 20;
        
        if (!hasContactInfo && !hasSkills && !hasContext) return;
        
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
      const phoneMatch = sentence.match(/(\d{3}[-.]?\d{3}[-.]?\d{4}|\d{10})/);
      if (phoneMatch) currentPerson.phone = phoneMatch[1];
      
      const emailMatch = sentence.match(/([a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
      if (emailMatch) currentPerson.email = emailMatch[1];
      
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
          skillText = skillText.split(/\s+(his|her|their|the|number|phone|email)/i)[0].trim();
          skillText = skillText.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
          
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
    }
  });
  
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
    if (response.ok) return await response.json();
  } catch (error) {
    console.log('AI parsing unavailable');
  }
  return null;
}

async function parseContactHybrid(text) {
  if (navigator.onLine) {
    try {
      const aiResult = await parseWithAI(text);
      if (aiResult && aiResult.contacts && aiResult.contacts.length > 0) {
        return aiResult;
      }
    } catch (err) {
      console.error('AI error:', err);
    }
  }
  return parseContactInfo(text);
}