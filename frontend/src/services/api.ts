import type { ExtractedTask, Task, TaskCreateInput, TaskUpdateInput } from '../types/task';

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

export const api = {

  /**
   * Sends direct text (from Web Speech API or manual input) to AI task parser.
   */
  async processVoiceText(text: string): Promise<ExtractedTask> {
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

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Failed to process text' }));
      throw new Error(err.detail || `Server error (${response.status})`);
    }

    return response.json();
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
            JSON.stringify(list.map((task) => task.id === id ? updated : task)),
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
