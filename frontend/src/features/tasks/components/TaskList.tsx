import React, { useState, useMemo } from 'react';
import { Search, CalendarDays } from 'lucide-react';
import type { Task } from '../types/task';
import { TaskCard } from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

type TabType = 'all' | 'today' | 'upcoming' | 'completed';

export const TaskList: React.FC<TaskListProps> = ({ tasks, onToggle, onDelete }) => {
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [searchQuery, setSearchQuery] = useState('');

  const [todayStr] = useState(() => new Date().toISOString().split('T')[0]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search matching
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.original_transcript && task.original_transcript.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeTab === 'completed') {
        return task.status === 'completed';
      }

      if (activeTab === 'today') {
        return task.status === 'pending' && (!task.scheduled_date || task.scheduled_date <= todayStr);
      }

      if (activeTab === 'upcoming') {
        return task.status === 'pending' && task.scheduled_date && task.scheduled_date > todayStr;
      }

      return true; // 'all' tab
    });
  }, [tasks, activeTab, searchQuery, todayStr]);

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-20 space-y-4">
      {/* Progress & Overview Bar */}
      {totalCount > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Daily Progress</span>
            <span className="text-indigo-400 font-bold">{completedCount} of {totalCount} completed ({progressPercent}%)</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/80 border border-slate-800/80">
          {(['today', 'upcoming', 'all', 'completed'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Task List Items */}
      <div className="space-y-2.5 pt-1">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
          ))
        ) : (
          /* Empty State */
          <div className="p-8 text-center rounded-3xl bg-slate-900/40 border border-slate-800/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-slate-500">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-slate-300">No tasks here yet</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Tap the microphone above and say what you want to get done.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
