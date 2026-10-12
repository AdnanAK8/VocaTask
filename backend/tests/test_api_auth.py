import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.services import auth_store

class TestAuthAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_auth_config(self):
        resp = self.client.get("/api/auth/config")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("google_client_id", data)
        self.assertIn("facebook_app_id", data)
        self.assertTrue(data["is_development"])

    def test_email_register_and_login_flow(self):
        test_email = f"user_{id(self)}@example.com"
        # 1. Register
        reg_resp = self.client.post("/api/auth/register", json={
            "name": "Alex Tester",
            "email": test_email,
            "password": "SecretPassword123!"
        })
        self.assertEqual(reg_resp.status_code, 201)
        data = reg_resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["name"], "Alex Tester")
        self.assertEqual(data["user"]["email"], test_email)
        self.assertEqual(data["user"]["provider"], "email")
        token = data["token"]
        self.assertTrue(bool(token))

        # 2. Duplicate registration should fail
        dup_resp = self.client.post("/api/auth/register", json={
            "name": "Alex Tester",
            "email": test_email,
            "password": "AnotherPassword"
        })
        self.assertEqual(dup_resp.status_code, 400)

        # 3. Login with wrong password should fail
        bad_login = self.client.post("/api/auth/login", json={
            "email": test_email,
            "password": "WrongPassword"
        })
        self.assertEqual(bad_login.status_code, 401)

        # 4. Login with correct password
        login_resp = self.client.post("/api/auth/login", json={
            "email": test_email,
            "password": "SecretPassword123!"
        })
        self.assertEqual(login_resp.status_code, 200)
        login_data = login_resp.json()
        self.assertTrue(login_data["success"])
        self.assertEqual(login_data["user"]["email"], test_email)

        # 5. Get /me with token
        me_resp = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_resp.status_code, 200)
        self.assertEqual(me_resp.json()["name"], "Alex Tester")

    def test_phone_otp_flow(self):
        phone_num = f"+9198765{abs(hash(str(self))) % 90000 + 10000}"

        # 1. Send OTP
        send_resp = self.client.post("/api/auth/phone/send-otp", json={
            "phone": phone_num,
            "name": "Priya Sharma"
        })
        self.assertEqual(send_resp.status_code, 200)
        otp_data = send_resp.json()
        self.assertTrue(otp_data["success"])
        self.assertIsNotNone(otp_data.get("test_otp"))
        otp_code = otp_data["test_otp"]

        # 2. Verify with wrong OTP
        bad_verify = self.client.post("/api/auth/phone/verify", json={
            "phone": phone_num,
            "otp": "000000",
            "name": "Priya Sharma"
        })
        self.assertEqual(bad_verify.status_code, 400)

        # 3. Verify with correct OTP
        good_verify = self.client.post("/api/auth/phone/verify", json={
            "phone": phone_num,
            "otp": otp_code,
            "name": "Priya Sharma"
        })
        self.assertEqual(good_verify.status_code, 200)
        verify_data = good_verify.json()
        self.assertTrue(verify_data["success"])
        self.assertEqual(verify_data["user"]["phone"], phone_num)
        self.assertEqual(verify_data["user"]["name"], "Priya Sharma")
        self.assertEqual(verify_data["user"]["provider"], "phone")

    def test_google_social_auth(self):
        resp = self.client.post("/api/auth/google", json={
            "token": "simulated_google_oauth_token_123456",
            "name": "Google User Jane",
            "email": "jane.google@example.com",
            "avatar_url": "https://example.com/avatar.png"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["name"], "Google User Jane")
        self.assertEqual(data["user"]["email"], "jane.google@example.com")
        self.assertEqual(data["user"]["provider"], "google")

    def test_facebook_social_auth(self):
        resp = self.client.post("/api/auth/facebook", json={
            "token": "simulated_fb_oauth_token_123456",
            "name": "Facebook User John",
            "email": "john.fb@example.com",
            "avatar_url": "https://example.com/fb_avatar.png"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["name"], "Facebook User John")
        self.assertEqual(data["user"]["email"], "john.fb@example.com")
        self.assertEqual(data["user"]["provider"], "facebook")

if __name__ == "__main__":
    unittest.main()
