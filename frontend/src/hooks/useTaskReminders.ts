import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task } from '../types/task';
import {
  getNotificationPermission,
  requestNotificationPermission,
  playReminderChime,
  triggerHapticVibrate,
  sendNativeNotification,
} from '../services/notificationService';

export interface UseTaskRemindersResult {
  activeAlerts: Task[];
  permission: NotificationPermission | 'unsupported';
  requestPermission: () => Promise<NotificationPermission | 'unsupported'>;
  handleCompleteAlert: (id: string) => void;
  handleSnoozeAlert: (id: string, minutes?: number) => void;
  handleDismissAlert: (id: string) => void;
  testChime: () => void;
}

export const useTaskReminders = (
  tasks: Task[],
  onCompleteTask: (id: string) => void | Promise<void>
): UseTaskRemindersResult => {
  const [activeAlerts, setActiveAlerts] = useState<Task[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission
  );

  // Set of task IDs that have already triggered an alert or been dismissed in this session
  const dismissedIdsRef = useRef<Set<string>>(new Set<string>());
  // Map of taskId -> timestamp (ms) until which the reminder is snoozed
  const snoozedUntilRef = useRef<Map<string, number>>(new Map<string, number>());
  const tasksRef = useRef<Task[]>(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const handleDismissAlert = useCallback((id: string) => {
    dismissedIdsRef.current.add(id);
    setActiveAlerts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleSnoozeAlert = useCallback((id: string, minutes: number = 5) => {
    const snoozeUntil = Date.now() + minutes * 60 * 1000;
    snoozedUntilRef.current.set(id, snoozeUntil);
    // Remove from dismissed so it can trigger again when snooze expires
    dismissedIdsRef.current.delete(id);
    setActiveAlerts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleCompleteAlert = useCallback(
    (id: string) => {
      dismissedIdsRef.current.add(id);
      setActiveAlerts((prev) => prev.filter((t) => t.id !== id));
      void onCompleteTask(id);
    },
    [onCompleteTask]
  );

  const requestPermission = useCallback(async () => {
    const perm = await requestNotificationPermission();
    setPermission(perm);
    return perm;
  }, []);

  const testChime = useCallback(() => {
    playReminderChime();
    triggerHapticVibrate();
  }, []);

  // Evaluation loop: checks due reminders every 10 seconds
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const currentTasks = tasksRef.current;

      const newAlerts: Task[] = [];

      currentTasks.forEach((task) => {
        // Only pending tasks with reminders enabled
        if (task.status !== 'pending' || !task.reminder_required) return;
        if (!task.scheduled_date) return;

        // Parse scheduled date and time
        const [yearStr, monthStr, dayStr] = task.scheduled_date.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);
        if (isNaN(year) || isNaN(month) || isNaN(day)) return;

        let hours = 9;
        let minutes = 0;
        if (task.scheduled_time) {
          const [hStr, mStr] = task.scheduled_time.split(':');
          hours = parseInt(hStr, 10) || 0;
          minutes = parseInt(mStr, 10) || 0;
        }

        const dueDateTime = new Date(year, month - 1, day, hours, minutes, 0);
        const diffMs = now.getTime() - dueDateTime.getTime();

        // Check if snooze is currently active
        const snoozedUntil = snoozedUntilRef.current.get(task.id);
        const isSnoozed = snoozedUntil !== undefined && snoozedUntil > now.getTime();
        if (isSnoozed) return;

        // If snooze expired, remove it from snoozed map
        if (snoozedUntil !== undefined && now.getTime() >= snoozedUntil) {
          snoozedUntilRef.current.delete(task.id);
          dismissedIdsRef.current.delete(task.id);
        }

        // Check if already dismissed for this cycle
        if (dismissedIdsRef.current.has(task.id)) return;

        // Due window: task time is reached (0 to 3 hours past due)
        // or snoozed time reached
        const isDueNow = diffMs >= 0 && diffMs <= 3 * 60 * 60 * 1000;

        if (isDueNow) {
          newAlerts.push(task);
        }
      });

      if (newAlerts.length > 0) {
        setActiveAlerts((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const trulyNew = newAlerts.filter((t) => !existingIds.has(t.id));
          if (trulyNew.length === 0) return prev;

          // Play sound chime and trigger vibration once for new alerts
          playReminderChime();
          triggerHapticVibrate();

          // Dispatch native browser push notification for each new alert
          trulyNew.forEach((t) => {
            sendNativeNotification(t, () => {
              // Clicking native notification focuses window
              window.focus();
            });
          });

          return [...prev, ...trulyNew];
        });
      }
    };

    // Run check immediately
    checkReminders();

    // Check every 10 seconds
    const interval = setInterval(checkReminders, 10000);
    return () => clearInterval(interval);
  }, []);

  return {
    activeAlerts,
    permission,
    requestPermission,
    handleCompleteAlert,
    handleSnoozeAlert,
    handleDismissAlert,
    testChime,
  };
};
