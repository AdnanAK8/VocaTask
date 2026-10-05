import os
import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services import task_store

TEST_DB_PATH = "test_tasks.db"

class TestTasksApi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.orig_db = settings.DATABASE_PATH
        settings.DATABASE_PATH = TEST_DB_PATH
        task_store.init_db()
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        settings.DATABASE_PATH = cls.orig_db
        if os.path.exists(TEST_DB_PATH):
            try:
                os.remove(TEST_DB_PATH)
            except Exception:
                pass

    def setUp(self):
        # Clear database before each test
        conn = task_store.get_db_connection()
        with conn:
            conn.execute("DELETE FROM tasks")
        conn.close()

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

if __name__ == "__main__":
    unittest.main()
