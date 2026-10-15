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
       * `DATABASE_URL` = secret PostgreSQL URL for the EC2 database, or configure `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` separately
       * `DATABASE_POOL_MAX_SIZE` = `5` (review against App Runner instance count and PostgreSQL connection capacity)
      * `JWT_SECRET_KEY` = a long random secret stored in AWS Secrets Manager
     * `GROQ_API_KEY` = *your_groq_api_key* (optional, for Whisper/Llama)
     * `OPENAI_API_KEY` = *your_openai_api_key* (optional)
     * `GEMINI_API_KEY` = *your_gemini_api_key* (optional)
   * `CORS_ORIGINS` = `["https://main.d123456abcdef.amplifyapp.com"]` (use the exact frontend origin; do not use `*`).
   * `API_RATE_LIMIT_PER_MINUTE` = `120`
   * `VOICE_RATE_LIMIT_PER_MINUTE` = `20`
   * `AUDIO_RATE_LIMIT_PER_MINUTE` = `5`
6. Click **Create & Deploy**.
7. Once deployed, copy your **Default domain** URL (e.g., `https://xxxxxxxxxx.us-east-1.awsapprunner.com`). Verify that `https://<YOUR_APP_RUNNER_URL>/health` returns `{"status":"ok"}`.

### Connect App Runner to PostgreSQL on EC2

The local `localhost:5433` SSH tunnel is for developer machines only. App Runner must use private VPC egress to the EC2 instance:

1. Place the App Runner VPC connector subnets and the database EC2 instance in the same VPC, or configure private routing between their VPCs.
2. Attach the VPC connector to the App Runner service. Ensure its subnets have routes to the EC2 private address.
3. Configure the database security group to allow inbound TCP `5432` only from the VPC connector's security group. Do not allow `0.0.0.0/0` or a public internet source.
4. Configure PostgreSQL to listen on the EC2 private interface and allow the backend source in `pg_hba.conf`; retain SSH access only from trusted developer IPs for local tunneling.
5. Store `DATABASE_URL` (or the `PGPASSWORD` value) in AWS Secrets Manager and reference it as an App Runner secret. Use the EC2 private DNS name/address for `PGHOST`, port `5432`, database `vocatask`, and user `vocatask_user`. Never use `localhost:5433` in AWS.
6. Deploy the backend and verify task reads/writes and `/health` from the deployed service. App Runner can reach this database only after the VPC connector, routes, PostgreSQL listener/host rules, and security groups are correct.

The application reuses a bounded psycopg connection pool within each backend process. Keep `DATABASE_POOL_MAX_SIZE` low enough that the maximum across all App Runner instances fits PostgreSQL's connection limit. The application creates missing `tasks`, `users`, and `otp_codes` tables without dropping or truncating existing data, and adds `tasks.user_id` only if absent. Before the first deployment, inspect the existing database read-only:

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = current_schema()
   AND table_name IN ('tasks', 'users', 'otp_codes')
ORDER BY table_name, ordinal_position;
```

### Lambda Alternative

If the backend runs on Lambda behind API Gateway, attach the Lambda to private subnets in the database VPC (or a routed peered VPC), use a Lambda security group allowed by the EC2 database security group on TCP `5432`, and load the connection secret from Secrets Manager. The Lambda execution role also needs permission to read that secret. Set a small `DATABASE_POOL_MAX_SIZE` (for example, `2`) because each warm Lambda execution environment owns its own pool; account for concurrency against the EC2 PostgreSQL connection limit. For higher concurrency, consider PgBouncer in the private VPC and cap Lambda concurrency. Do not expose PostgreSQL publicly to make Lambda connectivity work.

For an application container running on the same EC2 instance, use the database's local/private address and port `5432`; `localhost` inside a container is the container itself unless host networking is explicitly configured.

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

### Step 4: Verify API Gateway Routing and Throttling

If the frontend's API URL is an `execute-api` domain, it is using API Gateway rather than the App Runner URL. In API Gateway, verify the deployed stage has a Lambda proxy integration for both `ANY /{proxy+}` and the root route, and that the stage is deployed (or auto-deploy is enabled). The FastAPI route in this repository is `/api/voice/process-audio`; a 404 from the gateway before the request reaches FastAPI means the route/integration or stage is not deployed. Re-deploy the Lambda after code changes.

Configure API Gateway stage throttling as the outer rate limit. The backend also applies per-instance IP limits (`120` general API requests/minute, `20` voice requests/minute, `5` audio requests/minute); gateway throttling is necessary for a shared limit across Lambda/App Runner instances. CORS on API Gateway, if enabled there, must allow the exact Amplify/CloudFront origin, `GET, POST, PATCH, DELETE, OPTIONS`, and the headers used by the app (`content-type`, `x-user-timezone`, and any configured `x-*-key` headers).

After deployment, confirm these checks from the browser Network tab:

* `GET https://<BACKEND>/health` returns JSON with status `ok`.
* `GET https://<BACKEND>/api/voice/status` returns JSON.
* `POST https://<BACKEND>/api/voice/process-text` returns structured task JSON, not a CloudFront/API Gateway error page.
* `POST https://<BACKEND>/api/voice/process-audio` returns structured task JSON; a `429` response indicates throttling is active.

The API is still publicly reachable: rate limits and CORS reduce abuse and browser cross-origin access, but neither authenticates users or protects task data. Add user authentication and per-user task ownership before storing private or multi-user data.

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
