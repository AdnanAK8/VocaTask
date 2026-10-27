#!/usr/bin/env python3
"""Show the task count and newest task in the configured PostgreSQL database."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from psycopg import errors
from psycopg.conninfo import conninfo_to_dict

from app.core.config import settings
from app.core.database import DatabaseUnavailableError, get_db_connection


def main() -> None:
    try:
        connection_info = conninfo_to_dict(settings.database_connection_string)
    except ValueError as exc:
        raise SystemExit(f"Database configuration error: {exc}") from exc

    host = connection_info.get("host", "not configured")
    database_name = connection_info.get("dbname", "not configured")
    print(f"Database target: {host}/{database_name}")

    try:
        with get_db_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT COUNT(*) AS task_count,
                           (
                               SELECT title
                               FROM tasks
                               ORDER BY created_at DESC, id DESC
                               LIMIT 1
                           ) AS latest_title
                    FROM tasks
                    """
                )
                result = cursor.fetchone()
    except DatabaseUnavailableError as exc:
        raise SystemExit(f"Could not connect to PostgreSQL: {exc}") from exc
    except errors.UndefinedTable as exc:
        raise SystemExit(
            "The tasks table does not exist in this database. "
            "Initialize the database with scripts/init_remote_db.py first."
        ) from exc

    print(f"Task count: {result['task_count']}")
    print(f"Newest task: {result['latest_title'] or '(none)'}")


if __name__ == "__main__":
    main()
