from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


# AIProvider Schemas
class AIProviderBase(BaseModel):
    name: str
    description: Optional[str] = None
    model_name: str
    is_active: bool = True
    priority: int = 0


class AIProviderCreate(AIProviderBase):
    api_key: str
    base_url: Optional[str] = None
    daily_limit: int = 10000


class AIProviderUpdate(BaseModel):
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    description: Optional[str] = None
    model_name: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None
    daily_limit: Optional[int] = None


class AIProviderResponse(AIProviderBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ChatMessage Schemas
class ChatMessageBase(BaseModel):
    role: str  # 'user' o 'assistant'
    content: str


class ChatMessageCreate(ChatMessageBase):
    conversation_id: int


class ChatMessageResponse(ChatMessageBase):
    id: int
    conversation_id: int
    created_at: datetime
    ai_provider: Optional[str] = None
    tokens_used: Optional[int] = None
    recommended_tools: Optional[str] = None

    class Config:
        from_attributes = True


# ChatConversation Schemas
class ChatConversationBase(BaseModel):
    title: str = "Nueva conversación"
    tool_context: Optional[str] = None


class ChatConversationCreate(ChatConversationBase):
    pass


class ChatConversationUpdate(BaseModel):
    title: Optional[str] = None
    is_active: Optional[bool] = None
    tool_context: Optional[str] = None


class ChatConversationResponse(ChatConversationBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class ChatConversationDetail(ChatConversationResponse):
    messages: List[ChatMessageResponse] = []

    class Config:
        from_attributes = True


# Chat Request/Response Schemas
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    tool_context: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    conversation_id: int
    message_id: int
    ai_provider: str
    recommended_tools: Optional[str] = None