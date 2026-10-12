import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Header
from app.schemas.task import Task, TaskCreate, TaskUpdate
from app.services import task_store, auth_store

logger = logging.getLogger("tasks_api")
router = APIRouter(prefix="/tasks", tags=["Tasks"])

def extract_user_id(authorization: Optional[str] = None, x_user_id: Optional[str] = None) -> Optional[str]:
    """Helper to extract user_id from Authorization Bearer token or explicit X-User-Id header."""
    if x_user_id and x_user_id.strip():
        return x_user_id.strip()
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        payload = auth_store.decode_access_token(token)
        if payload and payload.get("sub"):
            return payload.get("sub")
    return None

@router.get("", response_model=List[Task])
async def list_tasks(
    status: Optional[str] = Query(None, pattern="^(pending|completed)$"),
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Get all tasks, optionally filtered by status and current user."""
    user_id = extract_user_id(authorization, x_user_id)
    return task_store.get_tasks(status=status, user_id=user_id)

@router.post("", response_model=Task, status_code=201)
async def create_task(
    task_in: TaskCreate,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Save a confirmed task."""
    try:
        user_id = extract_user_id(authorization, x_user_id) or task_in.user_id
        return task_store.create_task(task_in, user_id=user_id)
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail="Failed to create task.")

@router.get("/{task_id}", response_model=Task)
async def get_single_task(
    task_id: str,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Retrieve details of a single task."""
    user_id = extract_user_id(authorization, x_user_id)
    task = task_store.get_task(task_id, user_id=user_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task

@router.patch("/{task_id}", response_model=Task)
async def update_task_details(
    task_id: str,
    updates: TaskUpdate,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Update task details."""
    user_id = extract_user_id(authorization, x_user_id)
    task = task_store.update_task(task_id, updates, user_id=user_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task

@router.patch("/{task_id}/toggle", response_model=Task)
async def toggle_task_status(
    task_id: str,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Toggle task status between pending and completed."""
    user_id = extract_user_id(authorization, x_user_id)
    task = task_store.toggle_task_status(task_id, user_id=user_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task

@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Delete a task."""
    user_id = extract_user_id(authorization, x_user_id)
    success = task_store.delete_task(task_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found.")
    return {"message": "Task successfully deleted", "id": task_id}
