import unittest
import os
from psycopg.conninfo import conninfo_to_dict
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.database import close_db_pool, DatabaseUnavailableError
from app.schemas.task import Task
from app.services import task_store

class TestTasksApi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        test_database_url = os.getenv("TEST_DATABASE_URL")
        if not test_database_url:
            raise unittest.SkipTest("Set TEST_DATABASE_URL to a dedicated PostgreSQL database ending in _test.")
        if not conninfo_to_dict(test_database_url).get("dbname", "").endswith("_test"):
            raise RuntimeError("Refusing to run API tests unless the database name ends in _test.")
        settings.DATABASE_URL = test_database_url
        close_db_pool()
        task_store.init_db()
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        close_db_pool()

    def setUp(self):
        with task_store.get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM tasks")

    def test_create_task_full(self):
        payload = {
            "title": "Submit DBMS Assignment",
            "description": "Voice input: 'kal subah 10 baje dbms assignment'",
            "scheduled_date": "2026-10-06",
            "scheduled_time": "10:00",
            "priority": "high",
            "category": "study",
            "reminder_required": True,
            "original_transcript": "kal subah 10 baje dbms assignment submit karna hai",
            "language": "hinglish"
        }
        res = self.client.post("/api/tasks", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIn("id", data)
        self.assertEqual(data["title"], "Submit DBMS Assignment")
        self.assertEqual(data["category"], "study")
        self.assertEqual(data["priority"], "high")
        self.assertEqual(data["status"], "pending")
        self.assertEqual(data["scheduled_time"], "10:00")

    def test_create_task_minimal(self):
        payload = {"title": "Quick reminder"}
        res = self.client.post("/api/tasks", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["title"], "Quick reminder")
        self.assertEqual(data["priority"], "medium")
        self.assertEqual(data["category"], "general")
        self.assertEqual(data["status"], "pending")
        self.assertTrue(data["reminder_required"])

    def test_get_tasks_and_filter(self):
        # Insert 2 tasks
        t1 = self.client.post("/api/tasks", json={"title": "Task 1"}).json()
        t2 = self.client.post("/api/tasks", json={"title": "Task 2"}).json()

        # Toggle t2 to completed
        self.client.patch(f"/api/tasks/{t2['id']}/toggle")

        # List all
        res_all = self.client.get("/api/tasks")
        self.assertEqual(res_all.status_code, 200)
        self.assertEqual(len(res_all.json()), 2)

        # Filter pending
        res_pending = self.client.get("/api/tasks?status=pending")
        self.assertEqual(res_pending.status_code, 200)
        tasks_p = res_pending.json()
        self.assertEqual(len(tasks_p), 1)
        self.assertEqual(tasks_p[0]["id"], t1["id"])

        # Filter completed
        res_completed = self.client.get("/api/tasks?status=completed")
        self.assertEqual(res_completed.status_code, 200)
        tasks_c = res_completed.json()
        self.assertEqual(len(tasks_c), 1)
        self.assertEqual(tasks_c[0]["id"], t2["id"])

    def test_get_single_task(self):
        created = self.client.post("/api/tasks", json={"title": "Gym workout"}).json()
        task_id = created["id"]

        res = self.client.get(f"/api/tasks/{task_id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["title"], "Gym workout")

    def test_get_single_task_not_found(self):
        res = self.client.get("/api/tasks/non-existent-uuid")
        self.assertEqual(res.status_code, 404)

    def test_update_task(self):
        created = self.client.post("/api/tasks", json={"title": "Call Rahul"}).json()
        task_id = created["id"]

        update_payload = {
            "title": "Call Rahul Urgent",
            "priority": "high",
            "category": "personal"
        }
        res = self.client.patch(f"/api/tasks/{task_id}", json=update_payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["title"], "Call Rahul Urgent")
        self.assertEqual(data["priority"], "high")
        self.assertEqual(data["category"], "personal")

    def test_update_task_not_found(self):
        res = self.client.patch("/api/tasks/fake-id", json={"title": "New Title"})
        self.assertEqual(res.status_code, 404)

    def test_toggle_task_status(self):
        created = self.client.post("/api/tasks", json={"title": "Read chapter 4"}).json()
        task_id = created["id"]
        self.assertEqual(created["status"], "pending")

        # Toggle to completed
        res1 = self.client.patch(f"/api/tasks/{task_id}/toggle")
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.json()["status"], "completed")

        # Toggle back to pending
        res2 = self.client.patch(f"/api/tasks/{task_id}/toggle")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()["status"], "pending")

    def test_toggle_task_not_found(self):
        res = self.client.patch("/api/tasks/fake-id/toggle")
        self.assertEqual(res.status_code, 404)

    def test_delete_task(self):
        created = self.client.post("/api/tasks", json={"title": "Delete me"}).json()
        task_id = created["id"]

        res = self.client.delete(f"/api/tasks/{task_id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["id"], task_id)

        # Confirm deleted
        res_get = self.client.get(f"/api/tasks/{task_id}")
        self.assertEqual(res_get.status_code, 404)

    def test_delete_task_not_found(self):
        res = self.client.delete("/api/tasks/fake-id")
        self.assertEqual(res.status_code, 404)

    def test_invalid_status_filter_validation(self):
        res = self.client.get("/api/tasks?status=invalid_status")
        self.assertEqual(res.status_code, 422)


class TestTasksApiWithoutDatabase(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.task = Task(
            id="task-id",
            title="API task",
            status="pending",
            created_at="2026-10-15T10:00:00",
        )

    def test_list_response_uses_existing_task_shape(self):
        with unittest.mock.patch(
            "app.api.tasks.task_store.get_tasks",
            return_value=[self.task],
        ):
            response = self.client.get("/api/tasks")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["id"], "task-id")
        self.assertEqual(response.json()[0]["title"], "API task")
        self.assertIn("scheduled_date", response.json()[0])

    def test_create_keeps_201_and_task_response(self):
        with unittest.mock.patch(
            "app.api.tasks.task_store.create_task",
            return_value=self.task,
        ):
            response = self.client.post("/api/tasks", json={"title": "API task"})

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["id"], "task-id")
        self.assertEqual(response.json()["status"], "pending")

    def test_missing_task_keeps_404(self):
        with unittest.mock.patch(
            "app.api.tasks.task_store.get_task",
            return_value=None,
        ):
            response = self.client.get("/api/tasks/missing")

        self.assertEqual(response.status_code, 404)

    def test_database_outage_returns_sanitized_503(self):
        with unittest.mock.patch(
            "app.api.tasks.task_store.get_tasks",
            side_effect=DatabaseUnavailableError("connection details must not leak"),
        ):
            response = self.client.get("/api/tasks")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Database temporarily unavailable."})

if __name__ == "__main__":
    unittest.main()
