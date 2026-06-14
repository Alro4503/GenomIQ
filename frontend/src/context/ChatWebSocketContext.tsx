'use client';

import React, { createContext, useContext, ReactNode } from 'react';

// Portfolio demo: WebSocket disabled, ChatContext uses HTTP fallback via sendChatMessage
interface ChatWebSocketContextType {
  connected: boolean;
  connecting: boolean;
  streamingMessage: string;
  isStreaming: boolean;
  streamingTools: string[];
  streamingConversationId: number | null;
  sendStreamMessage: (message: string, conversationId?: number, toolContext?: string) => Promise<void>;
  reconnect: () => void;
}

const ChatWebSocketContext = createContext<ChatWebSocketContextType>({
  connected: false,
  connecting: false,
  streamingMessage: '',
  isStreaming: false,
  streamingTools: [],
  streamingConversationId: null,
  sendStreamMessage: async () => { throw new Error('WebSocket not available in demo mode'); },
  reconnect: () => {},
});

export const useChatWebSocket = () => useContext(ChatWebSocketContext);

interface ChatWebSocketProviderProps {
  children: ReactNode;
  onStreamStart?: (conversationId: number) => void;
  onStreamChunk?: (chunk: string) => void;
  onStreamComplete?: (content: string, conversationId: number, messageId: number, tools: string[]) => void;
  onStreamError?: (error: string) => void;
}

export const ChatWebSocketProvider: React.FC<ChatWebSocketProviderProps> = ({ children }) => {
  return (
    <ChatWebSocketContext.Provider value={{
      connected: false,
      connecting: false,
      streamingMessage: '',
      isStreaming: false,
      streamingTools: [],
      streamingConversationId: null,
      sendStreamMessage: async () => { throw new Error('WebSocket not available in demo mode'); },
      reconnect: () => {},
    }}>
      {children}
    </ChatWebSocketContext.Provider>
  );
};

export default ChatWebSocketContext;
