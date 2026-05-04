from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=4000)
    conversation_id: str | None = None
    history: list[ChatMessage] = Field(default_factory=list)


class WidgetPayload(BaseModel):
    type: str
    params: dict


class ChatResponse(BaseModel):
    text: str
    widget: WidgetPayload | None = None
    conversation_id: str
    show_regulatory_footnote: bool = False
    trace: list[dict] = Field(default_factory=list)
    kb_citations: list[str] = Field(default_factory=list)
