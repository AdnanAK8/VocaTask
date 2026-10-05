import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import './App.css';
import { Check, ChevronRight, Clock3, Pencil, Plus, Settings, Trash2, X, Mic } from 'lucide-react';
import { VoiceRecorder } from './components/VoiceRecorder';
import { TaskConfirmModal } from './components/TaskConfirmModal';
import { InstallPwaBanner } from './components/InstallPwaBanner';
import { SettingsModal } from './components/SettingsModal';
import { api } from './services/api';
import type { Task, ExtractedTask, TaskCreateInput, TaskUpdateInput, PriorityType, CategoryType } from './types/task';

interface TaskFormValues {
  title: string;
  description: string;
  date: string;
  time: string;
  priority: PriorityType;
  category: CategoryType;
}

const emptyForm: TaskFormValues = {
  title: '',
  description: '',
  date: '',
  time: '',
  priority: 'medium',
  category: 'general',
};

const formatDate = (value?: string | null): string => {
  if (!value) return 'No date';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatTime = (value?: string | null): string => {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const App = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [extractedTask, setExtractedTask] = useState<ExtractedTask | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskFormValues>(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [today] = useState(() => new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  }));

  const loadTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Error loading tasks:', err);
    }
  };

  // Load tasks on startup
  useEffect(() => {
    let active = true;
    api.getTasks()
      .then((data) => {
        if (active) setTasks(data);
      })
      .catch((err) => {
        console.error('Error loading tasks:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleTaskExtracted = (extracted: ExtractedTask) => {
    setIsVoiceOpen(false);
    setExtractedTask(extracted);
  };

  const handleConfirmTask = async (taskInput: TaskCreateInput) => {
    try {
      const created = await api.createTask(taskInput);
      setTasks((prev) => [created, ...prev]);
      setExtractedTask(null);
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleToggleTask = async (id: string) => {
    const previousTasks = tasks;
    try {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' } : t
        )
      );
      await api.toggleTask(id);
    } catch (err) {
      console.error('Failed to toggle task:', err);
      setTasks(previousTasks);
      loadTasks();
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      await api.deleteTask(id);
    } catch (err) {
      console.error('Failed to delete task:', err);
      loadTasks();
    }
  };

  const openTaskForm = (task?: Task) => {
    setEditingTask(task ?? null);
    setForm(task ? {
      title: task.title,
      description: task.description ?? '',
      date: task.scheduled_date ?? '',
      time: task.scheduled_time ?? '',
      priority: task.priority,
      category: task.category,
    } : emptyForm);
    setFormError('');
    setIsTaskFormOpen(true);
  };

  const saveManualTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setFormError('Add a title before saving.');
      return;
    }

    setIsSaving(true);
    setFormError('');
    const values: TaskCreateInput = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      scheduled_date: form.date || null,
      scheduled_time: form.time || null,
      priority: form.priority,
      category: form.category,
      reminder_required: true,
    };

    try {
      if (editingTask) {
        const updates: TaskUpdateInput = values;
        const updated = await api.updateTask(editingTask.id, updates);
        setTasks((current) => current.map((task) => task.id === updated.id ? updated : task));
      } else {
        const created = await api.createTask(values);
        setTasks((current) => [created, ...current]);
      }
      setIsTaskFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this task.');
    } finally {
      setIsSaving(false);
    }
  };

  const pendingCount = tasks.filter((task) => task.status === 'pending').length;
  const completedCount = tasks.length - pendingCount;

  return (
    <div className="app-shell">
      <header className="header">
        <a className="brand" href="#tasks" aria-label="VoiceTasks home">
          <span className="brand-mark">V</span>
          <span>VoiceTasks</span>
        </a>
        <button className="icon-button header-settings" onClick={() => setIsSettingsOpen(true)} aria-label="Open settings" title="Settings">
          <Settings size={18} />
        </button>
      </header>

      <main className="main" id="tasks">
        <section className="welcome">
          <p className="greeting">Your day, in focus</p>
          <h1>What do you need<br className="desktop-break" /> to get done?</h1>
        </section>

        <button className="voice-card" onClick={() => setIsVoiceOpen(true)}>
          <span className="voice-mic"><Mic size={25} /></span>
          <span className="voice-content">
            <strong>Tell me what to do</strong>
            <span>Speak naturally in English, Hindi, or Punjabi</span>
            <small>Voice AI will organize the details for you</small>
          </span>
          <span className="voice-arrow"><ChevronRight size={21} /></span>
        </button>

        <section className="tasks-section" aria-labelledby="tasks-heading">
          <div className="section-heading">
            <div>
              <h2 id="tasks-heading">Your tasks</h2>
              <p>{today}</p>
            </div>
            <span>{pendingCount} {pendingCount === 1 ? 'task' : 'tasks'} left</span>
          </div>

          <div className="task-list">
            {tasks.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon"><Check size={22} /></span>
                <h3>A little room to breathe</h3>
                <p>Your tasks will show up here. Add one by voice or enter it yourself.</p>
              </div>
            ) : tasks.map((task) => (
              <article className={`task-card ${task.status === 'completed' ? 'completed' : ''}`} key={task.id}>
                <button
                  className={`task-check ${task.status === 'completed' ? 'checked' : ''}`}
                  onClick={() => void handleToggleTask(task.id)}
                  aria-label={task.status === 'completed' ? 'Mark as pending' : 'Mark as completed'}
                  title={task.status === 'completed' ? 'Mark as pending' : 'Mark as completed'}
                >
                  {task.status === 'completed' && <Check size={14} />}
                </button>
                <div className="task-details">
                  <h3>{task.title}</h3>
                  <p>
                    {formatDate(task.scheduled_date)}
                    {task.scheduled_time && <><span className="detail-separator">·</span><Clock3 size={12} /> {formatTime(task.scheduled_time)}</>}
                  </p>
                </div>
                <span className={`priority-tag ${task.priority}`}>{task.priority}</span>
                <span className={`category-tag ${task.category}`}>{task.category}</span>
                <div className="task-actions">
                  <button onClick={() => openTaskForm(task)} aria-label={`Edit ${task.title}`} title="Edit task"><Pencil size={15} /></button>
                  <button onClick={() => void handleDeleteTask(task.id)} aria-label={`Delete ${task.title}`} title="Delete task"><Trash2 size={15} /></button>
                </div>
              </article>
            ))}
          </div>

          <button className="manual-add" onClick={() => openTaskForm()}>
            <Plus size={17} /> Add task manually
          </button>
          {completedCount > 0 && <p className="completed-summary">{completedCount} {completedCount === 1 ? 'task' : 'tasks'} completed</p>}
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="nav-item active" href="#tasks"><Check size={18} />Tasks</a>
        <button className="nav-add" onClick={() => setIsVoiceOpen(true)} aria-label="Add a task by voice" title="Add by voice"><Mic size={21} /></button>
        <button className="nav-item" onClick={() => setIsSettingsOpen(true)}><Settings size={18} />Settings</button>
      </nav>

      {isVoiceOpen && (
        <div className="modal-overlay voice-overlay" onMouseDown={() => setIsVoiceOpen(false)}>
          <section className="voice-dialog" onMouseDown={(event) => event.stopPropagation()} aria-label="Create a task by voice">
            <button className="modal-close voice-close" onClick={() => setIsVoiceOpen(false)} aria-label="Close voice recorder"><X size={18} /></button>
            <VoiceRecorder onTaskExtracted={handleTaskExtracted} onOpenSettings={() => setIsSettingsOpen(true)} />
          </section>
        </div>
      )}

      {isTaskFormOpen && (
        <div className="modal-overlay" onMouseDown={() => setIsTaskFormOpen(false)}>
          <section className="task-modal" onMouseDown={(event) => event.stopPropagation()} aria-labelledby="task-form-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">{editingTask ? 'Edit task' : 'New task'}</p>
                <h2 id="task-form-title">{editingTask ? 'Make an update' : 'Add a task'}</h2>
              </div>
              <button className="modal-close" onClick={() => setIsTaskFormOpen(false)} aria-label="Close task form"><X size={18} /></button>
            </div>
            <form onSubmit={saveManualTask}>
              <label>Task title<input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What needs to be done?" /></label>
              <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add a little context (optional)" rows={3} /></label>
              <div className="form-row">
                <label>Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
                <label>Time<input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>
              </div>
              <div className="form-row">
                <label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as PriorityType })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
                <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as CategoryType })}><option value="general">General</option><option value="work">Work</option><option value="study">Study</option><option value="personal">Personal</option><option value="health">Health</option><option value="finance">Finance</option></select></label>
              </div>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setIsTaskFormOpen(false)}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={isSaving}>{isSaving ? 'Saving…' : editingTask ? 'Update task' : 'Add task'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {extractedTask && (
        <TaskConfirmModal
          extractedTask={extractedTask}
          onConfirm={handleConfirmTask}
          onCancel={() => setExtractedTask(null)}
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <InstallPwaBanner />
    </div>
  );
};

export default App;
