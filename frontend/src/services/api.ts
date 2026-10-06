import type { CategoryType, ExtractedTask, PriorityType, Task, TaskCreateInput, TaskUpdateInput } from '../types/task';

const API_BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '') + '/api';

const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
};

const getCustomKeyHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'X-User-Timezone': getUserTimezone(),
  };
  const groq = localStorage.getItem('groq_api_key');
  if (groq) headers['X-Groq-Key'] = groq;
  const gemini = localStorage.getItem('gemini_api_key');
  if (gemini) headers['X-Gemini-Key'] = gemini;
  const openai = localStorage.getItem('openai_api_key');
  if (openai) headers['X-OpenAI-Key'] = openai;
  return headers;
};

// Word to number map for Hindi/Hinglish/Punjabi/English heuristic parser
const WORD_TO_NUMBER: Record<string, number> = {
  ek: 1, ik: 1, one: 1, एक: 1, ਇੱਕ: 1, ਇਕ: 1,
  do: 2, two: 2, दो: 2, ਦੋ: 2,
  teen: 3, tin: 3, three: 3, तीन: 3, ਤਿੰਨ: 3,
  chaar: 4, char: 4, four: 4, चार: 4, ਚਾਰ: 4,
  paanch: 5, panch: 5, panj: 5, five: 5, पाँच: 5, पांच: 5, ਪੰਜ: 5,
  chhe: 6, che: 6, chey: 6, six: 6, छह: 6, 'छः': 6, ਛੇ: 6,
  saat: 7, sat: 7, seven: 7, सात: 7, ਸੱਤ: 7,
  aath: 8, ath: 8, aat: 8, eight: 8, आठ: 8, ਅੱਠ: 8,
  nau: 9, no: 9, naun: 9, nine: 9, नौ: 9, ਨੌਂ: 9,
  das: 10, duss: 10, ten: 10, दस: 10, ਦਸ: 10,
  gyarah: 11, gyara: 11, giarah: 11, eleven: 11, ग्यारह: 11, ਗਿਆਰਾਂ: 11,
  barah: 12, bara: 12, baarah: 12, twelve: 12, बारह: 12, ਬਾਰਾਂ: 12,
};

function polishTaskTitle(title: string): string {
  const cleaned = title.trim();
  // 1. Study patterns
  const mStudy1 = cleaned.match(/^(.*?)\s+(?:padhna|padhni|padhai|padh|study|read|learn|ਪੜ੍ਹਨਾ|ਪੜ੍ਹਾਈ|पढ़ना|पढना)(?:\s+hai)?$/i);
  if (mStudy1) {
    const subj = mStudy1[1].trim();
    const subjStr = subj.length <= 4 ? subj.toUpperCase() : subj.charAt(0).toUpperCase() + subj.slice(1);
    return `Study ${subjStr}`;
  }
  const mStudy2 = cleaned.match(/^(?:padhna|padhni|padhai|padh|study|read|learn|ਪੜ੍ਹਨਾ|ਪੜ੍ਹਾਈ|पढ़ना|पढना)\s+(.*?)(?:\s+hai)?$/i);
  if (mStudy2) {
    const subj = mStudy2[1].trim();
    const subjStr = subj.length <= 4 ? subj.toUpperCase() : subj.charAt(0).toUpperCase() + subj.slice(1);
    return `Study ${subjStr}`;
  }

  // 2. Wake up patterns
  const mWake = cleaned.match(/^(?:uthana|uthna|jagna|utho|wake\s*up|get\s*up|ਉੱਠਣਾ|ਉਠਣਾ|उठना|जागना)\s+(?:hai\s+)?(.+?)\s+(?:ke\s+liye|lai|waste|nu|ko)$/i);
  if (mWake) {
    const target = mWake[1].trim();
    return `Wake up for ${target.charAt(0).toUpperCase() + target.slice(1)}`;
  }
  if (/^(?:uthana|uthna|jagna|utho|wake\s*up|get\s*up|ਉੱਠਣਾ|ਉਠਣਾ|उठना|जागना)(?:\s+hai)?$/i.test(cleaned)) {
    return 'Wake up';
  }

  // 3. Call patterns
  const mCall1 = cleaned.match(/^(.*?)\s+(?:ko|nu)\s+(?:call|phone|milna)(?:\s+karna)?$/i);
  if (mCall1) {
    return `Call ${mCall1[1].trim().replace(/\b\w/g, (l) => l.toUpperCase())}`;
  }
  const mCall2 = cleaned.match(/^(?:call|phone)\s+(?:to\s+)?(.*?)(?:\s+ko|\s+nu)?$/i);
  if (mCall2) {
    return `Call ${mCall2[1].trim().replace(/\b\w/g, (l) => l.toUpperCase())}`;
  }

  // 4. Action patterns
  const mSubmit = cleaned.match(/^(.*?)\s+(?:ka|ki|ke|da|di|de)\s+(.*?)\s+(submit|complete|finish|karna|check|review|dena)$/i);
  if (mSubmit) {
    const verbMap: Record<string, string> = { submit: 'Submit', complete: 'Complete', finish: 'Finish', karna: 'Do', check: 'Check', review: 'Review', dena: 'Submit' };
    const v = verbMap[mSubmit[3].toLowerCase()] || mSubmit[3];
    return `${v} ${mSubmit[1]} ${mSubmit[2]}`.trim();
  }
  const mAction = cleaned.match(/^(.*?)\s+(submit|complete|finish|check|review|pay|bharna)$/i);
  if (mAction) {
    const verbMap: Record<string, string> = { submit: 'Submit', complete: 'Complete', finish: 'Finish', check: 'Check', review: 'Review', pay: 'Pay', bharna: 'Pay' };
    const v = verbMap[mAction[2].toLowerCase()] || mAction[2];
    return `${v} ${mAction[1]}`.trim();
  }

  // 5. Gym / exercise
  const mGym = cleaned.match(/^(gym|walk|workout)\s+(?:jana|jani|jaana|जाना|ਜਾਣਾ)$/i);
  if (mGym) {
    return mGym[1].charAt(0).toUpperCase() + mGym[1].slice(1);
  }

  return cleaned;
}

export function heuristicParseTask(transcript: string): ExtractedTask {
  const textLower = transcript.toLowerCase();
  const now = new Date();

  // 1. Date resolution
  let scheduledDate: string | null = null;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);

  if (['parson', 'day after tomorrow', 'ਪਰਸੋਂ', 'परसों'].some((k) => textLower.includes(k))) {
    scheduledDate = dayAfter.toISOString().split('T')[0];
  } else if (['kal', 'tomorrow', 'ਕੱਲ੍ਹ', 'कल'].some((k) => textLower.includes(k))) {
    scheduledDate = tomorrow.toISOString().split('T')[0];
  } else if (['aaj', 'today', 'ਅੱਜ', 'आज'].some((k) => textLower.includes(k))) {
    scheduledDate = now.toISOString().split('T')[0];
  } else {
    scheduledDate = tomorrow.toISOString().split('T')[0];
  }

  // 2. Time resolution
  let scheduledTime: string | null = null;
  const isPm = ['shaam', 'sham', 'raat', 'evening', 'night', 'pm', 'p.m.', 'शाम', 'रात', 'ਸ਼ਾਮ', 'ਰਾਤ'].some((k) => textLower.includes(k));
  const isAm = ['subah', 'subh', 'morning', 'am', 'a.m.', 'सुबह', 'सवेरे', 'ਸਵੇਰੇ', 'ਸਵੇਰ'].some((k) => textLower.includes(k));
  const isAfternoon = ['dopahar', 'afternoon', 'ਦੁਪਹਿਰ', 'दोपहर'].some((k) => textLower.includes(k));

  let parsedHour: number | null = null;
  let parsedMinutes = 0;

  let normalizedText = textLower;
  Object.entries(WORD_TO_NUMBER).forEach(([word, num]) => {
    const re = new RegExp(`\\b${word}\\s*(baje|बजे|ਵਜੇ|am|pm|o'clock)`, 'gi');
    normalizedText = normalizedText.replace(re, `${num} $1`);
  });

  const timeMatch = normalizedText.match(/(\d{1,2})(?::(\d{2}))?\s*(?:baje|बजे|ਵਜੇ|pm|am|o'clock)?/i);
  if (timeMatch) {
    parsedHour = parseInt(timeMatch[1], 10);
    if (timeMatch[2]) parsedMinutes = parseInt(timeMatch[2], 10);
  }

  if (parsedHour !== null && !isNaN(parsedHour)) {
    let h = parsedHour;
    if (h >= 1 && h <= 12) {
      if (isPm && h < 12) h += 12;
      else if (isAfternoon && h <= 6) h += 12;
      else if (isAm && h === 12) h = 0;
    }
    scheduledTime = `${String(h).padStart(2, '0')}:${String(parsedMinutes).padStart(2, '0')}`;
  } else {
    if (isPm) scheduledTime = '18:00';
    else if (isAm) scheduledTime = '09:00';
    else if (isAfternoon) scheduledTime = '14:00';
    else scheduledTime = '10:00';
  }

  // 3. Category detection
  let category: CategoryType = 'general';
  if (['dbms', 'database', 'assignment', 'study', 'exam', 'padhna', 'homework', 'class', 'college', 'school', 'test', 'course', 'ਪੜ੍ਹਨਾ', 'ਪੜ੍ਹਾਈ', 'पढ़ना'].some((w) => textLower.includes(w))) {
    category = 'study';
  } else if (['mom', 'dad', 'mother', 'father', 'friend', 'rahul', 'party', 'dinner', 'lunch', 'birthday', 'family', 'मम्मी', 'पापा', 'दोस्त'].some((w) => textLower.includes(w))) {
    category = 'personal';
  } else if (['gym', 'workout', 'exercise', 'walk', 'badminton', 'running', 'medicine', 'doctor', 'dentist', 'health', 'दवा', 'डॉक्टर'].some((w) => textLower.includes(w))) {
    category = 'health';
  } else if (['meeting', 'project', 'office', 'client', 'boss', 'work', 'presentation', 'email', 'report', 'standup'].some((w) => textLower.includes(w))) {
    category = 'work';
  } else if (['bill', 'recharge', 'fee', 'pay', 'bank', 'money', 'rent', 'salary', 'पैसे', 'बिल'].some((w) => textLower.includes(w))) {
    category = 'finance';
  } else if (['uthna', 'uthana', 'jagna', 'wake up', 'get up'].some((w) => textLower.includes(w))) {
    category = 'personal';
  }

  // 4. Priority detection
  let priority: PriorityType = 'medium';
  if (['urgent', 'zaroori', 'jaruri', 'important', 'asap', 'emergency', 'ਜ਼ਰੂਰੀ', 'जरूरी'].some((w) => textLower.includes(w))) {
    priority = 'high';
  } else if (['casual', 'whenever', 'low priority'].some((w) => textLower.includes(w))) {
    priority = 'low';
  }

  // 5. Clean Title
  let cleanTitle = transcript;
  const stripPhrases = [
    'remind me to', 'remind me', 'tomorrow at', 'tomorrow evening', 'tomorrow morning', 'tomorrow night', 'tomorrow',
    'today at', 'today evening', 'today morning', 'today night', 'today', 'kal shaam', 'kal subah', 'kal raat', 'kal dopahar', 'kal',
    'aaj shaam', 'aaj subah', 'aaj raat', 'aaj', 'parson', 'karna hai', 'karni hai', 'jana hai', 'jani hai', 'dena hai', 'deni hai',
    'karna', 'jana', 'hai', 'baje', 'कल सुबह', 'कल शाम', 'कल रात', 'कल', 'आज सुबह', 'आज शाम', 'आज', 'परसों', 'ਕੱਲ੍ਹ ਸ਼ਾਮ', 'ਕੱਲ੍ਹ ਸਵੇਰੇ', 'ਕੱਲ੍ਹ',
  ];
  stripPhrases.forEach((p) => {
    cleanTitle = cleanTitle.replace(new RegExp(`\\b${p.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi'), '');
    cleanTitle = cleanTitle.replace(p, '');
  });
  cleanTitle = cleanTitle.replace(/\b\d{1,2}(?::\d{2})?\s*(?:baje|बजे|ਵਜੇ|pm|am)?\b/gi, '');
  cleanTitle = cleanTitle.replace(/[\d\u0966-\u096F\u0A66-\u0A6F]+/g, '');
  cleanTitle = cleanTitle.replace(/[\s,.:!?]+/g, ' ').trim();

  cleanTitle = polishTaskTitle(cleanTitle);
  if (!cleanTitle || cleanTitle.length < 2) {
    cleanTitle = transcript.trim();
  } else {
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  }

  let detectedLang = 'en';
  if (/[\u0A00-\u0A7F]/.test(transcript)) detectedLang = 'pa';
  else if (/[\u0900-\u097F]/.test(transcript)) detectedLang = 'hi';
  else if (['karna', 'hai', 'subah', 'shaam', 'baje', 'kal'].some((w) => textLower.includes(w))) detectedLang = 'hinglish';

  return {
    title: cleanTitle,
    description: `Voice input (${detectedLang.toUpperCase()}): "${transcript}"`,
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    priority,
    category,
    reminder_required: true,
    original_transcript: transcript,
    language: detectedLang,
  };
}

export const api = {
  /**
   * Sends direct text to AI task parser with server API try + client-side AI/heuristic fallback.
   */
  async processVoiceText(text: string): Promise<ExtractedTask> {
    // 1. Try server backend if available
    try {
      const response = await fetch(`${API_BASE}/voice/process-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCustomKeyHeaders(),
        },
        body: JSON.stringify({
          text,
          user_timezone: getUserTimezone(),
        }),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('Backend API unreachable or offline, trying client-side parsing:', e);
    }

    // 2. Try client-side Gemini if API key in localStorage
    const geminiKey = localStorage.getItem('gemini_api_key');
    if (geminiKey && geminiKey.length > 10) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `User text: "${text}". Extract JSON task with fields: title, description, scheduled_date (YYYY-MM-DD), scheduled_time (HH:MM), priority (low/medium/high), category (work/study/personal/health/finance/general), reminder_required (boolean), language.` }] }],
            generationConfig: { response_mime_type: 'application/json', temperature: 0 }
          })
        });
        if (res.ok) {
          const data = await res.json();
          const contentStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (contentStr) {
            const parsed = JSON.parse(contentStr);
            return { ...parsed, original_transcript: text };
          }
        }
      } catch (err) {
        console.warn('Client-side Gemini API call failed, falling back:', err);
      }
    }

    // 3. Try client-side Groq if API key in localStorage
    const groqKey = localStorage.getItem('groq_api_key');
    if (groqKey && groqKey.length > 10) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'Extract JSON task with fields: title, description, scheduled_date (YYYY-MM-DD), scheduled_time (HH:MM), priority (low/medium/high), category (work/study/personal/health/finance/general), reminder_required (boolean), language.' },
              { role: 'user', content: text }
            ]
          })
        });
        if (res.ok) {
          const data = await res.json();
          const contentStr = data.choices?.[0]?.message?.content;
          if (contentStr) {
            const parsed = JSON.parse(contentStr);
            return { ...parsed, original_transcript: text };
          }
        }
      } catch (err) {
        console.warn('Client-side Groq API call failed, falling back:', err);
      }
    }

    // 4. Fallback to client-side heuristic parser
    return heuristicParseTask(text);
  },

  /**
   * Fetches all tasks from backend with localStorage fallback.
   */
  async getTasks(): Promise<Task[]> {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      if (res.ok) {
        const data: Task[] = await res.json();
        localStorage.setItem('voicetasks_cache', JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn('Network offline or backend unreachable, loading from local cache:', e);
    }

    const cached = localStorage.getItem('voicetasks_cache');
    return cached ? JSON.parse(cached) : [];
  },

  /**
   * Saves a newly confirmed task.
   */
  async createTask(taskData: TaskCreateInput): Promise<Task> {
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      if (res.ok) {
        const created: Task = await res.json();
        const cached = localStorage.getItem('voicetasks_cache');
        const list: Task[] = cached ? JSON.parse(cached) : [];
        localStorage.setItem('voicetasks_cache', JSON.stringify([created, ...list]));
        return created;
      }
    } catch (e) {
      console.warn('Failed to save to backend, falling back to local storage:', e);
    }

    const localTask: Task = {
      id: 'local-' + Date.now(),
      ...taskData,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    const cached = localStorage.getItem('voicetasks_cache');
    const list: Task[] = cached ? JSON.parse(cached) : [];
    localStorage.setItem('voicetasks_cache', JSON.stringify([localTask, ...list]));
    return localTask;
  },

  async updateTask(id: string, updates: TaskUpdateInput): Promise<Task> {
    try {
      const response = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updated: Task = await response.json();
        const cached = localStorage.getItem('voicetasks_cache');
        if (cached) {
          const list: Task[] = JSON.parse(cached);
          localStorage.setItem(
            'voicetasks_cache',
            JSON.stringify(list.map((task) => (task.id === id ? updated : task))),
          );
        }
        return updated;
      }
    } catch (e) {
      console.warn('Could not update task on server, updating local cache:', e);
    }

    const cached = localStorage.getItem('voicetasks_cache');
    if (cached) {
      const list: Task[] = JSON.parse(cached);
      const taskIndex = list.findIndex((task) => task.id === id);
      if (taskIndex !== -1) {
        const updated = { ...list[taskIndex], ...updates };
        list[taskIndex] = updated;
        localStorage.setItem('voicetasks_cache', JSON.stringify(list));
        return updated;
      }
    }
    throw new Error('Task not found');
  },

  /**
   * Toggles task completion.
   */
  async toggleTask(id: string): Promise<Task> {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/toggle`, {
        method: 'PATCH',
      });
      if (res.ok) {
        return res.json();
      }
    } catch (e) {
      console.warn('Could not toggle on server, toggling locally:', e);
    }

    const cached = localStorage.getItem('voicetasks_cache');
    if (cached) {
      const list: Task[] = JSON.parse(cached);
      const idx = list.findIndex((t) => t.id === id);
      if (idx !== -1) {
        list[idx].status = list[idx].status === 'pending' ? 'completed' : 'pending';
        localStorage.setItem('voicetasks_cache', JSON.stringify(list));
        return list[idx];
      }
    }
    throw new Error('Task not found');
  },

  /**
   * Deletes a task.
   */
  async deleteTask(id: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Could not delete on server:', e);
    }

    const cached = localStorage.getItem('voicetasks_cache');
    if (cached) {
      const list: Task[] = JSON.parse(cached);
      localStorage.setItem('voicetasks_cache', JSON.stringify(list.filter((t) => t.id !== id)));
    }
  },
};
