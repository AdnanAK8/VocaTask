import type { ExtractedTask, PriorityType, CategoryType } from '../types/task';

export const WORD_TO_NUMBER: Record<string, number> = {
  ek: 1, ik: 1, one: 1, 'एक': 1, 'ਇੱਕ': 1, 'ਇਕ': 1,
  do: 2, two: 2, 'दो': 2, 'ਦੋ': 2,
  teen: 3, tin: 3, three: 3, 'तीन': 3, 'ਤਿੰਨ': 3,
  chaar: 4, char: 4, four: 4, 'चार': 4, 'ਚਾਰ': 4,
  paanch: 5, panch: 5, panj: 5, five: 5, 'पाँच': 5, 'पांच': 5, 'ਪੰਜ': 5,
  chhe: 6, che: 6, chey: 6, six: 6, 'छह': 6, 'छः': 6, 'ਛੇ': 6,
  saat: 7, sat: 7, seven: 7, 'सात': 7, 'ਸੱਤ': 7,
  aath: 8, ath: 8, aat: 8, eight: 8, 'आठ': 8, 'ਅੱਠ': 8,
  nau: 9, no: 9, naun: 9, nine: 9, 'नौ': 9, 'ਨੌਂ': 9,
  das: 10, duss: 10, ten: 10, 'दस': 10, 'ਦਸ': 10,
  gyarah: 11, gyara: 11, giarah: 11, eleven: 11, 'ग्यारह': 11, 'ਗਿਆਰਾਂ': 11,
  barah: 12, bara: 12, baarah: 12, twelve: 12, 'बारह': 12, 'ਬਾਰਾਂ': 12,
};

export function toTitleCase(phrase: string): string {
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

export function polishTaskTitle(title: string): string {
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

  // 8. Seminar / Webinar / Workshop / Conference / Presentation
  const mEvent = cleaned.match(/^(?:attend|join|participate\s+in)?\s*(?:a\s+)?(seminar|webinar|workshop|conference|presentation|demo|symposium)(?:\s+(?:hai|attend|karna))?$/i);
  if (mEvent) {
    return `Attend ${toTitleCase(mEvent[1])}`;
  }
  if (['seminar', 'webinar', 'workshop', 'conference', 'presentation', 'demo'].includes(cleaned.toLowerCase())) {
    return `Attend ${toTitleCase(cleaned)}`;
  }
  const mEventTopic = cleaned.match(/^(?:attend\s+)?(.*?)\s+(seminar|webinar|workshop|conference|presentation)(?:\s+(?:hai|attend|karna))?$/i);
  if (mEventTopic) {
    const topic = mEventTopic[1].trim();
    const eventWord = toTitleCase(mEventTopic[2].trim());
    if (!['i have a', 'i have an', 'have a', 'have an', 'a', 'an', 'the', 'my', 'mera', 'meri', 'ek'].includes(topic.toLowerCase())) {
      return toTitleCase(`Attend ${topic} ${eventWord}`);
    }
    return `Attend ${eventWord}`;
  }

  return toTitleCase(cleaned);
}

export const MONTH_NAME_TO_NUM: Record<string, number> = {
  january: 1, jan: 1, 'जनवरी': 1, 'ਜਨਵਰੀ': 1, janvari: 1,
  february: 2, feb: 2, 'फ़रवरी': 2, 'फरवरी': 2, 'ਫ਼ਰਵਰੀ': 2, 'ਫਰਵਰੀ': 2, farvari: 2,
  march: 3, mar: 3, 'मार्च': 3, 'ਮਾਰਚ': 3,
  april: 4, apr: 4, 'अप्रैल': 4, 'ਅਪ੍ਰੈਲ': 4,
  may: 5, 'मई': 5, 'ਮਈ': 5, mai: 5,
  june: 6, jun: 6, 'जून': 6, 'ਜੂਨ': 6,
  july: 7, jul: 7, 'जुलाई': 7, 'ਜੁਲਾਈ': 7,
  august: 8, aug: 8, 'अगस्त': 8, 'ਅਗਸਤ': 8, agast: 8,
  september: 9, sep: 9, sept: 9, 'सितंबर': 9, 'ਸਤੰਬਰ': 9, sitambar: 9,
  october: 10, oct: 10, 'अक्टूबर': 10, 'अक्तूबर': 10, 'ਅਕਤੂਬਰ': 10, aktubar: 10,
  november: 11, nov: 11, 'नवंबर': 11, 'ਨਵੰਬਰ': 11, navambar: 11,
  december: 12, dec: 12, 'दिसंबर': 12, 'ਦਸੰਬਰ': 12, disambar: 12,
};

export function heuristicParseTask(transcript: string): ExtractedTask {
  const textLower = transcript.toLowerCase();
  const now = new Date();

  // 1. Date resolution
  let scheduledDate: string | null = null;
  let matchedDateStr = '';

  const monthKeys = Object.keys(MONTH_NAME_TO_NUM).sort((a, b) => b.length - a.length);
  const monthPattern = monthKeys.map((k) => k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');

  const reDayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthPattern})(?:\\s+(\\d{4}))?\\b`, 'i');
  const reMonthDay = new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b`, 'i');
  const reNumericDate = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/;

  const mCalDayMonth = textLower.match(reDayMonth);
  const mCalMonthDay = textLower.match(reMonthDay);

  if (mCalDayMonth) {
    const dVal = parseInt(mCalDayMonth[1], 10);
    const mName = mCalDayMonth[2].toLowerCase();
    const monVal = MONTH_NAME_TO_NUM[mName] || 10;
    const yVal = mCalDayMonth[3] ? parseInt(mCalDayMonth[3], 10) : now.getFullYear();
    if (dVal >= 1 && dVal <= 31 && monVal >= 1 && monVal <= 12) {
      const d = new Date(yVal, monVal - 1, dVal);
      scheduledDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      matchedDateStr = mCalDayMonth[0];
    }
  } else if (mCalMonthDay) {
    const mName = mCalMonthDay[1].toLowerCase();
    const dVal = parseInt(mCalMonthDay[2], 10);
    const monVal = MONTH_NAME_TO_NUM[mName] || 10;
    const yVal = mCalMonthDay[3] ? parseInt(mCalMonthDay[3], 10) : now.getFullYear();
    if (dVal >= 1 && dVal <= 31 && monVal >= 1 && monVal <= 12) {
      const d = new Date(yVal, monVal - 1, dVal);
      scheduledDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      matchedDateStr = mCalMonthDay[0];
    }
  } else {
    const mNum = textLower.match(reNumericDate);
    if (mNum) {
      const dVal = parseInt(mNum[1], 10);
      const monVal = parseInt(mNum[2], 10);
      let yVal = mNum[3] ? parseInt(mNum[3], 10) : now.getFullYear();
      if (yVal < 100) yVal += 2000;
      if (dVal >= 1 && dVal <= 31 && monVal >= 1 && monVal <= 12) {
        const d = new Date(yVal, monVal - 1, dVal);
        scheduledDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        matchedDateStr = mNum[0];
      }
    }
  }

  // Fallback to relative dates
  if (!scheduledDate) {
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

  // Clean matched calendar date and ordinal words from time resolution
  let textForTime = normalizedText;
  if (matchedDateStr) {
    textForTime = textForTime.replace(new RegExp(`(?:\\b(?:on|at|for)\\s+)?${matchedDateStr.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'gi'), ' ');
  }
  textForTime = textForTime.replace(/\b\d{1,2}(?:st|nd|rd|th)\b/gi, ' ');
  textForTime = textForTime.replace(/\b(?:in\s+)?\d{1,2}\s+(?:days?|din|hafte|weeks?)\b/gi, ' ');

  // Relative minutes or hours ("in 30 minutes", "aadhe ghante baad", "1 ghante baad")
  const mRelMin = textForTime.match(/\b(?:in\s+)?(\d{1,2})\s*(?:min|mins|minutes|minute)\b|\b(\d{1,2})\s*minute\s+baad\b/i);
  const mRelHour = textForTime.match(/\b(?:in\s+)?(\d{1,2})\s*(?:hr|hrs|hour|hours)\b|\b(\d{1,2})\s*ghante?\s+baad\b/i);
  if (textForTime.includes('aadhe ghante') || textForTime.includes('half an hour')) {
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
  } else if (/\b(dedh|ਡੇਢ|डेढ़)\s*(?:baje|बजे|ਵਜੇ)?\b/i.test(textForTime)) {
    parsedHour = 1;
    parsedMinutes = 30;
    const h = isAfternoon || isPm ? 13 : 1;
    scheduledTime = `${String(h).padStart(2, '0')}:30`;
  } else if (/\b(dhaai|dhayi|ਢਾਈ|ढाई)\s*(?:baje|बजे|ਵਜੇ)?\b/i.test(textForTime)) {
    parsedHour = 2;
    parsedMinutes = 30;
    const h = isAfternoon || isPm ? 14 : 2;
    scheduledTime = `${String(h).padStart(2, '0')}:30`;
  } else {
    const mHalf = textForTime.match(/\b(?:sadhe|saadhe|ਸਾਢੇ|साढ़े)\s+(\d{1,2})/i);
    const mSava = textForTime.match(/\b(?:sava|sawwa|ਸਵਾ|सवा)\s+(\d{1,2})/i);
    const mPaune = textForTime.match(/\b(?:paune|pauna|ਪੌਣੇ|पौने)\s+(\d{1,2})/i);

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
      const mColon = textForTime.match(/\b(\d{1,2}):(\d{2})\s*(?:pm|am|p\.m\.|a\.m\.)?/i);
      const mMarker = textForTime.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:baje|बजे|ਵਜੇ|pm|am|p\.m\.|a\.m\.|o'clock)\b/i);
      const mPrep = textForTime.match(/\b(?:at|around|sharply\s+at|subah|subh|shaam|sham|raat|morning|evening|night|सवेरे|सुबह|शाम|रात|ਸਵੇਰੇ|ਸ਼ਾਮ|ਰਾਤ)\s+(\d{1,2})(?::(\d{2}))?\b/i);

      if (mColon) {
        parsedHour = parseInt(mColon[1], 10);
        parsedMinutes = parseInt(mColon[2], 10);
      } else if (mMarker) {
        parsedHour = parseInt(mMarker[1], 10);
        if (mMarker[2]) parsedMinutes = parseInt(mMarker[2], 10);
      } else if (mPrep) {
        parsedHour = parseInt(mPrep[1], 10);
        if (mPrep[2]) parsedMinutes = parseInt(mPrep[2], 10);
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
  if (['dbms', 'database', 'assignment', 'study', 'exam', 'padhna', 'homework', 'class', 'college', 'school', 'test', 'course', 'lecture', 'seminar', 'webinar', 'workshop', 'ਪੜ੍ਹਨਾ', 'ਪੜ੍ਹਾਈ', 'पढ़ना'].some((w) => textLower.includes(w))) {
    category = 'study';
  } else if (['mom', 'dad', 'mother', 'father', 'friend', 'rahul', 'party', 'dinner', 'lunch', 'birthday', 'family', 'मम्मी', 'पापा', 'दोस्त'].some((w) => textLower.includes(w))) {
    category = 'personal';
  } else if (['gym', 'workout', 'exercise', 'walk', 'badminton', 'running', 'medicine', 'doctor', 'dentist', 'health', 'दवा', 'डॉक्टर'].some((w) => textLower.includes(w))) {
    category = 'health';
  } else if (['meeting', 'project', 'office', 'client', 'boss', 'work', 'presentation', 'interview', 'conference', 'email', 'report', 'standup'].some((w) => textLower.includes(w))) {
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

  if (matchedDateStr) {
    cleanTitle = cleanTitle.replace(new RegExp(`(?:\\b(?:on|at|for)\\s+)?${matchedDateStr.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'gi'), ' ');
  }
  cleanTitle = cleanTitle.replace(reDayMonth, ' ');
  cleanTitle = cleanTitle.replace(reMonthDay, ' ');
  cleanTitle = cleanTitle.replace(reNumericDate, ' ');

  const stripPhrases = [
    'i have a', 'i have an', 'i have', 'there is a', 'there is an', 'we have a',
    'mera ek', 'meri ek', 'ek', 'mujhko',
    'remind me to', 'remind me', 'tomorrow at', 'tomorrow evening', 'tomorrow morning', 'tomorrow night', 'tomorrow',
    'today at', 'today evening', 'today morning', 'today night', 'today', 'kal shaam', 'kal subah', 'kal raat', 'kal dopahar', 'kal',
    'aaj shaam', 'aaj subah', 'aaj raat', 'aaj', 'parson', 'karna hai', 'karni hai', 'jana hai', 'jani hai', 'dena hai', 'deni hai',
    'karna', 'jana', 'hai', 'baje', 'कल सुबह', 'कल शाम', 'कल रात', 'कल', 'आज सुबह', 'आज शाम', 'आज', 'परसों', 'ਕੱਲ੍ਹ ਸ਼ਾਮ', 'ਕੱਲ੍ਹ ਸਵੇਰੇ', 'ਕੱਲ੍ਹ',
  ];
  stripPhrases.forEach((p) => {
    cleanTitle = cleanTitle.replace(new RegExp(`\\b${p.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi'), ' ');
  });

  cleanTitle = cleanTitle.replace(/\b(?:st|nd|rd|th)\b/gi, ' ');
  cleanTitle = cleanTitle.replace(/\b\d{1,2}(?::\d{2})?\s*(?:baje|बजे|ਵਜੇ|pm|am)?\b/gi, ' ');
  cleanTitle = cleanTitle.replace(/[\d\u0966-\u096F\u0A66-\u0A6F]+/g, ' ');
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
