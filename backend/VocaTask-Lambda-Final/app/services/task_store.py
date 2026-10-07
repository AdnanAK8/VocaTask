import sqlite3
import uuid
from datetime import datetime
from typing import List, Optional
from app.core.config import settings
from app.schemas.task import Task, TaskCreate, TaskUpdate

def get_db_connection():
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                scheduled_date TEXT,
                scheduled_time TEXT,
                priority TEXT DEFAULT 'medium',
                category TEXT DEFAULT 'general',
                status TEXT DEFAULT 'pending',
                reminder_required INTEGER DEFAULT 1,
                original_transcript TEXT,
                language TEXT,
                created_at TEXT NOT NULL
            )
        """)
    conn.close()

# Initialize database schema on load
init_db()

def create_task(data: TaskCreate) -> Task:
    task_id = str(uuid.uuid4())
    now_iso = datetime.now().isoformat()
    
    conn = get_db_connection()
    with conn:
        conn.execute("""
            INSERT INTO tasks (
                id, title, description, scheduled_date, scheduled_time,
                priority, category, status, reminder_required,
                original_transcript, language, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
        """, (
            task_id, data.title, data.description, data.scheduled_date,
            data.scheduled_time, data.priority, data.category,
            1 if data.reminder_required else 0, data.original_transcript,
            data.language, now_iso
        ))
    conn.close()
    
    return Task(
        id=task_id,
        title=data.title,
        description=data.description,
        scheduled_date=data.scheduled_date,
        scheduled_time=data.scheduled_time,
        priority=data.priority,
        category=data.category,
        status="pending",
        reminder_required=data.reminder_required,
        original_transcript=data.original_transcript,
        language=data.language,
        created_at=now_iso
    )

def get_tasks(status: Optional[str] = None) -> List[Task]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if status:
        cursor.execute("SELECT * FROM tasks WHERE status = ? ORDER BY scheduled_date ASC, scheduled_time ASC", (status,))
    else:
        cursor.execute("SELECT * FROM tasks ORDER BY status ASC, scheduled_date ASC, scheduled_time ASC")
    
    rows = cursor.fetchall()
    conn.close()
    
    tasks = []
    for row in rows:
        tasks.append(Task(
            id=row["id"],
            title=row["title"],
            description=row["description"],
            scheduled_date=row["scheduled_date"],
            scheduled_time=row["scheduled_time"],
            priority=row["priority"],
            category=row["category"],
            status=row["status"],
            reminder_required=bool(row["reminder_required"]),
            original_transcript=row["original_transcript"],
            language=row["language"],
            created_at=row["created_at"]
        ))
    return tasks

def get_task(task_id: str) -> Optional[Task]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
    return Task(
        id=row["id"],
        title=row["title"],
        description=row["description"],
        scheduled_date=row["scheduled_date"],
        scheduled_time=row["scheduled_time"],
        priority=row["priority"],
        category=row["category"],
        status=row["status"],
        reminder_required=bool(row["reminder_required"]),
        original_transcript=row["original_transcript"],
        language=row["language"],
        created_at=row["created_at"]
    )

def update_task(task_id: str, update_data: TaskUpdate) -> Optional[Task]:
    task = get_task(task_id)
    if not task:
        return None
        
    updates = {}
    if update_data.title is not None:
        updates["title"] = update_data.title
    if update_data.description is not None:
        updates["description"] = update_data.description
    if update_data.scheduled_date is not None:
        updates["scheduled_date"] = update_data.scheduled_date
    if update_data.scheduled_time is not None:
        updates["scheduled_time"] = update_data.scheduled_time
    if update_data.priority is not None:
        updates["priority"] = update_data.priority
    if update_data.category is not None:
        updates["category"] = update_data.category
    if update_data.status is not None:
        updates["status"] = update_data.status
    if update_data.reminder_required is not None:
        updates["reminder_required"] = 1 if update_data.reminder_required else 0
        
    if updates:
        set_clauses = [f"{k} = ?" for k in updates.keys()]
        values = list(updates.values()) + [task_id]
        sql = f"UPDATE tasks SET {', '.join(set_clauses)} WHERE id = ?"
        conn = get_db_connection()
        with conn:
            conn.execute(sql, values)
        conn.close()
        
    return get_task(task_id)

def delete_task(task_id: str) -> bool:
    conn = get_db_connection()
    with conn:
        cursor = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        deleted = cursor.rowcount > 0
    conn.close()
    return deleted

def toggle_task_status(task_id: str) -> Optional[Task]:
    task = get_task(task_id)
    if not task:
        return None
    new_status = "completed" if task.status == "pending" else "pending"
    return update_task(task_id, TaskUpdate(status=new_status))
