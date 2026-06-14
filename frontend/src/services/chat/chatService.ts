// Portfolio demo: conversations stored in localStorage, AI via Gemini Flash API route

const STORAGE_KEY = 'genomiq_demo_chat';

interface ChatMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  ai_provider?: string;
  tokens_used?: number;
  recommended_tools?: string;
}

interface ChatConversation {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  tool_context?: string;
}

interface ChatResponse {
  message: string;
  conversation_id: number;
  message_id: number;
  ai_provider: string;
  recommended_tools?: string;
}

interface DemoStore {
  conversations: ChatConversation[];
  messages: Record<number, ChatMessage[]>;
}

function loadStore(): DemoStore {
  if (typeof window === 'undefined') return { conversations: [], messages: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { conversations: [], messages: {} };
  } catch {
    return { conversations: [], messages: {} };
  }
}

function saveStore(store: DemoStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

let messageIdCounter = Date.now();
const nextId = () => ++messageIdCounter;

export const getChatConversations = async (toolContext?: string): Promise<ChatConversation[]> => {
  const store = loadStore();
  const convs = store.conversations.filter(c => c.is_active);
  return toolContext ? convs.filter(c => c.tool_context === toolContext) : convs;
};

export const getChatConversation = async (id: number): Promise<ChatConversation> => {
  const store = loadStore();
  const conv = store.conversations.find(c => c.id === id);
  if (!conv) throw new Error(`Conversation ${id} not found`);
  return conv;
};

export const getChatMessages = async (conversationId: number): Promise<ChatMessage[]> => {
  const store = loadStore();
  return store.messages[conversationId] || [];
};

export const checkPendingChatRequests = async (): Promise<ChatMessage | null> => {
  return null;
};

export const sendChatMessage = async (
  message: string,
  conversationId?: number,
  toolContext?: string
): Promise<ChatResponse> => {
  const store = loadStore();

  // Load existing history for this conversation to send to Gemini
  const history: ChatMessage[] = conversationId ? (store.messages[conversationId] || []) : [];

  // Call the Gemini API route
  const response = await fetch('/api/chat/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      tool_context: toolContext,
      history: history.slice(-20).map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || 'Error calling chat API');
  }

  const data: ChatResponse = await response.json();

  // Persist conversation and messages to localStorage
  const convId = data.conversation_id;
  const now = new Date().toISOString();

  if (!store.conversations.find(c => c.id === convId)) {
    const title = message.length > 40 ? message.substring(0, 40) + '...' : message;
    store.conversations.unshift({
      id: convId,
      user_id: 1,
      title,
      created_at: now,
      updated_at: now,
      is_active: true,
      tool_context: toolContext,
    });
  } else {
    const conv = store.conversations.find(c => c.id === convId);
    if (conv) conv.updated_at = now;
  }

  if (!store.messages[convId]) store.messages[convId] = [];

  store.messages[convId].push({
    id: nextId(),
    conversation_id: convId,
    role: 'user',
    content: message,
    created_at: now,
  });

  store.messages[convId].push({
    id: data.message_id,
    conversation_id: convId,
    role: 'assistant',
    content: data.message,
    created_at: now,
    ai_provider: data.ai_provider,
    recommended_tools: data.recommended_tools,
  });

  saveStore(store);

  return data;
};

export const updateConversationTitle = async (
  conversationId: number,
  title: string,
  toolContext?: string
): Promise<ChatConversation> => {
  const store = loadStore();
  const conv = store.conversations.find(c => c.id === conversationId);
  if (conv) {
    conv.title = title;
    conv.updated_at = new Date().toISOString();
    if (toolContext) conv.tool_context = toolContext;
    saveStore(store);
    return conv;
  }
  throw new Error(`Conversation ${conversationId} not found`);
};

export const deleteConversation = async (conversationId: number): Promise<void> => {
  const store = loadStore();
  const conv = store.conversations.find(c => c.id === conversationId);
  if (conv) conv.is_active = false;
  saveStore(store);
};

export const regenerateChatMessage = async (
  messageId: number,
  originalUserMessage: string
): Promise<ChatMessage> => {
  // Find which conversation this message belongs to
  const store = loadStore();
  let targetConvId: number | undefined;
  for (const [convId, messages] of Object.entries(store.messages)) {
    if (messages.find(m => m.id === messageId)) {
      targetConvId = Number(convId);
      break;
    }
  }

  const response = await sendChatMessage(originalUserMessage, targetConvId);
  return {
    id: response.message_id,
    conversation_id: response.conversation_id,
    role: 'assistant',
    content: response.message,
    created_at: new Date().toISOString(),
    ai_provider: response.ai_provider,
    recommended_tools: response.recommended_tools,
  };
};

export const checkMessageExists = async (_messageId: number): Promise<boolean> => true;

export const sendEphemeralChatMessage = async (
  message: string,
  toolContext?: string
): Promise<ChatResponse> => {
  const response = await fetch('/api/chat/ephemeral', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tool_context: toolContext }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err || 'Error calling ephemeral chat API');
  }

  return response.json();
};
