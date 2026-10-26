import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import './App.css';
import { Check, ChevronRight, Clock3, Pencil, Plus, Settings, Trash2, X, Mic, Download, Bell, BellOff, Sparkles } from 'lucide-react';
import { FrontFixDrawer } from './features/frontfix';
import { VoiceRecorder, TaskConfirmModal, useTaskReminders } from './features/tasks';
import type { Task, ExtractedTask, TaskCreateInput, TaskUpdateInput, PriorityType, CategoryType } from './features/tasks';
import { AuthGateDesign as AuthGate, UserProfileMenu, authService } from './features/auth';
import type { User } from './features/auth';
import { SettingsModal, InstallPwaBanner, ToastReminder, api, ErrorBoundary, errorTelemetry, type CapturedError } from './shared';
import aivantaLogo from './assets/Aivanta-Logo.png';

interface TaskFormValues {
  title: string;
  description: string;
  date: string;
  time: string;
  priority: PriorityType;
  category: CategoryType;
  reminder_required: boolean;
}

const emptyForm: TaskFormValues = {
  title: '',
  description: '',
  date: '',
  time: '',
  priority: 'medium',
  category: 'general',
  reminder_required: true,
};

type TaskFilter = 'all' | 'upcoming' | 'completed';

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

interface AppContentProps {
  isFrontFixOpen: boolean;
  setIsFrontFixOpen: (open: boolean) => void;
  frontFixError: CapturedError | null;
  setFrontFixError: (err: CapturedError | null) => void;
}

const AppContent = ({
  isFrontFixOpen,
  setIsFrontFixOpen,
  frontFixError,
  setFrontFixError,
}: AppContentProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getStoredUser());
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [extractedTask, setExtractedTask] = useState<ExtractedTask | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [errorCount, setErrorCount] = useState<number>(() => errorTelemetry.getErrorCount());

  useEffect(() => {
    return errorTelemetry.subscribe((errors) => {
      setErrorCount(errors.length);
    });
  }, []);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskFormValues>(emptyForm);
  const [formError, setFormError] = useState('');
  const [tasksLoadError, setTasksLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [today] = useState(() => new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  }));

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setTasks([]);
  };

  const loadTasks = async () => {
    if (!currentUser) return;
    try {
      const data = await api.getTasks();
      setTasks(data);
      setTasksLoadError('');
    } catch (err) {
      console.error('Error loading tasks:', err);
      setTasksLoadError(err instanceof Error ? err.message : 'Could not load tasks from the backend.');
    }
  };

  // Check auth session on startup
  useEffect(() => {
    let active = true;
    authService.getCurrentUser()
      .then((user) => {
        if (active && user) {
          setCurrentUser(user);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsAuthChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Load tasks on startup or when currentUser changes
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    api.getTasks()
      .then((data) => {
        if (active) {
          setTasks(data);
          setTasksLoadError('');
        }
      })
      .catch((err) => {
        console.error('Error loading tasks:', err);
        if (active) {
          setTasksLoadError(err instanceof Error ? err.message : 'Could not load tasks from the backend.');
        }
      });
    return () => {
      active = false;
    };
  }, [currentUser]);

  const handleTaskExtracted = (extracted: ExtractedTask) => {
    setIsVoiceOpen(false);
    setExtractedTask(extracted);
  };

  const handleConfirmTask = async (taskInput: TaskCreateInput) => {
    const created = await api.createTask(taskInput);
    setTasks((prev) => [created, ...prev]);
    setTasksLoadError('');
    setExtractedTask(null);
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
  if (deletingIds.includes(id)) return; // ignore double-clicks
  setDeletingIds((prev) => [...prev, id]);

  // wait for the animation (must match the CSS duration)
  await new Promise((resolve) => setTimeout(resolve, 350));

  try {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await api.deleteTask(id);
  } catch (err) {
    console.error('Failed to delete task:', err);
    loadTasks();
  } finally {
    setDeletingIds((prev) => prev.filter((x) => x !== id));
  }
};

  const handleCompleteFromReminder = async (id: string) => {
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'completed' } : t))
      );
      await api.updateTask(id, { status: 'completed' });
    } catch (err) {
      console.error('Failed to complete task from reminder:', err);
    }
  };

  const reminders = useTaskReminders(tasks, handleCompleteFromReminder);

  const handleToggleReminder = async (task: Task) => {
    const nextVal = !task.reminder_required;
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, reminder_required: nextVal } : t))
      );
      await api.updateTask(task.id, { reminder_required: nextVal });
      if (nextVal && reminders.permission !== 'granted') {
        void reminders.requestPermission();
      }
    } catch (err) {
      console.error('Failed to toggle reminder:', err);
      loadTasks();
    }
  };

  const handleHeaderNotificationClick = () => {
    if (reminders.permission !== 'granted') {
      void reminders.requestPermission();
    } else {
      reminders.testChime();
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
      reminder_required: task.reminder_required,
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
      reminder_required: form.reminder_required,
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
  const visibleTasks = tasks.filter((task) => {
    if (taskFilter === 'upcoming') return task.status === 'pending';
    if (taskFilter === 'completed') return task.status === 'completed';
    return true;
  });

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-600/30 animate-pulse ring-1 ring-white/20">
          <span className="text-white font-extrabold text-xl">V</span>
        </div>
        <p className="text-xs text-slate-400 mt-3 font-medium">Connecting to VocaTask AI...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthGate
        onAuthenticated={(user) => {
          setCurrentUser(user);
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      {/* Option on the left: Pop up FrontFix Chatbot from left side */}
      <button
        className={`frontfix-left-dock-btn ${errorCount > 0 ? 'has-errors' : ''}`}
        onClick={() => {
          setFrontFixError(errorTelemetry.getLatestError());
          setIsFrontFixOpen(true);
        }}
        aria-label="Open FrontFix AI Chatbot from left"
        title={errorCount > 0 ? `${errorCount} frontend issue(s) detected - click to fix` : 'Open FrontFix AI Diagnostic Chatbot (Pops up from left)'}
      >
        <span className="frontfix-dock-icon">⚡</span>
        <span className="frontfix-dock-text">FrontFix AI</span>
        <span className={`frontfix-dock-badge ${errorCount > 0 ? 'has-errors' : ''}`}>
          {errorCount > 0 ? `${errorCount} ISSUE${errorCount > 1 ? 'S' : ''}` : 'CHAT'}
        </span>
      </button>
      <header className="header">
        <div className="brand">
          <a href="#tasks" className="brand-logo-link" aria-label="VocaTask home" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <span className="brand-mark">V</span>
            <span className="brand-name" style={{ color: 'var(--text)', fontWeight: 720 }}>VocaTask</span>
          </a>
          <span className="brand-text">
            <a href="https://aivantaai.com/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <span className="brand-powered">
                Powered by <img src={aivantaLogo} alt="AiVanta" />
              </span>
            </a>
          </span>
        </div>
        <button
          className={`header-frontfix-btn ${errorCount > 0 ? 'has-errors' : ''}`}
          onClick={() => {
            setFrontFixError(errorTelemetry.getLatestError());
            setIsFrontFixOpen(true);
          }}
          aria-label="Open FrontFix AI Chatbot"
          title={errorCount > 0 ? `${errorCount} frontend error(s) intercepted - click to diagnose` : 'Open FrontFix AI Diagnostic Chatbot from left'}
        >
          <Sparkles size={15} />
          <span>FrontFix AI</span>
          {errorCount > 0 && <span className="header-error-badge">{errorCount}</span>}
        </button>
        <div className="header-actions">
          <button
            className="icon-button header-notifications"
            onClick={handleHeaderNotificationClick}
            aria-label="Notification Reminders"
            title={
              reminders.permission === 'granted'
                ? 'Push reminders active - Click to test chime'
                : 'Click to enable push reminders'
            }
          >
            <Bell size={18} style={{ color: reminders.permission === 'granted' ? '#4a6b5d' : undefined }} />
          </button>
          <button
            className="icon-button header-install"
            onClick={() => window.dispatchEvent(new CustomEvent('open-install-pwa'))}
            aria-label="Install App"
            title="Install VocaTask App"
          >
            <Download size={18} />
          </button>
          <button className="icon-button header-settings" onClick={() => setIsSettingsOpen(true)} aria-label="Open settings" title="Settings">
            <Settings size={18} />
          </button>
          <UserProfileMenu user={currentUser} onLogout={handleLogout} />
        </div>
      </header>

      <main className="main" id="tasks">
        <section className="welcome">
          <p className="greeting">Good day, {currentUser.name} · Your day in focus</p>
          <h1>What do you need<br className="desktop-break" /> to get done, {currentUser.name.split(' ')[0]}?</h1>
        </section>
        {tasksLoadError && <p className="form-error" role="alert">Backend connection failed: {tasksLoadError}</p>}

        <button className="voice-card" onClick={() => setIsVoiceOpen(true)}>
          <span className="voice-mic"><Mic size={25} /></span>
          <span className="voice-content">
            <strong>Tell me what to do</strong>
            <span>Speak naturally in English, Hindi, or Punjabi</span>
            <small>Voice AI will organize the details for you</small>
          </span>
          <span className="voice-arrow"><ChevronRight size={21} /></span>
        </button>

        <button className="manual-add" onClick={() => openTaskForm()}>
          <Plus size={17} /> Add new task
        </button>

        <section className="tasks-section" aria-labelledby="tasks-heading">
          <div className="section-heading">
            <div>
              <h2 id="tasks-heading">Your tasks</h2>
              <p>{today}</p>
            </div>
            <span>{pendingCount} {pendingCount === 1 ? 'task' : 'tasks'} left</span>
          </div>

          <div className="task-list-panel">
            <div className="task-filters" role="tablist" aria-label="Filter tasks">
              <button className={taskFilter === 'all' ? 'active' : ''} onClick={() => setTaskFilter('all')} role="tab" aria-selected={taskFilter === 'all'}>
                All <span>{tasks.length}</span>
              </button>
              <button className={taskFilter === 'upcoming' ? 'active' : ''} onClick={() => setTaskFilter('upcoming')} role="tab" aria-selected={taskFilter === 'upcoming'}>
                Upcoming <span>{pendingCount}</span>
              </button>
              <button className={taskFilter === 'completed' ? 'active' : ''} onClick={() => setTaskFilter('completed')} role="tab" aria-selected={taskFilter === 'completed'}>
                Completed <span>{completedCount}</span>
              </button>
            </div>
            <div className="task-list" role="tabpanel">
              {visibleTasks.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon"><Check size={22} /></span>
                  <h3>{tasks.length === 0 ? 'A little room to breathe' : 'Nothing here yet'}</h3>
                  <p>{tasks.length === 0 ? 'Your tasks will show up here. Add one by voice or enter it yourself.' : 'Tasks matching this filter will appear here.'}</p>
                </div>
              ) : visibleTasks.map((task) => (
                <article className={`task-card ${task.status === 'completed' ? 'completed' : ''} ${deletingIds.includes(task.id) ? 'deleting' : ''}`} key={task.id}>
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
                    <button
                      className={`task-reminder-btn ${task.reminder_required ? 'active' : 'inactive'}`}
                      onClick={() => void handleToggleReminder(task)}
                      aria-label={task.reminder_required ? 'Disable reminder' : 'Enable reminder'}
                      title={task.reminder_required ? 'Reminder enabled - Click to disable' : 'Reminder disabled - Click to enable'}
                    >
                      {task.reminder_required ? <Bell size={15} /> : <BellOff size={15} />}
                    </button>
                    <button onClick={() => openTaskForm(task)} aria-label={`Edit ${task.title}`} title="Edit task"><Pencil size={15} /></button>
                    <button onClick={() => void handleDeleteTask(task.id)} aria-label={`Delete ${task.title}`} title="Delete task"><Trash2 size={15} /></button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {completedCount > 0 && <p className="completed-summary">{completedCount} {completedCount === 1 ? 'task' : 'tasks'} completed</p>}
        </section>

      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="nav-item active" href="#tasks"><Check size={18} />Tasks</a>
        <button className="nav-add" onClick={() => setIsVoiceOpen(true)} aria-label="Add a task by voice" title="Add by voice"><Mic size={21} /></button>
        <button
          className="nav-item"
          onClick={() => {
            setFrontFixError(errorTelemetry.getLatestError());
            setIsFrontFixOpen(true);
          }}
          aria-label="Open FrontFix AI Chatbot"
          title="FrontFix Chatbot"
        >
          <Sparkles size={18} style={errorCount > 0 ? { color: '#ef4444' } : undefined} />
          <span>{errorCount > 0 ? `Issues (${errorCount})` : 'Chatbot'}</span>
        </button>
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
              <label className="form-reminder-row">
                <input
                  type="checkbox"
                  checked={form.reminder_required}
                  onChange={(e) => setForm({ ...form, reminder_required: e.target.checked })}
                />
                <span><Bell size={15} /> Remind me when due (push notification & chime)</span>
              </label>
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
        user={currentUser}
        onLogout={handleLogout}
      />

      <ToastReminder
        alerts={reminders.activeAlerts}
        onComplete={reminders.handleCompleteAlert}
        onSnooze={reminders.handleSnoozeAlert}
        onDismiss={reminders.handleDismissAlert}
      />

      <InstallPwaBanner />

      <FrontFixDrawer
        isOpen={isFrontFixOpen}
        onClose={() => setIsFrontFixOpen(false)}
        initialError={frontFixError}
      />
    </div>
  );
};

export const App = () => {
  const [frontFixError, setFrontFixError] = useState<CapturedError | null>(null);
  const [isFrontFixOpen, setIsFrontFixOpen] = useState(false);

  return (
    <ErrorBoundary
      onOpenFrontFix={(err) => {
        setFrontFixError(err || errorTelemetry.getLatestError());
        setIsFrontFixOpen(true);
      }}
    >
      <AppContent
        isFrontFixOpen={isFrontFixOpen}
        setIsFrontFixOpen={setIsFrontFixOpen}
        frontFixError={frontFixError}
        setFrontFixError={setFrontFixError}
      />
    </ErrorBoundary>
  );
};

export default App;
