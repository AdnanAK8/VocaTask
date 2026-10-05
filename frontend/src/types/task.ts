export type PriorityType = 'low' | 'medium' | 'high';
export type CategoryType = 'work' | 'study' | 'personal' | 'health' | 'finance' | 'general';
export type StatusType = 'pending' | 'completed';

export interface ExtractedTask {
  title: string;
  description?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  priority: PriorityType;
  category: CategoryType;
  reminder_required: boolean;
  original_transcript: string;
  language: string;
  confidence?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  priority: PriorityType;
  category: CategoryType;
  status: StatusType;
  reminder_required: boolean;
  original_transcript?: string | null;
  language?: string | null;
  created_at: string;
}

export interface TaskCreateInput {
  title: string;
  description?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  priority: PriorityType;
  category: CategoryType;
  reminder_required: boolean;
  original_transcript?: string | null;
  language?: string | null;
}
