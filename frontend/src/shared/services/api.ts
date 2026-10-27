import type { ExtractedTask, Task, TaskCreateInput, TaskUpdateInput } from '../../features/tasks';
import { heuristicParseTask, polishTaskTitle, toTitleCase } from '../../features/tasks/services/offlineTaskParser';

export { heuristicParseTask, polishTaskTitle, toTitleCase };

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
const API_BASE = configuredApiUrl
  ? (configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`)
  : import.meta.env.DEV
    ? '/api'
    : null;

const getApiUrl = (path: string): string | null => API_BASE ? `${API_BASE}${path}` : null;
const isDevelopment = import.meta.env.DEV;

const responseError = async (response: Response, action: string): Promise<Error> => {
  const data = await response.json().catch(() => null);
  return new Error(data?.detail || `${action} failed (HTTP ${response.status}).`);
};

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
  const groq = localStorage.getItem('groq_api_key')?.trim();
  if (groq && groq.startsWith('gsk_') && groq.length > 20) headers['X-Groq-Key'] = groq;
  const gemini = localStorage.getItem('gemini_api_key')?.trim();
  if (gemini && (gemini.startsWith('AIzaSy') || gemini.startsWith('AQ.')) && !gemini.startsWith('AIzaSyDXYy') && gemini.length > 20) {
    headers['X-Gemini-Key'] = gemini;
  }
  const openai = localStorage.getItem('openai_api_key')?.trim();
  if (openai && openai.startsWith('sk-') && openai.length > 20) headers['X-OpenAI-Key'] = openai;
  const elevenlabs = localStorage.getItem('elevenlabs_api_key')?.trim();
  if (elevenlabs && elevenlabs.length > 10) headers['X-ElevenLabs-Key'] = elevenlabs;

  // Authentication credentials
  const token = localStorage.getItem('vocatask_auth_token')?.trim();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const userJson = localStorage.getItem('vocatask_auth_user');
  if (userJson) {
    try {
      const u = JSON.parse(userJson);
      if (u?.id) headers['X-User-Id'] = u.id;
    } catch { }
  }

  return headers;
};

export const api = {
  /**
   * Sends direct text to the backend task parser.
   */
  async processVoiceText(text: string): Promise<ExtractedTask> {
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
      if (!response.ok) throw await responseError(response, 'Task parsing');
      if (!contentType.includes('application/json')) throw new Error('Backend returned an unexpected response.');
      return await response.json();
    } catch (e) {
      if (!isDevelopment) {
        throw new Error(`Backend task parsing failed: ${e instanceof Error ? e.message : 'Unable to reach the API.'}`);
      }
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
   * Uploads raw recorded audio for backend transcription and task extraction.
   */
  async processVoiceAudio(audioBlob: Blob, language?: string): Promise<ExtractedTask> {
    // 1. Try backend server if reachable
    let backendError: string | null = null;
    let backendResponded = false;
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
        backendResponded = true;

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          return await response.json();
        }
        const errorData = await response.json().catch(() => null);
        backendError = errorData?.detail || `Backend audio transcription failed (HTTP ${response.status}).`;
      }
    } catch (e) {
      backendError = e instanceof Error ? e.message : 'The audio transcription backend could not be reached.';
      if (isDevelopment) {
        console.warn('Backend API unreachable for audio transcription, trying client-side APIs:', e);
      }
    }

    const setupHelp = backendResponded
      ? ''
      : API_BASE
        ? 'Check that VITE_API_URL points to your HTTPS FastAPI backend and that backend CORS allows this frontend origin.'
        : 'Set VITE_API_URL to your HTTPS FastAPI backend.';
    if (!isDevelopment) {
      throw new Error([
        backendError || 'Audio transcription is unavailable.',
        setupHelp,
      ].filter(Boolean).join(' '));
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

    // 5. Try client-side ElevenLabs Scribe STT if key is saved in localStorage
    const elevenlabsKey = localStorage.getItem('elevenlabs_api_key')?.trim();
    if (elevenlabsKey && elevenlabsKey.length > 10) {
      try {
        const formData = new FormData();
        formData.append('file', audioBlob, getAudioFilename(audioBlob.type));
        formData.append('model_id', 'scribe_v1');
        if (language && language !== 'auto' && language !== 'hinglish') {
          formData.append('language_code', language.split('-')[0]);
        }

        const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: { 'xi-api-key': elevenlabsKey },
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.text) {
            return await this.processVoiceText(data.text);
          }
        } else {
          console.warn('ElevenLabs API returned status:', res.status);
        }
      } catch (err) {
        console.warn('Client-side ElevenLabs STT failed:', err);
      }
    }

    throw new Error([
      backendError || 'Audio transcription is unavailable.',
      setupHelp,
      'You can also type your task.',
    ].filter(Boolean).join(' '));
  },

  /**
   * Retrieves all tasks.
   */
  async getTasks(): Promise<Task[]> {
    try {
      const tasksUrl = getApiUrl('/tasks');
      if (!tasksUrl) throw new Error('Backend URL is not configured');
      const response = await fetch(tasksUrl, { headers: getCustomKeyHeaders() });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) throw await responseError(response, 'Task retrieval');
      if (!contentType.includes('application/json')) throw new Error('Backend returned an unexpected response while fetching tasks.');
      const data: Task[] = await response.json();
      localStorage.setItem('voicetasks_cache', JSON.stringify(data));
      return data;
    } catch (e) {
      if (!isDevelopment) throw e;
      console.warn('Failed to fetch from backend, returning cached data:', e);
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
        headers: { 'Content-Type': 'application/json', ...getCustomKeyHeaders() },
        body: JSON.stringify(taskData),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) throw await responseError(res, 'Saving task');
      if (!contentType.includes('application/json')) throw new Error('Backend returned an unexpected response while saving the task.');
      const created: Task = await res.json();
      const cached = localStorage.getItem('voicetasks_cache');
      const list: Task[] = cached ? JSON.parse(cached) : [];
      localStorage.setItem('voicetasks_cache', JSON.stringify([created, ...list]));
      return created;
    } catch (e) {
      if (!isDevelopment) throw e;
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
      const url = getApiUrl(`/tasks/${id}`);
      if (!url) throw new Error('Backend URL is not configured');
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getCustomKeyHeaders() },
        body: JSON.stringify(updates),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) throw await responseError(response, 'Updating task');
      if (!contentType.includes('application/json')) throw new Error('Backend returned an unexpected response while updating the task.');
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
    } catch (e) {
      if (!isDevelopment) throw e;
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
      const url = getApiUrl(`/tasks/${id}/toggle`);
      if (!url) throw new Error('Backend URL is not configured');
      const res = await fetch(url, { method: 'PATCH', headers: getCustomKeyHeaders() });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) throw await responseError(res, 'Updating task status');
      if (!contentType.includes('application/json')) throw new Error('Backend returned an unexpected response while updating task status.');
      return res.json();
    } catch (e) {
      if (!isDevelopment) throw e;
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
      const url = getApiUrl(`/tasks/${id}`);
      if (!url) throw new Error('Backend URL is not configured');
      const response = await fetch(url, { method: 'DELETE', headers: getCustomKeyHeaders() });
      if (!response.ok) throw await responseError(response, 'Deleting task');
    } catch (e) {
      if (!isDevelopment) throw e;
      console.warn('Could not delete on server:', e);
    }

    const cached = localStorage.getItem('voicetasks_cache');
    if (cached) {
      const list: Task[] = JSON.parse(cached);
      localStorage.setItem('voicetasks_cache', JSON.stringify(list.filter((t) => t.id !== id)));
    }
  },

  /**
   * Fetches backend AI and voice service status.
   */
  async getVoiceStatus(): Promise<{
    backend_ai_configured: boolean;
    provider: string;
    has_gemini: boolean;
    has_openai: boolean;
    has_groq: boolean;
    has_elevenlabs: boolean;
    message: string;
  }> {
    try {
      const url = getApiUrl('/voice/status');
      if (url) {
        const res = await fetch(url);
        if (res.ok) {
          return await res.json();
        }
      }
    } catch {
      // offline or unreachable
    }
    return {
      backend_ai_configured: false,
      provider: 'builtin',
      has_gemini: false,
      has_openai: false,
      has_groq: false,
      has_elevenlabs: false,
      message: 'Fast built-in multilingual parser active',
    };
  },
};
