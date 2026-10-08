import type { CategoryType, ExtractedTask, PriorityType, Task, TaskCreateInput, TaskUpdateInput } from '../types/task';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
const API_BASE = configuredApiUrl
  ? (configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`)
  : import.meta.env.DEV
    ? '/api'
    : null;

const getApiUrl = (path: string): string | null => API_BASE ? `${API_BASE}${path}` : null;

const getAudioFilename = (mimeType: string): string => {
  const normalizedType = mimeType.toLowerCase();
  if (normalizedType.includes('mp4') || normalizedType.includes('m4a')) return 'voice_recording.m4a';
  if (normalizedType.includes('ogg')) return 'voice_recording.ogg';
  if (normalizedType.includes('wav')) return 'voice_recording.wav';
  return 'voice_recording.webm';
};

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

function toTitleCase(phrase: string): string {
  if (!phrase) return phrase;
  const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'of', 'on', 'or', 'the', 'to', 'via', 'with', 'ka', 'ki', 'ke', 'da', 'di', 'de']);
  const words = phrase.trim().split(/\s+/);
  return words
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (['dbms', 'sql', 'ui', 'ux', 'api', 'ai', 'pdf', 'hr', 'it'].includes(lw)) {
        return lw.toUpperCase();
      }
      if (i === 0 || !smallWords.has(lw)) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }
      return lw;
    })
    .join(' ');
}

function polishTaskTitle(title: string): string {
  const cleaned = title.trim();
  if (!cleaned) return '';

  // 1. Study patterns
  const mStudy1 = cleaned.match(/^(.*?)\s+(?:padhna|padhni|padhai|padh|study|read|learn|ਪੜ੍ਹਨਾ|ਪੜ੍ਹਾਈ|पढ़ना|पढना)(?:\s+hai)?$/i);
  if (mStudy1) {
    const subj = mStudy1[1].trim();
    const subjStr = subj.length <= 4 ? subj.toUpperCase() : toTitleCase(subj);
    return `Study ${subjStr}`;
  }
  const mStudy2 = cleaned.match(/^(?:padhna|padhni|padhai|padh|study|read|learn|ਪੜ੍ਹਨਾ|ਪੜ੍ਹਾਈ|पढ़ना|पढना)\s+(.*?)(?:\s+hai)?$/i);
  if (mStudy2) {
    const subj = mStudy2[1].trim();
    const subjStr = subj.length <= 4 ? subj.toUpperCase() : toTitleCase(subj);
    return `Study ${subjStr}`;
  }

  // 2. Doctor patterns
  if (/\b(doctor|dr\.|dentist|clinic)\b/i.test(cleaned)) {
    const docName = cleaned.replace(/\s*(?:ke\s+paas|jana|jani|jaana|hai|appointment|visit)\s*/gi, ' ').trim();
    return docName ? `Visit ${toTitleCase(docName)}` : 'Visit Doctor';
  }

  // 3. Wake up patterns
  const mWake = cleaned.match(/^(?:uthana|uthna|jagna|utho|wake\s*up|get\s*up|ਉੱਠਣਾ|ਉਠਣਾ|उठना|जागना)\s+(?:hai\s+)?(.+?)\s+(?:ke\s+liye|lai|waste|nu|ko)$/i);
  if (mWake) {
    return `Wake up for ${toTitleCase(mWake[1].trim())}`;
  }
  if (/^(?:uthana|uthna|jagna|utho|wake\s*up|get\s*up|ਉੱਠਣਾ|ਉਠਣਾ|उठना|जागना)(?:\s+hai)?$/i.test(cleaned)) {
    return 'Wake Up';
  }

  // 4. Call patterns
  const mCall1 = cleaned.match(/^(.*?)\s+(?:ko|nu)\s+(?:call|phone|milna)(?:\s+karna)?$/i);
  if (mCall1) {
    return `Call ${toTitleCase(mCall1[1].trim())}`;
  }
  const mCall2 = cleaned.match(/^(?:call|phone)\s+(?:to\s+)?(.*?)(?:\s+ko|\s+nu)?$/i);
  if (mCall2) {
    return `Call ${toTitleCase(mCall2[1].trim())}`;
  }

  // 5. Action patterns
  const mSubmit = cleaned.match(/^(.*?)\s+(?:ka|ki|ke|da|di|de)\s+(.*?)\s+(submit|complete|finish|karna|check|review|dena)$/i);
  if (mSubmit) {
    const verbMap: Record<string, string> = { submit: 'Submit', complete: 'Complete', finish: 'Finish', karna: 'Do', check: 'Check', review: 'Review', dena: 'Submit' };
    const v = verbMap[mSubmit[3].toLowerCase()] || mSubmit[3];
    return toTitleCase(`${v} ${mSubmit[1]} ${mSubmit[2]}`);
  }
  const mAction = cleaned.match(/^(.*?)\s+(submit|complete|finish|check|review|pay|bharna)$/i);
  if (mAction) {
    const verbMap: Record<string, string> = { submit: 'Submit', complete: 'Complete', finish: 'Finish', check: 'Check', review: 'Review', pay: 'Pay', bharna: 'Pay' };
    const v = verbMap[mAction[2].toLowerCase()] || mAction[2];
    return toTitleCase(`${v} ${mAction[1]}`);
  }

  // 6. Gym / exercise
  const mGym = cleaned.match(/^(gym|walk|workout)\s+(?:jana|jani|jaana|जाना|ਜਾਣਾ)?$/i);
  if (mGym) {
    const word = mGym[1].toLowerCase();
    if (word === 'gym') return 'Gym Workout';
    return toTitleCase(word);
  }

  // 7. Pay bill
  const mPay = cleaned.match(/^(?:pay|bharna)\s+(.*?)$/i);
  if (mPay) {
    return `Pay ${toTitleCase(mPay[1].trim())}`;
  }

  return toTitleCase(cleaned);
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

  const in3Days = new Date(now);
  in3Days.setDate(in3Days.getDate() + 3);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const weekdayMap: Record<string, number> = {
    monday: 1, somwar: 1, 'ਸੋਮਵਾਰ': 1, 'सोमवार': 1,
    tuesday: 2, mangalwar: 2, 'ਮੰਗਲਵਾਰ': 2, 'मंगलवार': 2,
    wednesday: 3, budhwar: 3, 'ਬੁੱਧਵਾਰ': 3, 'बुधवार': 3,
    thursday: 4, guruwar: 4, veervar: 4, 'ਵੀਰਵਾਰ': 4, 'गुरुवार': 4,
    friday: 5, shukrawar: 5, 'ਸ਼ੁੱਕਰਵਾਰ': 5, 'शुक्रवार': 5,
    saturday: 6, shaniwar: 6, 'ਸ਼ਨਿੱਚਰਵਾਰ': 6, 'शनिवार': 6,
    sunday: 0, ravivar: 0, aitwar: 0, 'ਐਤਵਾਰ': 0, 'रविवार': 0,
  };

  let matchedWeekday: number | null = null;
  for (const [dayName, dayIdx] of Object.entries(weekdayMap)) {
    if (new RegExp(`\\b${dayName}\\b`, 'i').test(textLower)) {
      matchedWeekday = dayIdx;
      break;
    }
  }

  if (['parson', 'day after tomorrow', 'ਪਰਸੋਂ', 'परसों'].some((k) => textLower.includes(k))) {
    scheduledDate = dayAfter.toISOString().split('T')[0];
  } else if (['kal', 'tomorrow', 'ਕੱਲ੍ਹ', 'कल'].some((k) => textLower.includes(k))) {
    scheduledDate = tomorrow.toISOString().split('T')[0];
  } else if (['aaj', 'today', 'tonight', 'aaj raat', 'ਅੱਜ', 'आज'].some((k) => textLower.includes(k))) {
    scheduledDate = now.toISOString().split('T')[0];
  } else if (['3 din baad', 'in 3 days'].some((k) => textLower.includes(k))) {
    scheduledDate = in3Days.toISOString().split('T')[0];
  } else if (['agle hafte', 'next week', 'ਅਗਲੇ ਹਫ਼ਤੇ'].some((k) => textLower.includes(k))) {
    scheduledDate = nextWeek.toISOString().split('T')[0];
  } else if (matchedWeekday !== null) {
    const currentDay = now.getDay();
    let daysToAdd = (matchedWeekday - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7;
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    scheduledDate = targetDate.toISOString().split('T')[0];
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

  // Relative minutes or hours ("in 30 minutes", "aadhe ghante baad", "1 ghante baad")
  const mRelMin = normalizedText.match(/\b(?:in\s+)?(\d{1,2})\s*(?:min|mins|minutes|minute)\b|\b(\d{1,2})\s*minute\s+baad\b/i);
  const mRelHour = normalizedText.match(/\b(?:in\s+)?(\d{1,2})\s*(?:hr|hrs|hour|hours)\b|\b(\d{1,2})\s*ghante?\s+baad\b/i);
  if (normalizedText.includes('aadhe ghante') || normalizedText.includes('half an hour')) {
    const t = new Date(now.getTime() + 30 * 60000);
    scheduledTime = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    scheduledDate = t.toISOString().split('T')[0];
  } else if (mRelMin) {
    const mins = parseInt(mRelMin[1] || mRelMin[2], 10);
    const t = new Date(now.getTime() + mins * 60000);
    scheduledTime = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    scheduledDate = t.toISOString().split('T')[0];
  } else if (mRelHour) {
    const hrs = parseInt(mRelHour[1] || mRelHour[2], 10);
    const t = new Date(now.getTime() + hrs * 3600000);
    scheduledTime = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    scheduledDate = t.toISOString().split('T')[0];
  } else if (/\b(dedh|ਡੇਢ|डेढ़)\s*(?:baje|बजे|ਵਜੇ)?\b/i.test(normalizedText)) {
    parsedHour = 1;
    parsedMinutes = 30;
    const h = isAfternoon || isPm ? 13 : 1;
    scheduledTime = `${String(h).padStart(2, '0')}:30`;
  } else if (/\b(dhaai|dhayi|ਢਾਈ|ढाई)\s*(?:baje|बजे|ਵਜੇ)?\b/i.test(normalizedText)) {
    parsedHour = 2;
    parsedMinutes = 30;
    const h = isAfternoon || isPm ? 14 : 2;
    scheduledTime = `${String(h).padStart(2, '0')}:30`;
  } else {
    const mHalf = normalizedText.match(/\b(?:sadhe|saadhe|ਸਾਢੇ|साढ़े)\s+(\d{1,2})/i);
    const mSava = normalizedText.match(/\b(?:sava|sawwa|ਸਵਾ|सवा)\s+(\d{1,2})/i);
    const mPaune = normalizedText.match(/\b(?:paune|pauna|ਪੌਣੇ|पौने)\s+(\d{1,2})/i);

    if (mHalf) {
      parsedHour = parseInt(mHalf[1], 10);
      parsedMinutes = 30;
    } else if (mSava) {
      parsedHour = parseInt(mSava[1], 10);
      parsedMinutes = 15;
    } else if (mPaune) {
      const h = parseInt(mPaune[1], 10);
      parsedHour = h > 1 ? h - 1 : 12;
      parsedMinutes = 45;
    } else {
      const timeMatch = normalizedText.match(/(\d{1,2})(?::(\d{2}))?\s*(?:baje|बजे|ਵਜੇ|pm|am|o'clock)?/i);
      if (timeMatch) {
        parsedHour = parseInt(timeMatch[1], 10);
        if (timeMatch[2]) parsedMinutes = parseInt(timeMatch[2], 10);
      }
    }

    if (parsedHour !== null && !isNaN(parsedHour)) {
      let h = parsedHour;
      if (h >= 1 && h <= 12) {
        if (isPm && h < 12) h += 12;
        else if (isAfternoon && h <= 6) h += 12;
        else if (isAm && h === 12) h = 0;
        else if (!isAm && !isPm && !isAfternoon) {
          if (['gym', 'workout', 'dinner', 'evening walk', 'party', 'drinks'].some((w) => textLower.includes(w)) && h >= 5 && h <= 11) {
            h += 12;
          }
        }
      }
      scheduledTime = `${String(h).padStart(2, '0')}:${String(parsedMinutes).padStart(2, '0')}`;
    }
  }

  if (!scheduledTime) {
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
  const highKeywords = ['urgent', 'zaroori', 'jaruri', 'bohot zaroori', 'bahut jaruri', 'important', 'asap', 'emergency', 'turant', 'abhi ke abhi', 'immediately', 'must do', 'deadline', 'crucial', 'pakka', 'exam', 'doctor', 'dentist', 'hospital', 'interview', 'ਜ਼ਰੂਰੀ', 'ਤੁਰੰਤ', 'जरूरी', 'अति आवश्यक'];
  const lowKeywords = ['casual', 'whenever', 'low priority', 'not urgent', 'kabhi bhi', 'fursat me', 'free time', 'chill', 'optional', 'no rush', 'ਕਦੇ ਵੀ', 'ਫੁਰਸਤ', 'फुर्सत', 'कभी भी'];

  if (highKeywords.some((w) => textLower.includes(w))) {
    priority = 'high';
  } else if (lowKeywords.some((w) => textLower.includes(w))) {
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
    cleanTitle = toTitleCase(cleanTitle);
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
    const processTextUrl = getApiUrl('/voice/process-text');
    try {
      if (!processTextUrl) throw new Error('Backend URL is not configured');
      const response = await fetch(processTextUrl, {
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

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        return await response.json();
      }
    } catch (e) {
      console.warn('Backend API unreachable or offline, trying client-side parsing:', e);
    }

    // 2. Try client-side Gemini if API key in localStorage
    const geminiKey = localStorage.getItem('gemini_api_key');
    if (geminiKey && geminiKey.length > 15 && !geminiKey.startsWith('AIzaSyDXYy')) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `User text: "${text}". Extract JSON task with fields: title (Title Cased short action phrase without date/time), description, scheduled_date (YYYY-MM-DD), scheduled_time (HH:MM), priority (low/medium/high), category (work/study/personal/health/finance/general), reminder_required (boolean), language.` }] }],
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
    if (groqKey && groqKey.length > 15) {
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
              { role: 'system', content: 'Extract JSON task with fields: title (Title Cased short action phrase without date/time), description, scheduled_date (YYYY-MM-DD), scheduled_time (HH:MM), priority (low/medium/high), category (work/study/personal/health/finance/general), reminder_required (boolean), language.' },
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
   * Uploads raw recorded audio blob for backend Whisper/Gemini transcription & task extraction
   * with full client-side Groq/OpenAI/Gemini fallback when deployed statically (e.g. AWS S3/CloudFront)!
   */
  async processVoiceAudio(audioBlob: Blob, language?: string): Promise<ExtractedTask> {
    // 1. Try backend server if reachable
    let backendError: string | null = null;
    try {
      const processAudioUrl = getApiUrl('/voice/process-audio');
      if (!processAudioUrl) {
        backendError = 'No production backend URL is configured.';
      } else {
        const formData = new FormData();
        formData.append('file', audioBlob, getAudioFilename(audioBlob.type));
        formData.append('user_timezone', getUserTimezone());
        if (language) {
          formData.append('language', language);
        }

        const response = await fetch(processAudioUrl, {
          method: 'POST',
          headers: getCustomKeyHeaders(),
          body: formData,
        });

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          return await response.json();
        }
        const errorData = await response.json().catch(() => null);
        backendError = errorData?.detail || `Backend audio transcription failed (HTTP ${response.status}).`;
      }
    } catch (e) {
      backendError = e instanceof Error ? e.message : 'The audio transcription backend could not be reached.';
      console.warn('Backend API unreachable for audio transcription, trying client-side APIs:', e);
    }

    // 2. Try client-side Gemini Multimodal Audio API if key is saved in localStorage
    const geminiKey = localStorage.getItem('gemini_api_key');
    if (geminiKey && geminiKey.length > 15 && !geminiKey.startsWith('AIzaSyDXYy')) {
      try {
        const base64Audio = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const resStr = reader.result as string;
            resolve(resStr.split(',')[1] || '');
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: audioBlob.type || 'audio/webm', data: base64Audio } },
                { text: 'Transcribe this audio recording accurately word for word in its original language (Hindi, Punjabi, Hinglish, English, etc.). Output ONLY the raw transcript text with no extra commentary or quotes.' }
              ]
            }]
          })
        });

        if (res.ok) {
          const data = await res.json();
          const transcriptText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (transcriptText) {
            return await this.processVoiceText(transcriptText);
          }
        }
      } catch (err) {
        console.warn('Client-side Gemini audio transcription failed:', err);
      }
    }

    // 3. Try client-side OpenAI Whisper API if key is saved in localStorage
    const openaiKey = localStorage.getItem('openai_api_key');
    if (openaiKey && openaiKey.length > 15) {
      try {
        const formData = new FormData();
        formData.append('file', audioBlob, getAudioFilename(audioBlob.type));
        formData.append('model', 'whisper-1');

        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openaiKey}` },
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            return await this.processVoiceText(data.text);
          }
        }
      } catch (err) {
        console.warn('Client-side OpenAI Whisper API failed:', err);
      }
    }

    // 4. Try client-side Groq Whisper API if key is saved in localStorage
    const groqKey = localStorage.getItem('groq_api_key');
    if (groqKey && groqKey.length > 15) {
      try {
        const formData = new FormData();
        formData.append('file', audioBlob, getAudioFilename(audioBlob.type));
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('response_format', 'json');
        if (language && language !== 'auto' && language !== 'hinglish') {
          formData.append('language', language.split('-')[0]);
        }

        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}` },
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            return await this.processVoiceText(data.text);
          }
        }
      } catch (err) {
        console.warn('Client-side Groq Whisper API failed:', err);
      }
    }

    throw new Error(
      `${backendError || 'Audio transcription is unavailable.'} ${API_BASE ? 'Check that VITE_API_URL points to your HTTPS FastAPI backend and that backend CORS allows this frontend origin.' : 'Set VITE_API_URL to your HTTPS FastAPI backend, or add a supported user API key in Settings.'} You can also type your task.`
    );
  },

  /**
   * Fetches all tasks from backend with localStorage fallback.
   */
  async getTasks(): Promise<Task[]> {
    try {
      const tasksUrl = getApiUrl('/tasks');
      if (!tasksUrl) throw new Error('Backend URL is not configured');
      const res = await fetch(tasksUrl);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
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
      const tasksUrl = getApiUrl('/tasks');
      if (!tasksUrl) throw new Error('Backend URL is not configured');
      const res = await fetch(tasksUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
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

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
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
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
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
