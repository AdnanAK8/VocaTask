import uuid
from datetime import datetime
from typing import List, Optional
from app.core.database import get_db_connection
from app.schemas.task import Task, TaskCreate, TaskUpdate


def init_db() -> None:
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
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
            cursor.execute("""
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'tasks'
                  AND column_name = 'user_id'
            """)
            if cursor.fetchone() is None:
                cursor.execute("ALTER TABLE tasks ADD COLUMN user_id TEXT")


def _row_to_task(row: dict) -> Task:
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
        user_id=row.get("user_id"),
        created_at=row["created_at"]
    )


def create_task(data: TaskCreate, user_id: Optional[str] = None) -> Task:
    task_id = str(uuid.uuid4())
    now_iso = datetime.now().isoformat()
    effective_user_id = user_id or getattr(data, "user_id", None)

    params = (
        task_id,
        data.title,
        data.description,
        data.scheduled_date,
        data.scheduled_time,
        data.priority,
        data.category,
        1 if data.reminder_required else 0,
        data.original_transcript,
        data.language,
        now_iso,
        effective_user_id,
    )
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tasks (
                    id, title, description, scheduled_date, scheduled_time,
                    priority, category, status, reminder_required,
                    original_transcript, language, created_at, user_id
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s, %s, %s
                )
                """,
                params,
            )
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


def get_tasks(
    status: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[Task]:
    query = "SELECT * FROM tasks"
    conditions = []
    params = []
    if status:
        conditions.append("status = %s")
        params.append(status)
    if user_id:
        conditions.append("(user_id = %s OR user_id IS NULL)")
        params.append(user_id)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY status ASC, scheduled_date ASC, scheduled_time ASC"
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            rows = cursor.fetchall()
    return [_row_to_task(row) for row in rows]


def get_task(
    task_id: str,
    user_id: Optional[str] = None,
) -> Optional[Task]:
    query = "SELECT * FROM tasks WHERE id = %s"
    params = [task_id]
    if user_id:
        query += " AND (user_id = %s OR user_id IS NULL)"
        params.append(user_id)
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            row = cursor.fetchone()
    return _row_to_task(row) if row else None


def update_task(
    task_id: str,
    update_data: TaskUpdate,
    user_id: Optional[str] = None,
) -> Optional[Task]:
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
        updates["reminder_required"] = (
            1 if update_data.reminder_required else 0
        )

    if updates:
        set_clauses = [f"{key} = %s" for key in updates]
        values = list(updates.values()) + [task_id]
        sql = f"UPDATE tasks SET {', '.join(set_clauses)} WHERE id = %s"
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, values)

    return get_task(task_id, user_id=user_id)


def delete_task(task_id: str, user_id: Optional[str] = None) -> bool:
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            if user_id:
                cursor.execute(
                    "DELETE FROM tasks WHERE id = %s AND "
                    "(user_id = %s OR user_id IS NULL)",
                    (task_id, user_id),
                )
            else:
                cursor.execute("DELETE FROM tasks WHERE id = %s", (task_id,))
            deleted = cursor.rowcount > 0
    return deleted


def toggle_task_status(
    task_id: str,
    user_id: Optional[str] = None,
) -> Optional[Task]:
    task = get_task(task_id, user_id=user_id)
    if not task:
        return None
    new_status = "completed" if task.status == "pending" else "pending"
    return update_task(task_id, TaskUpdate(status=new_status), user_id=user_id)
