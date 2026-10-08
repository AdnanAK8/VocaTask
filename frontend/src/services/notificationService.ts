import type { Task } from '../types/task';

/**
 * Service to manage Web Notifications API, Web Audio chime sound synthesizer,
 * and vibration for task reminders.
 */

export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.warn('Failed to request notification permission:', error);
    return Notification.permission;
  }
};

/**
 * Plays a warm, melodic 3-tone notification chime using the Web Audio API.
 * Synthesized on-the-fly, works offline without external audio files.
 */
export const playReminderChime = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    // Ascending melodic chord: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz)
    const tones = [
      { freq: 523.25, offset: 0.0, duration: 0.18 },
      { freq: 659.25, offset: 0.12, duration: 0.22 },
      { freq: 783.99, offset: 0.24, duration: 0.42 },
    ];

    tones.forEach(({ freq, offset, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + offset);

      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + offset);
      osc.stop(now + offset + duration + 0.05);
    });
  } catch (err) {
    console.warn('Could not synthesize notification chime:', err);
  }
};

/**
 * Triggers mobile device vibration pattern if supported.
 */
export const triggerHapticVibrate = (): void => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([150, 80, 150]);
    } catch {
      // Ignore vibration errors
    }
  }
};

/**
 * Dispatches a native browser / OS push notification if permissions are granted.
 */
export const sendNativeNotification = (task: Task, onOpen?: () => void): void => {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  try {
    const timeDetail = task.scheduled_time ? ` at ${task.scheduled_time}` : '';
    const dateDetail = task.scheduled_date ? ` (${task.scheduled_date}${timeDetail})` : '';
    const body = `Due now${dateDetail}! Priority: ${task.priority.toUpperCase()}.${task.description ? `\n${task.description}` : ''}`;

    const notification = new Notification(`⏰ Task Reminder: ${task.title}`, {
      body,
      icon: '/icons/pwa-192x192.png',
      badge: '/icons/pwa-192x192.png',
      tag: `task-reminder-${task.id}`,
      requireInteraction: true,
      lang: task.language || 'en',
    });

    notification.onclick = () => {
      try {
        window.focus();
        notification.close();
        if (onOpen) onOpen();
      } catch {
        // Ignore focus issues
      }
    };
  } catch (err) {
    console.warn('Native notification failed:', err);
  }
};
