from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field

PriorityType = Literal["low", "medium", "high"]
CategoryType = Literal["work", "study", "personal", "health", "finance", "general"]
StatusType = Literal["pending", "completed"]

class ExtractedTask(BaseModel):
    title: str = Field(description="Actionable title of the extracted task")
    description: Optional[str] = Field(default=None, description="Additional context or notes")
    scheduled_date: Optional[str] = Field(default=None, description="Resolved date in YYYY-MM-DD format")
    scheduled_time: Optional[str] = Field(default=None, description="Resolved time in HH:MM (24-hour) format")
    priority: PriorityType = Field(default="medium", description="Priority level: low, medium, or high")
    category: CategoryType = Field(default="general", description="Category: work, study, personal, health, finance, general")
    reminder_required: bool = Field(default=True, description="Whether to schedule a reminder notification")
    original_transcript: str = Field(default="", description="The original transcribed speech input")
    language: str = Field(default="auto", description="Detected language code (e.g., en, hi, pa, hinglish)")
    confidence: float = Field(default=1.0, description="Confidence score 0.0 to 1.0")

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    priority: PriorityType = "medium"
    category: CategoryType = "general"
    reminder_required: bool = True
    original_transcript: Optional[str] = None
    language: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    priority: Optional[PriorityType] = None
    category: Optional[CategoryType] = None
    status: Optional[StatusType] = None
    reminder_required: Optional[bool] = None

class Task(TaskCreate):
    id: str
    status: StatusType = "pending"
    created_at: str

class TextProcessRequest(BaseModel):
    text: str = Field(..., description="Raw text of task in any language (Hindi, Punjabi, English, Hinglish, etc.)")
    user_timezone: Optional[str] = Field(default="Asia/Kolkata", description="User's IANA timezone")
