import os
import sqlite3
from contextlib import contextmanager
from typing import Optional
from psycopg.conninfo import conninfo_to_dict

from app.core.config import settings
from app.core.database import close_db_pool

_sqlite_raw_conn: Optional[sqlite3.Connection] = None
_orig_core_db_conn = None
_orig_task_db_conn = None
_orig_auth_db_conn = None


class SQLiteTestCursor:
    def __init__(self, cursor):
        self._cursor = cursor
        self._last_was_info_schema = False

    def execute(self, sql: str, params=None):
        if "information_schema.columns" in sql:
            self._last_was_info_schema = True
            return self
        self._last_was_info_schema = False
        sql = sql.replace("%s", "?")
        if params is None:
            self._cursor.execute(sql)
        else:
            self._cursor.execute(sql, tuple(params))
        return self

    def fetchone(self):
        if self._last_was_info_schema:
            self._last_was_info_schema = False
            return {"exists": 1}
        row = self._cursor.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self):
        return [dict(r) for r in self._cursor.fetchall()]

    @property
    def rowcount(self):
        return self._cursor.rowcount

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class SQLiteTestConnection:
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        return SQLiteTestCursor(self._conn.cursor())

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, *args):
        if exc_type is None:
            self.commit()
        else:
            self.rollback()


@contextmanager
def sqlite_test_db_connection():
    global _sqlite_raw_conn
    if _sqlite_raw_conn is None:
        _sqlite_raw_conn = sqlite3.connect(":memory:", check_same_thread=False)
        _sqlite_raw_conn.row_factory = sqlite3.Row
    yield SQLiteTestConnection(_sqlite_raw_conn)


def setup_test_database():
    """
    Sets up either a PostgreSQL test database (if TEST_DATABASE_URL is set)
    or an in-memory SQLite database fallback for fast, zero-skip local testing.
    """
    global _orig_core_db_conn, _orig_task_db_conn, _orig_auth_db_conn
    test_database_url = os.getenv("TEST_DATABASE_URL")
    if test_database_url:
        if not conninfo_to_dict(test_database_url).get("dbname", "").endswith("_test"):
            raise RuntimeError("Refusing to run API tests unless the database name ends in _test.")
        settings.DATABASE_URL = test_database_url
        close_db_pool()
        from app.services import task_store, auth_store
        task_store.init_db()
        auth_store.init_auth_db()
        return "postgres"
    else:
        # Zero-skip SQLite test runner
        global _sqlite_raw_conn
        if _sqlite_raw_conn is not None:
            _sqlite_raw_conn.close()
        _sqlite_raw_conn = sqlite3.connect(":memory:", check_same_thread=False)
        _sqlite_raw_conn.row_factory = sqlite3.Row

        import app.core.database as core_db
        import app.services.task_store as task_st
        import app.services.auth_store as auth_st

        _orig_core_db_conn = core_db.get_db_connection
        _orig_task_db_conn = task_st.get_db_connection
        _orig_auth_db_conn = auth_st.get_db_connection

        core_db.get_db_connection = sqlite_test_db_connection
        task_st.get_db_connection = sqlite_test_db_connection
        auth_st.get_db_connection = sqlite_test_db_connection

        if not settings.JWT_SECRET_KEY:
            settings.JWT_SECRET_KEY = "test-secret-key-32-bytes-minimum-vocatask!"

        task_st.init_db()
        auth_st.init_auth_db()
        return "sqlite"


def teardown_test_database():
    """Restores the original get_db_connection implementations."""
    global _orig_core_db_conn, _orig_task_db_conn, _orig_auth_db_conn, _sqlite_raw_conn
    import app.core.database as core_db
    import app.services.task_store as task_st
    import app.services.auth_store as auth_st

    if _orig_core_db_conn is not None:
        core_db.get_db_connection = _orig_core_db_conn
    if _orig_task_db_conn is not None:
        task_st.get_db_connection = _orig_task_db_conn
    if _orig_auth_db_conn is not None:
        auth_st.get_db_connection = _orig_auth_db_conn

    if _sqlite_raw_conn is not None:
        _sqlite_raw_conn.close()
        _sqlite_raw_conn = None

    close_db_pool()
