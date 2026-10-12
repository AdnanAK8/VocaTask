import sqlite3
import uuid
from datetime import datetime
from typing import List, Optional
from app.core.config import settings
from app.schemas.task import Task, TaskCreate, TaskUpdate

def get_db_connection() -> sqlite3.Connection:
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
                created_at TEXT NOT NULL,
                user_id TEXT
            )
        """)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(tasks)")
        columns = [row[1] for row in cursor.fetchall()]
        if "user_id" not in columns:
            try:
                conn.execute("ALTER TABLE tasks ADD COLUMN user_id TEXT")
            except Exception:
                pass

        cursor.execute("SELECT COUNT(*) FROM tasks")
        count = cursor.fetchone()[0]
        if count == 0:
            today_str = datetime.now().strftime("%Y-%m-%d")
            now_iso = datetime.now().isoformat()
            sample_tasks = [
                (str(uuid.uuid4()), "Submit DBMS assignment", "Database assignment submission", today_str, "10:00", "medium", "study", "pending", 1, "Kal subah 10 baje database ka assignment submit karna hai", "hinglish", now_iso, None),
                (str(uuid.uuid4()), "Call Rahul at 6 PM", "Call Rahul about project updates", today_str, "18:00", "medium", "work", "pending", 1, "Call Rahul at 6 PM", "en", now_iso, None),
                (str(uuid.uuid4()), "Gym at 7 PM", "Evening workout session", today_str, "19:00", "low", "health", "pending", 1, "Gym at 7 PM", "en", now_iso, None),
            ]
            conn.executemany("""
                INSERT INTO tasks (
                    id, title, description, scheduled_date, scheduled_time,
                    priority, category, status, reminder_required,
                    original_transcript, language, created_at, user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, sample_tasks)
    conn.close()

# Initialize database schema on load
init_db()

def _row_to_task(row: sqlite3.Row) -> Task:
    cols = row.keys()
    user_id = row["user_id"] if "user_id" in cols else None
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
        user_id=user_id,
        created_at=row["created_at"]
    )

def create_task(data: TaskCreate, user_id: Optional[str] = None) -> Task:
    task_id = str(uuid.uuid4())
    now_iso = datetime.now().isoformat()
    effective_user_id = user_id or getattr(data, "user_id", None)

    conn = get_db_connection()
    with conn:
        conn.execute("""
            INSERT INTO tasks (
                id, title, description, scheduled_date, scheduled_time,
                priority, category, status, reminder_required,
                original_transcript, language, created_at, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
        """, (
            task_id, data.title, data.description, data.scheduled_date,
            data.scheduled_time, data.priority, data.category,
            1 if data.reminder_required else 0, data.original_transcript,
            data.language, now_iso, effective_user_id
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
        user_id=effective_user_id,
        created_at=now_iso
    )

def get_tasks(status: Optional[str] = None, user_id: Optional[str] = None) -> List[Task]:
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM tasks"
    conditions = []
    params = []

    if status:
        conditions.append("status = ?")
        params.append(status)

    if user_id:
        conditions.append("(user_id = ? OR user_id IS NULL)")
        params.append(user_id)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY status ASC, scheduled_date ASC, scheduled_time ASC"
    cursor.execute(query, params)

    rows = cursor.fetchall()
    conn.close()
    return [_row_to_task(row) for row in rows]

def get_task(task_id: str, user_id: Optional[str] = None) -> Optional[Task]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute("SELECT * FROM tasks WHERE id = ? AND (user_id = ? OR user_id IS NULL)", (task_id, user_id))
    else:
        cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cursor.fetchone()
    conn.close()
    return _row_to_task(row) if row else None

def update_task(task_id: str, update_data: TaskUpdate, user_id: Optional[str] = None) -> Optional[Task]:
    task = get_task(task_id, user_id=user_id)
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

    return get_task(task_id, user_id=user_id)

def delete_task(task_id: str, user_id: Optional[str] = None) -> bool:
    conn = get_db_connection()
    with conn:
        if user_id:
            cursor = conn.execute("DELETE FROM tasks WHERE id = ? AND (user_id = ? OR user_id IS NULL)", (task_id, user_id))
        else:
            cursor = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        deleted = cursor.rowcount > 0
    conn.close()
    return deleted

def toggle_task_status(task_id: str, user_id: Optional[str] = None) -> Optional[Task]:
    task = get_task(task_id, user_id=user_id)
    if not task:
        return None
    new_status = "completed" if task.status == "pending" else "pending"
    return update_task(task_id, TaskUpdate(status=new_status), user_id=user_id)
