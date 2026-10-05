import React from 'react';
import { Check, Trash2, Calendar, Clock } from 'lucide-react';
import type { Task } from '../types/task';

interface TaskCardProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onDelete }) => {
  const isCompleted = task.status === 'completed';

  const [dates] = React.useState(() => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    return { today, tomorrow };
  });

  const formatDateTime = () => {
    if (!task.scheduled_date && !task.scheduled_time) return null;
    
    let dateStr = task.scheduled_date || '';
    if (task.scheduled_date) {
      if (task.scheduled_date === dates.today) dateStr = 'Today';
      else if (task.scheduled_date === dates.tomorrow) dateStr = 'Tomorrow';
    }

    return (
      <div className="flex items-center gap-3 text-[11px] text-slate-400">
        {dateStr && (
          <span className="flex items-center gap-1 text-indigo-400 font-medium">
            <Calendar className="w-3 h-3" />
            <span>{dateStr}</span>
          </span>
        )}
        {task.scheduled_time && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{task.scheduled_time}</span>
          </span>
        )}
      </div>
    );
  };

  const getPriorityStyle = () => {
    switch (task.priority) {
      case 'high':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'low':
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

  const getCategoryColor = () => {
    switch (task.category) {
      case 'study':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'work':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'health':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'finance':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'personal':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-200 p-4 ${
        isCompleted
          ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:shadow-lg shadow-black/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Checkbox & Details */}
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <button
            onClick={() => onToggle(task.id)}
            aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
            className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
              isCompleted
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'border-slate-700 bg-slate-950 hover:border-indigo-500'
            }`}
          >
            {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </button>

          <div className="space-y-1.5 flex-1 min-w-0">
            <h4
              className={`text-sm font-semibold tracking-tight transition-colors truncate ${
                isCompleted ? 'line-through text-slate-500' : 'text-slate-100'
              }`}
            >
              {task.title}
            </h4>

            {formatDateTime()}

            {/* Badges: Category & Priority */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${getCategoryColor()}`}>
                {task.category}
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize ${getPriorityStyle()}`}>
                {task.priority}
              </span>
              {task.language && task.language !== 'auto' && (
                <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-slate-950 font-mono">
                  {task.language}
                </span>
              )}
            </div>

            {/* Original speech whisper quote */}
            {task.original_transcript && (
              <p className="text-[11px] text-slate-500 italic truncate pt-0.5">
                🎙️ "{task.original_transcript}"
              </p>
            )}
          </div>
        </div>

        {/* Right: Delete Action */}
        <button
          onClick={() => onDelete(task.id)}
          aria-label="Delete task"
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/80 transition-all flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
