# 🚀 AWS Deployment Guide for VoiceTasks AI

This guide covers the smoothest and most cost-effective methods to deploy the full-stack VoiceTasks AI application on AWS.

---

## 🏛️ Recommended Architecture

| Component | AWS Service | Why |
|---|---|---|
| **Frontend (React PWA)** | **AWS Amplify Hosting** | Automated CI/CD from GitHub, zero server config, free automated SSL/HTTPS, global CDN, and automatic SPA rewrites using the included `amplify.yml`. |
| **Backend (FastAPI)** | **AWS App Runner** | Fully managed container/Python PaaS, automatically provisions HTTPS, auto-scales on traffic, zero server patching, natively runs Dockerfile or GitHub Python repo. |

*(Alternative options for S3 + CloudFront and single EC2 instance are also documented below.)*

---

## ⚡ Method 1: AWS Amplify + AWS App Runner (Recommended)

### Step 1: Deploy Backend on AWS App Runner

1. Log in to the [AWS Management Console](https://console.aws.amazon.com/) and navigate to **AWS App Runner**.
2. Click **Create an App Runner service**.
3. Under **Source**:
   * Choose **Source code repository**.
   * Connect your GitHub account and select this repository.
   * **Branch**: `main` (or your active branch).
   * **Deployment settings**: Choose **Automatic**.
4. Under **Build settings**:
   * Choose **Configure all settings here**:
     * **Runtime**: `Python 3`
     * **Build command**: `cd backend && pip install -r requirements.txt`
     * **Start command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000`
     * **Port**: `8000`
   * *(Alternatively, choose "Use a configuration file" and point to `backend/apprunner.yaml`)*.
5. Under **Service settings**:
   * **Service name**: `voicetasks-backend`
   * **Virtual CPU & Memory**: `1 vCPU, 2 GB` (or smallest available).
   * **Environment variables**:
     * `DEFAULT_TIMEZONE` = `Asia/Kolkata`
     * `DATABASE_PATH` = `tasks.db`
     * `GROQ_API_KEY` = *your_groq_api_key* (optional, for Whisper/Llama)
     * `OPENAI_API_KEY` = *your_openai_api_key* (optional)
     * `GEMINI_API_KEY` = *your_gemini_api_key* (optional)
     * `CORS_ORIGINS` = `["*"]` *(temporarily allow during setup; restrict to your Amplify URL in Step 3)*.
6. Click **Create & Deploy**.
7. Once deployed, copy your **Default domain** URL (e.g., `https://xxxxxxxxxx.us-east-1.awsapprunner.com`). Verify that `https://<YOUR_APP_RUNNER_URL>/health` returns `{"status":"ok"}`.

---

### Step 2: Deploy Frontend on AWS Amplify Hosting

1. In the AWS Management Console, navigate to **AWS Amplify**.
2. Click **Deploy an app** (or **Host web app**).
3. Select **GitHub** and authorize access.
4. Select your repository and `main` branch.
5. Amplify will automatically detect the root [amplify.yml](file:///C:/Sarab/clg%20training/react%20js%20learning/amplify.yml) file included in the project.
6. Under **Advanced settings > Environment variables**, add:
   * **Key**: `VITE_API_URL`
   * **Value**: Your App Runner URL from Step 1 (e.g., `https://xxxxxxxxxx.us-east-1.awsapprunner.com`, **without** trailing slash or `/api`).
7. Click **Save and deploy**.
8. In the Amplify console, navigate to **Rewrites and redirects** and verify that a 200 rewrite rule exists for SPA routing:
   * **Source address**: `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>`
   * **Target address**: `/index.html`
   * **Type**: `200 (Rewrite)`
9. Copy your live Amplify URL (e.g., `https://main.d123456abcdef.amplifyapp.com`).

---

### Step 3: Secure CORS on Backend

1. Return to **AWS App Runner** > your service > **Configuration** > **Configure service**.
2. Update the `CORS_ORIGINS` environment variable to include your Amplify URL:
   ```json
   ["https://main.d123456abcdef.amplifyapp.com", "http://localhost:5173"]
   ```
3. Click **Deploy changes**.

---

## 🪣 Method 2: Frontend on AWS S3 + CloudFront

If you prefer static S3 bucket hosting with CloudFront CDN:

1. **Build locally**:
   ```powershell
   cd frontend
   $env:VITE_API_URL="https://<YOUR_APP_RUNNER_URL>"
   npm run build
   ```
2. **Create an S3 Bucket**:
   * Create a bucket (e.g., `voicetasks-frontend-prod`).
   * Uncheck "Block all public access" if using website hosting, or keep private and use CloudFront Origin Access Control (OAC).
   * Upload all files from `frontend/dist/` into the root of this bucket.
3. **Create a CloudFront Distribution**:
   * Set Origin Domain to your S3 bucket.
   * Under **Viewer Protocol Policy**, select **Redirect HTTP to HTTPS**.
   * Under **Custom error response**:
     * HTTP error code: `404` -> Customize error response: `Yes` -> Response page path: `/index.html` -> HTTP Response code: `200`
     * HTTP error code: `403` -> Customize error response: `Yes` -> Response page path: `/index.html` -> HTTP Response code: `200`
4. Use the CloudFront distribution domain (`https://dxxxxxxxxxx.cloudfront.net`) and add it to the backend `CORS_ORIGINS`.

---

## 🐳 Method 3: Single AWS EC2 / Lightsail Instance (Docker Compose)

For running both frontend and backend on a single inexpensive VM ($3.50–$5/month):

1. Launch an **Ubuntu 22.04 / Amazon Linux 2023** EC2 or Lightsail instance.
2. In the Security Group / Firewall, open ports **80** (HTTP), **443** (HTTPS), and **22** (SSH).
3. Connect to the instance via SSH:
   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io docker-compose
   git clone <YOUR_REPO_URL>
   cd "react js learning"
   ```
4. Create a `.env` file in the root directory for your secrets:
   ```bash
   GROQ_API_KEY=your_key
   OPENAI_API_KEY=your_key
   ```
5. Build and launch the containers:
   ```bash
   docker compose up -d --build
   ```
6. Access your application via the EC2 instance's public IP or attached domain.
