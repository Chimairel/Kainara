import React, { createContext, useContext, useState } from 'react';
import type { ChatInput, Reply } from './contracts';
type Entry = { id: string; role: 'user' | 'assistant'; text: string; reply?: Reply };
type State = {
  entries: Entry[];
  draft: string;
  ai: boolean;
  pending: ChatInput | null;
  draftEntryId: string | null;
  recoveryKey: string | null;
};
export const emptyChat: State = {
  entries: [],
  draft: '',
  ai: false,
  pending: null,
  draftEntryId: null,
  recoveryKey: null,
};
const ChatContext = createContext<{ state: State; setState: React.Dispatch<React.SetStateAction<State>> } | null>(null);
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(emptyChat);
  return <ChatContext.Provider value={{ state, setState }}>{children}</ChatContext.Provider>;
}
export function useChatState() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('ChatProvider is required.');
  return context;
}
