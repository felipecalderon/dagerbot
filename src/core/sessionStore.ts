import { ChatMessage } from "./types";

export type SessionStore = {
  getHistory(sessionId: string): Promise<ChatMessage[]>;
  appendUser(sessionId: string, text: string): Promise<void>;
  appendAssistant(sessionId: string, text: string): Promise<void>;
  disconnect?(): Promise<void>;
};
