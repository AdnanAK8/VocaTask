import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import './App.css';
import { Check, ChevronRight, Clock3, MessageCircle, Pencil, Plus, Settings, Trash2, X, Mic, Download, Bell, BellOff, Sparkles } from 'lucide-react';
import { FrontFixDrawer } from './features/frontfix';
import { VoiceRecorder, TaskConfirmModal, useTaskReminders, useTasks } from './features/tasks';
import type { Task, ExtractedTask, TaskCreateInput, PriorityType, CategoryType } from './features/tasks';
import { AuthGateDesign as AuthGate, UserProfileMenu, authService } from './features/auth';
import type { User } from './features/auth';
import { SettingsModal, InstallPwaBanner, ToastReminder, ErrorBoundary, errorTelemetry, type CapturedError } from './shared';
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
  const [extractedTask, setExtractedTask] = useState<ExtractedTask | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [errorCount, setErrorCount] = useState<number>(() => errorTelemetry.getErrorCount());
  const [isAssistantPromptVisible, setIsAssistantPromptVisible] = useState(true);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskFormValues>(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [today] = useState(() => new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  }));

  // Custom hook for tasks state and actions
  const {
    tasks,
    setTasks,
    tasksLoadError,
    deletingIds,
    taskFilter,
    setTaskFilter,
    pendingCount,
    visibleTasks,
    handleConfirmTask,
    handleToggleTask,
    handleDeleteTask,
    handleCompleteFromReminder,
    handleToggleReminder,
    createManualTask,
    updateManualTask,
  } = useTasks(currentUser);

  const reminders = useTaskReminders(tasks, handleCompleteFromReminder);

  useEffect(() => {
    return errorTelemetry.subscribe((errors) => {
      setErrorCount(errors.length);
    });
  }, []);

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

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setTasks([]);
  };

  const openFrontFix = () => {
    setIsAssistantPromptVisible(false);
    setFrontFixError(errorTelemetry.getLatestError());
    setIsFrontFixOpen(true);
  };

  const handleTaskExtracted = (extracted: ExtractedTask) => {
    setIsVoiceOpen(false);
    setExtractedTask(extracted);
  };

  const handleConfirmExtractedTask = async (taskInput: TaskCreateInput) => {
    await handleConfirmTask(taskInput);
    setExtractedTask(null);
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
        await updateManualTask(editingTask.id, values);
      } else {
        await createManualTask(values);
      }
      setIsTaskFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this task.');
    } finally {
      setIsSaving(false);
    }
  };

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
      {/* Floating FrontFix chatbot launcher */}
      {!isFrontFixOpen && isAssistantPromptVisible && (
        <div className="frontfix-assistant-popover" role="region" aria-label="FrontFix AI invitation">
          <button
            className="frontfix-assistant-message"
            onClick={openFrontFix}
            aria-label={
              errorCount > 0
                ? `Chat with FrontFix about ${errorCount} detected issue${errorCount === 1 ? '' : 's'}`
                : 'Chat with FrontFix about a problem'
            }
          >
            <span className="frontfix-assistant-avatar" aria-hidden="true">👩‍💻</span>
            <span className="frontfix-assistant-copy">
              <span className="frontfix-assistant-title">
                {errorCount > 0
                  ? `I spotted ${errorCount} issue${errorCount === 1 ? '' : 's'}`
                  : 'Hey! Need a hand?'}
              </span>
              <span className="frontfix-assistant-text">
                {errorCount > 0
                  ? 'Tell me what you’re seeing and I’ll help you fix it.'
                  : 'Seeing errors or something not working? Chat with me and we’ll figure it out.'}
              </span>
              <span className="frontfix-assistant-cta">Chat with me <ChevronRight size={14} /></span>
            </span>
          </button>
          <button
            className="frontfix-assistant-dismiss"
            onClick={() => setIsAssistantPromptVisible(false)}
            aria-label="Dismiss FrontFix invitation"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <button
        className={`frontfix-left-dock-btn ${errorCount > 0 ? 'has-errors' : ''}`}
        onClick={openFrontFix}
        aria-label="Open FrontFix AI Chatbot"
        title={errorCount > 0 ? `${errorCount} frontend issue(s) detected - click to fix` : 'Open FrontFix AI Diagnostic Chatbot'}
      >
        <span className="frontfix-dock-icon"><MessageCircle size={19} strokeWidth={2.2} /></span>
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
          onClick={openFrontFix}
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

          <div className="task-filter-tabs" role="tablist" aria-label="Task status filters">
            <button
              type="button"
              role="tab"
              aria-selected={taskFilter === 'all'}
              className={`filter-tab ${taskFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTaskFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={taskFilter === 'upcoming'}
              className={`filter-tab ${taskFilter === 'upcoming' ? 'active' : ''}`}
              onClick={() => setTaskFilter('upcoming')}
            >
              Upcoming ({pendingCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={taskFilter === 'completed'}
              className={`filter-tab ${taskFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setTaskFilter('completed')}
            >
              Done
            </button>
          </div>

          <div className="tasks-list" role="list">
            {visibleTasks.length === 0 ? (
              <p className="empty-state">
                {taskFilter === 'completed'
                  ? 'No completed tasks yet.'
                  : taskFilter === 'upcoming'
                    ? 'No upcoming tasks. You are all caught up!'
                    : 'No tasks yet. Try saying: "Remind me to call mom tomorrow at 6 PM"'}
              </p>
            ) : (
              visibleTasks.map((task) => (
                <article
                  key={task.id}
                  className={`task-row ${task.status === 'completed' ? 'completed' : ''} ${deletingIds.includes(task.id) ? 'deleting' : ''}`}
                  role="listitem"
                >
                  <button
                    type="button"
                    className="status-toggle"
                    onClick={() => handleToggleTask(task.id)}
                    aria-label={`Mark "${task.title}" as ${task.status === 'completed' ? 'pending' : 'completed'}`}
                  >
                    {task.status === 'completed' && <Check size={14} />}
                  </button>

                  <div className="task-details">
                    <p className="task-title">{task.title}</p>
                    <div className="task-metadata">
                      <span>{formatDate(task.scheduled_date)}</span>
                      {task.scheduled_time && (
                        <span>
                          <Clock3 size={12} />
                          {formatTime(task.scheduled_time)}
                        </span>
                      )}
                      <span className={`badge priority-${task.priority}`}>{task.priority}</span>
                      <span className="badge category">{task.category}</span>
                      {task.reminder_required && (
                        <span className="badge reminder-badge" title="Push alert & chime scheduled">
                          <Bell size={11} /> Reminder
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="task-actions">
                    <button
                      type="button"
                      className={`action-btn reminder-toggle ${task.reminder_required ? 'active' : ''}`}
                      onClick={() => handleToggleReminder(task)}
                      aria-label={task.reminder_required ? 'Turn off reminder alert' : 'Turn on reminder alert'}
                      title={task.reminder_required ? 'Reminder alert on (click to mute)' : 'Reminder alert off (click to enable)'}
                    >
                      {task.reminder_required ? <Bell size={15} /> : <BellOff size={15} />}
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => openTaskForm(task)}
                      aria-label={`Edit ${task.title}`}
                      title="Edit task"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="action-btn delete"
                      onClick={() => handleDeleteTask(task.id)}
                      aria-label={`Delete ${task.title}`}
                      title="Delete task"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="nav-item active" href="#tasks"><Check size={18} />Tasks</a>
        <button className="nav-add" onClick={() => setIsVoiceOpen(true)} aria-label="Add a task by voice" title="Add by voice"><Mic size={21} /></button>
        <button
          className="nav-item"
          onClick={openFrontFix}
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
          onConfirm={handleConfirmExtractedTask}
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
