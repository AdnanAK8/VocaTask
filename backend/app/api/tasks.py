import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.schemas.task import Task, TaskCreate, TaskUpdate
from app.services import task_store

logger = logging.getLogger("tasks_api")
router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.get("", response_model=List[Task])
async def list_tasks(status: Optional[str] = Query(None, pattern="^(pending|completed)$")):
    """Get all tasks, optionally filtered by status."""
    return task_store.get_tasks(status=status)

@router.post("", response_model=Task, status_code=201)
async def create_task(task_in: TaskCreate):
    """Save a confirmed task."""
    try:
        return task_store.create_task(task_in)
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail="Failed to create task.")

@router.get("/{task_id}", response_model=Task)
async def get_single_task(task_id: str):
    """Retrieve details of a single task."""
    task = task_store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task

@router.patch("/{task_id}", response_model=Task)
async def update_task_details(task_id: str, updates: TaskUpdate):
    """Update task details."""
    task = task_store.update_task(task_id, updates)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task

@router.patch("/{task_id}/toggle", response_model=Task)
async def toggle_task_status(task_id: str):
    """Toggle task status between pending and completed."""
    task = task_store.toggle_task_status(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task

@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """Delete a task."""
    success = task_store.delete_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found.")
    return {"message": "Task successfully deleted", "id": task_id}
