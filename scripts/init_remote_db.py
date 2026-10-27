#!/usr/bin/env python3
"""
Database Initialization & Health-Check Tool for VocaTask Centralized PostgreSQL.
Connects to Amazon RDS (or any PostgreSQL instance), verifies SSL connectivity,
bootstraps all tables (tasks, users, otp_codes, frontfix_feedback), and tests read/write health.
"""

import os
import sys
import argparse
from pathlib import Path

# Add backend directory to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import psycopg
from psycopg.rows import dict_row


def parse_args():
    parser = argparse.ArgumentParser(description="Initialize and verify VocaTask remote PostgreSQL database.")
    parser.add_argument(
        "--db-url",
        type=str,
        default=os.environ.get("DATABASE_URL", ""),
        help="PostgreSQL connection string (e.g. host=localhost port=5432 dbname=vocatask)",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    db_url = args.db_url.strip()

    if not db_url:
        print("[!] Error: No database URL provided.")
        print("    Pass --db-url 'postgresql://...' or set DATABASE_URL environment variable.")
        sys.exit(1)

    # Mask password for display
    display_url = db_url
    if "@" in db_url and "://" in db_url:
        prefix, rest = db_url.split("://", 1)
        creds, host_part = rest.split("@", 1)
        user = creds.split(":", 1)[0]
        display_url = f"{prefix}://{user}:****@{host_part}"

    print("=" * 60)
    print("  VocaTask Centralized Database Initializer  ")
    print("=" * 60)
    print(f"Connecting to: {display_url} ...")

    try:
        # Default connection timeout to 5 seconds if not explicitly configured in URI
        timeout_kwargs = {}
        if "connect_timeout" not in db_url:
            timeout_kwargs["connect_timeout"] = 5

        with psycopg.connect(db_url, row_factory=dict_row, **timeout_kwargs) as conn:
            with conn.cursor() as cursor:
                # 1. Test basic query & version
                cursor.execute("SELECT version();")
                version = cursor.fetchone()
                print("[+] Connected successfully!")
                print(f"    PostgreSQL Version: {version['version'].split(',')[0]}")

                # 2. Check SSL
                ssl_active = False
                try:
                    cursor.execute("SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid();")
                    ssl_row = cursor.fetchone()
                    ssl_active = bool(ssl_row.get("ssl")) if ssl_row else False
                except Exception:
                    ssl_active = getattr(conn.info, "ssl_in_use", False)
                print(f"    SSL Encryption Active: {'Yes (Secure)' if ssl_active else 'No (Local/Plaintext)'}")

                # 3. Create tables
                print("\n[+] Initializing database tables...")

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
                    );
                """)
                print("    - Table 'tasks' ready")

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        email TEXT UNIQUE,
                        phone TEXT UNIQUE,
                        password_hash TEXT,
                        salt TEXT,
                        provider TEXT NOT NULL,
                        avatar_url TEXT,
                        created_at TEXT NOT NULL,
                        last_login_at TEXT NOT NULL
                    );
                """)
                print("    - Table 'users' ready")

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS otp_codes (
                        phone TEXT PRIMARY KEY,
                        code TEXT NOT NULL,
                        expires_at INTEGER NOT NULL,
                        created_at TEXT NOT NULL
                    );
                """)
                print("    - Table 'otp_codes' ready")

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS frontfix_feedback (
                        id SERIAL PRIMARY KEY,
                        issue_title TEXT,
                        is_helpful BOOLEAN,
                        query_text TEXT,
                        comment TEXT,
                        created_at TEXT NOT NULL
                    );
                """)
                print("    - Table 'frontfix_feedback' ready")

                conn.commit()

                # 4. Verification summary
                cursor.execute("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = current_schema()
                    ORDER BY table_name;
                """)
                tables = [row["table_name"] for row in cursor.fetchall()]
                print(f"\n[+] Active tables in database: {', '.join(tables)}")

                cursor.execute("SELECT COUNT(*) AS count FROM tasks;")
                task_count = cursor.fetchone()["count"]
                cursor.execute("SELECT COUNT(*) AS count FROM users;")
                user_count = cursor.fetchone()["count"]
                print(f"    Existing tasks: {task_count}")
                print(f"    Existing users: {user_count}")

            print("\n" + "=" * 60)
            print("  DATABASE BOOTSTRAP COMPLETE! READY FOR AWS DEPLOYMENT  ")
            print("=" * 60)

    except Exception as exc:
        print(f"\n[!] Connection failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
