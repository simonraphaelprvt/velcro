// Shared types across VELCRO

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface VaultChunk {
  id: string;
  file_path: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  last_synced: string;
}

export interface VaultSearchResult {
  file_path: string;
  content: string;
  similarity: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export interface MailSummary {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  unread: boolean;
}
