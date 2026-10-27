import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Task, TaskCreateInput, TaskUpdateInput } from '../types/task';
import type { User } from '../../auth';
import { api } from '../../../shared';

export type TaskFilter = 'all' | 'upcoming' | 'completed';

export function useTasks(currentUser: User | null, onPermissionRequest?: () => void, permission?: NotificationPermission) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoadError, setTasksLoadError] = useState<string>('');
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');

  const loadTasks = useCallback(async () => {
    if (!currentUser) {
      setTasks([]);
      return;
    }
    try {
      const data = await api.getTasks();
      setTasks(data);
      setTasksLoadError('');
    } catch (err) {
      console.error('Error loading tasks:', err);
      setTasksLoadError(err instanceof Error ? err.message : 'Could not load tasks from the backend.');
    }
  }, [currentUser]);

  // Load tasks on startup or when currentUser changes
  useEffect(() => {
    let active = true;
    if (!currentUser) return;
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

  const handleConfirmTask = useCallback(async (taskInput: TaskCreateInput) => {
    const created = await api.createTask(taskInput);
    setTasks((prev) => [created, ...prev]);
    setTasksLoadError('');
    return created;
  }, []);

  const handleToggleTask = useCallback(async (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' } : t
      )
    );
    try {
      await api.toggleTask(id);
    } catch (err) {
      console.error('Failed to toggle task:', err);
      loadTasks();
    }
  }, [loadTasks]);

  const handleDeleteTask = useCallback(async (id: string) => {
    if (deletingIds.includes(id)) return;
    setDeletingIds((prev) => [...prev, id]);

    // Wait for the exit animation duration (must match CSS)
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
  }, [deletingIds, loadTasks]);

  const handleCompleteFromReminder = useCallback(async (id: string) => {
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'completed' } : t))
      );
      await api.updateTask(id, { status: 'completed' });
    } catch (err) {
      console.error('Failed to complete task from reminder:', err);
    }
  }, []);

  const handleToggleReminder = useCallback(async (task: Task) => {
    const nextVal = !task.reminder_required;
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, reminder_required: nextVal } : t))
      );
      await api.updateTask(task.id, { reminder_required: nextVal });
      if (nextVal && permission !== 'granted' && onPermissionRequest) {
        onPermissionRequest();
      }
    } catch (err) {
      console.error('Failed to toggle reminder:', err);
      loadTasks();
    }
  }, [permission, onPermissionRequest, loadTasks]);

  const updateManualTask = useCallback(async (id: string, updates: TaskUpdateInput) => {
    const updated = await api.updateTask(id, updates);
    setTasks((current) => current.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const createManualTask = useCallback(async (input: TaskCreateInput) => {
    const created = await api.createTask(input);
    setTasks((current) => [created, ...current]);
    return created;
  }, []);

  const pendingCount = useMemo(() => tasks.filter((task) => task.status === 'pending').length, [tasks]);
  const completedCount = useMemo(() => tasks.length - pendingCount, [tasks, pendingCount]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (taskFilter === 'upcoming') return task.status === 'pending';
      if (taskFilter === 'completed') return task.status === 'completed';
      return true;
    });
  }, [tasks, taskFilter]);

  return {
    tasks,
    setTasks,
    tasksLoadError,
    setTasksLoadError,
    deletingIds,
    taskFilter,
    setTaskFilter,
    pendingCount,
    completedCount,
    visibleTasks,
    loadTasks,
    handleConfirmTask,
    handleToggleTask,
    handleDeleteTask,
    handleCompleteFromReminder,
    handleToggleReminder,
    createManualTask,
    updateManualTask,
  };
}
