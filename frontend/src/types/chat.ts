export type ChatRole = 'user' | 'bot';

export interface ChatHistoryItem {
  role: ChatRole;
  text: string;
}

export interface ChatMessage extends ChatHistoryItem {
  files?: File[];
}