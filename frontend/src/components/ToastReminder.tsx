import React, { useEffect } from 'react';
import { Bell, Check, Clock, X, RotateCcw } from 'lucide-react';
import type { Task } from '../types/task';

export interface ToastReminderProps {
  alerts: Task[];
  onComplete: (id: string) => void;
  onSnooze: (id: string, minutes?: number) => void;
  onDismiss: (id: string) => void;
}

export const ToastReminder: React.FC<ToastReminderProps> = ({
  alerts,
  onComplete,
  onSnooze,
  onDismiss,
}) => {
  // If no alerts are active, render nothing
  if (alerts.length === 0) return null;

  return (
    <aside
      className="toast-reminder-container"
      role="region"
      aria-label="Task reminders"
    >
      {alerts.map((task) => (
        <SingleToastItem
          key={task.id}
          task={task}
          onComplete={onComplete}
          onSnooze={onSnooze}
          onDismiss={onDismiss}
        />
      ))}
    </aside>
  );
};

interface SingleToastItemProps {
  task: Task;
  onComplete: (id: string) => void;
  onSnooze: (id: string, minutes?: number) => void;
  onDismiss: (id: string) => void;
}

const SingleToastItem: React.FC<SingleToastItemProps> = ({
  task,
  onComplete,
  onSnooze,
  onDismiss,
}) => {
  // Optional auto-dismiss after 40 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(task.id);
    }, 40000);
    return () => clearTimeout(timer);
  }, [task.id, onDismiss]);

  const priorityColor =
    task.priority === 'high'
      ? 'var(--urgent, #e06d53)'
      : task.priority === 'medium'
      ? 'var(--medium, #b8893d)'
      : 'var(--low, #6c8c79)';

  return (
    <div
      className="toast-reminder-card"
      style={{ borderLeft: `5px solid ${priorityColor}` }}
      role="alert"
      aria-live="assertive"
    >
      <div className="toast-header">
        <div className="toast-badge-group">
          <span className="toast-bell-icon">
            <Bell size={16} />
            <span className="toast-ping-dot" />
          </span>
          <span className="toast-title-tag">Task Reminder Due</span>
          <span className={`priority-tag ${task.priority}`}>{task.priority}</span>
        </div>
        <button
          className="toast-close-btn"
          onClick={() => onDismiss(task.id)}
          aria-label="Dismiss reminder"
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      <div className="toast-body">
        <h4 className="toast-task-title">{task.title}</h4>
        {task.description && (
          <p className="toast-task-desc">{task.description}</p>
        )}
        <div className="toast-meta">
          {task.scheduled_time && (
            <span className="toast-time">
              <Clock size={13} /> {task.scheduled_time}
            </span>
          )}
          <span className={`category-tag ${task.category}`}>{task.category}</span>
        </div>
      </div>

      <div className="toast-actions">
        <button
          className="toast-btn toast-btn-complete"
          onClick={() => onComplete(task.id)}
          aria-label="Mark task as complete"
        >
          <Check size={14} /> Complete
        </button>
        <button
          className="toast-btn toast-btn-snooze"
          onClick={() => onSnooze(task.id, 5)}
          title="Snooze for 5 minutes"
          aria-label="Snooze for 5 minutes"
        >
          <RotateCcw size={14} /> Snooze 5m
        </button>
      </div>
    </div>
  );
};
