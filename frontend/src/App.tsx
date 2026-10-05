import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { VoiceRecorder } from './components/VoiceRecorder';
import { TaskConfirmModal } from './components/TaskConfirmModal';
import { TaskList } from './components/TaskList';
import { InstallPwaBanner } from './components/InstallPwaBanner';
import { api } from './services/api';
import type { Task, ExtractedTask, TaskCreateInput } from './types/task';

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [extractedTask, setExtractedTask] = useState<ExtractedTask | null>(null);

  // Load tasks on startup
  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Error loading tasks:', err);
    }
  };

  const handleTaskExtracted = (extracted: ExtractedTask) => {
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
    try {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' } : t
        )
      );
      await api.toggleTask(id);
    } catch (err) {
      console.error('Failed to toggle task:', err);
      // Revert if error
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white pb-12">
      {/* Top Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-2 sm:px-4 py-4 space-y-6">
        {/* Voice Recorder Hero */}
        <VoiceRecorder onTaskExtracted={handleTaskExtracted} />

        {/* Task List Section */}
        <TaskList
          tasks={tasks}
          onToggle={handleToggleTask}
          onDelete={handleDeleteTask}
        />
      </main>

      {/* Task Confirmation Modal Sheet */}
      {extractedTask && (
        <TaskConfirmModal
          extractedTask={extractedTask}
          onConfirm={handleConfirmTask}
          onCancel={() => setExtractedTask(null)}
        />
      )}

      {/* Install App as PWA Banner */}
      <InstallPwaBanner />
    </div>
  );
};

export default App;
