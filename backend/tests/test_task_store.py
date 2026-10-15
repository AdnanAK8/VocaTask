import unittest
from contextlib import nullcontext
from unittest.mock import MagicMock, patch

from app.schemas.task import TaskCreate, TaskUpdate
from app.services import task_store


TASK_ROW = {
    "id": "task-id",
    "title": "Review migration",
    "description": None,
    "scheduled_date": "2026-10-15",
    "scheduled_time": "10:30",
    "priority": "high",
    "category": "work",
    "status": "pending",
    "reminder_required": 1,
    "original_transcript": "review migration",
    "language": "en",
    "created_at": "2026-10-15T10:00:00",
    "user_id": "user-id",
}


class TestTaskStore(unittest.TestCase):
    def setUp(self):
        self.connection = MagicMock()
        self.cursor = MagicMock()
        cursor_context = self.connection.cursor.return_value
        cursor_context.__enter__.return_value = self.cursor
        self.connection_context = nullcontext(self.connection)
        self.connection_patch = patch.object(
            task_store,
            "get_db_connection",
            return_value=self.connection_context,
        )
        self.connection_patch.start()
        self.addCleanup(self.connection_patch.stop)

    def test_init_db_inspects_schema_before_adding_user_id(self):
        self.cursor.fetchone.return_value = None

        task_store.init_db()

        sql_statements = [
            call.args[0]
            for call in self.cursor.execute.call_args_list
        ]
        inspect_index = next(
            index for index, sql in enumerate(sql_statements)
            if "information_schema.columns" in sql
        )
        alter_index = next(
            index for index, sql in enumerate(sql_statements)
            if "ALTER TABLE tasks ADD COLUMN user_id TEXT" in sql
        )
        self.assertLess(inspect_index, alter_index)

    def test_init_db_preserves_existing_user_id_column(self):
        self.cursor.fetchone.return_value = {"?column?": 1}

        task_store.init_db()

        sql_statements = [
            call.args[0]
            for call in self.cursor.execute.call_args_list
        ]
        self.assertFalse(
            any("ALTER TABLE tasks" in sql for sql in sql_statements)
        )

    def test_create_task_uses_parameterized_postgres_insert(self):
        data = TaskCreate(
            title="Review migration",
            scheduled_date="2026-10-15",
            scheduled_time="10:30",
            priority="high",
            category="work",
            reminder_required=False,
            original_transcript="review migration",
            language="en",
        )
        task = task_store.create_task(data, user_id="user-id")

        self.assertEqual(task.title, "Review migration")
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("VALUES (", sql)
        self.assertIn("%s", sql)
        self.assertNotIn("?", sql)
        self.assertIn("user-id", params)
        self.assertIn("2026-10-15", params)
        self.assertIn("10:30", params)
        self.assertIn("review migration", params)
        self.assertIn("en", params)
        self.assertIn(0, params)

    def test_list_tasks_maps_rows_and_filters(self):
        self.cursor.fetchall.return_value = [TASK_ROW]

        tasks = task_store.get_tasks(status="pending", user_id="user-id")

        self.assertEqual(tasks[0].id, "task-id")
        sql, params = self.cursor.execute.call_args.args
        self.assertIn("status = %s", sql)
        self.assertIn("user_id = %s", sql)
        self.assertEqual(params, ["pending", "user-id"])

    def test_get_task_by_id(self):
        self.cursor.fetchone.return_value = TASK_ROW

        task = task_store.get_task("task-id")

        self.assertEqual(task.id, "task-id")
        self.cursor.execute.assert_called_once_with(
            "SELECT * FROM tasks WHERE id = %s",
            ["task-id"],
        )

    def test_get_missing_task_returns_none(self):
        self.cursor.fetchone.return_value = None
        self.assertIsNone(task_store.get_task("missing"))

    def test_update_task_details(self):
        updated_row = {**TASK_ROW, "title": "Updated"}
        self.cursor.fetchone.side_effect = [TASK_ROW, updated_row]

        updated = task_store.update_task(
            "task-id",
            TaskUpdate(title="Updated"),
        )

        self.assertEqual(updated.title, "Updated")
        update_sql = next(
            call.args[0]
            for call in self.cursor.execute.call_args_list
            if call.args[0].startswith("UPDATE tasks")
        )
        self.assertEqual(
            update_sql,
            "UPDATE tasks SET title = %s WHERE id = %s",
        )

    def test_delete_task(self):
        self.cursor.rowcount = 1

        self.assertTrue(task_store.delete_task("task-id"))
        self.cursor.execute.assert_called_once_with(
            "DELETE FROM tasks WHERE id = %s",
            ("task-id",),
        )

    def test_delete_missing_task_returns_false(self):
        self.cursor.rowcount = 0
        self.assertFalse(task_store.delete_task("missing"))

    def test_toggle_task_status(self):
        completed_row = {**TASK_ROW, "status": "completed"}
        self.cursor.fetchone.side_effect = [TASK_ROW, TASK_ROW, completed_row]

        updated = task_store.toggle_task_status("task-id")

        self.assertEqual(updated.status, "completed")


if __name__ == "__main__":
    unittest.main()
