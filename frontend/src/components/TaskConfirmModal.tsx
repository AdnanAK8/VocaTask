import React, { useState } from 'react';
import { 
  Check, X, Calendar, Clock, AlertTriangle, 
  Tag, MessageSquareQuote, Sparkles, Bell 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { ExtractedTask, TaskCreateInput, PriorityType, CategoryType } from '../types/task';

interface TaskConfirmModalProps {
  extractedTask: ExtractedTask;
  onConfirm: (task: TaskCreateInput) => void;
  onCancel: () => void;
}

export const TaskConfirmModal: React.FC<TaskConfirmModalProps> = ({
  extractedTask,
  onConfirm,
  onCancel,
}) => {
  const [title, setTitle] = useState(extractedTask.title);
  const [scheduledDate, setScheduledDate] = useState(extractedTask.scheduled_date || '');
  const [scheduledTime, setScheduledTime] = useState(extractedTask.scheduled_time || '');
  const [priority, setPriority] = useState<PriorityType>(extractedTask.priority);
  const [category, setCategory] = useState<CategoryType>(extractedTask.category);
  const [reminder, setReminder] = useState(extractedTask.reminder_required);

  const categories: { label: string; value: CategoryType; color: string }[] = [
    { label: 'Study 📚', value: 'study', color: 'border-blue-500/40 text-blue-400 bg-blue-500/10' },
    { label: 'Work 💼', value: 'work', color: 'border-purple-500/40 text-purple-400 bg-purple-500/10' },
    { label: 'Health 🏃', value: 'health', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
    { label: 'Finance 💰', value: 'finance', color: 'border-amber-500/40 text-amber-400 bg-amber-500/10' },
    { label: 'Personal 🤝', value: 'personal', color: 'border-rose-500/40 text-rose-400 bg-rose-500/10' },
    { label: 'General 📌', value: 'general', color: 'border-slate-500/40 text-slate-400 bg-slate-500/10' },
  ];

  const handleSave = () => {
    if (!title.trim()) return;

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.75 },
      });
    } catch {
      // Ignored if confetti fails
    }

    onConfirm({
      title: title.trim(),
      description: extractedTask.description,
      scheduled_date: scheduledDate || null,
      scheduled_time: scheduledTime || null,
      priority,
      category,
      reminder_required: reminder,
      original_transcript: extractedTask.original_transcript,
      language: extractedTask.language,
    });
  };

  const setRelativeDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setScheduledDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AI Understood This Task</h3>
              <p className="text-xs text-slate-400">Review or adjust before saving</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Original Speech Context */}
          {extractedTask.original_transcript && (
            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 flex items-start gap-2.5">
              <MessageSquareQuote className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="text-indigo-300 font-semibold">You said: </span>
                <span className="text-slate-200 italic">"{extractedTask.original_transcript}"</span>
                {extractedTask.language && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-500/20 text-[10px] text-indigo-300 uppercase font-mono">
                    {extractedTask.language}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Task Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Submit DBMS assignment"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Date Picker & Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Date</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRelativeDate(0)}
                className="px-3 py-1.5 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setRelativeDate(1)}
                className="px-3 py-1.5 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setRelativeDate(2)}
                className="px-3 py-1.5 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                In 2 Days
              </button>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Time Picker & Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Time</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '09:00 AM (Morning)', val: '09:00' },
                { label: '02:00 PM (Afternoon)', val: '14:00' },
                { label: '06:00 PM (Evening)', val: '18:00' },
                { label: '08:00 PM (Night)', val: '20:00' },
              ].map((t) => (
                <button
                  key={t.val}
                  type="button"
                  onClick={() => setScheduledTime(t.val)}
                  className={`px-3 py-1.5 rounded-xl text-xs transition-colors ${
                    scheduledTime === t.val
                      ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Priority Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Priority</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as PriorityType[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                    priority === p
                      ? p === 'high'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-md shadow-rose-500/20'
                        : p === 'medium'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/20'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Category Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-400" />
              <span>Category</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    category === c.value
                      ? `${c.color} ring-2 ring-indigo-500/30 font-semibold`
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reminder Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-medium text-slate-300">Push reminder alert</span>
            </div>
            <button
              type="button"
              onClick={() => setReminder(!reminder)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                reminder ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  reminder ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border border-slate-800 text-slate-300 hover:bg-slate-800/80 font-semibold text-xs transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      </div>
    </div>
  );
};
