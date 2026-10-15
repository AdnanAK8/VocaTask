import unittest
from unittest.mock import MagicMock, patch

from psycopg.conninfo import conninfo_to_dict
from psycopg_pool import PoolTimeout

from app.core import database
from app.core.config import Settings


class TestDatabaseConfiguration(unittest.TestCase):
    def test_builds_local_connection_from_environment_fields(self):
        config = Settings(
            DATABASE_URL="",
            PGHOST="localhost",
            PGPORT=5433,
            PGDATABASE="vocatask",
            PGUSER="vocatask_user",
            PGPASSWORD="not-a-real-secret",
        )

        options = conninfo_to_dict(config.database_connection_string)

        self.assertEqual(options["host"], "localhost")
        self.assertEqual(options["port"], "5433")
        self.assertEqual(options["dbname"], "vocatask")
        self.assertEqual(options["user"], "vocatask_user")
        self.assertEqual(options["password"], "not-a-real-secret")

    def test_database_url_takes_precedence(self):
        config = Settings(DATABASE_URL="postgresql://user:pass@db.internal:5432/vocatask")
        self.assertEqual(config.database_connection_string, "postgresql://user:pass@db.internal:5432/vocatask")

    def test_requires_password_when_url_is_missing(self):
        config = Settings(DATABASE_URL="", PGPASSWORD="")
        with self.assertRaisesRegex(ValueError, "Set DATABASE_URL or PGPASSWORD"):
            _ = config.database_connection_string


class TestDatabaseConnectionHandling(unittest.TestCase):
    def test_connection_context_passes_errors_to_pool_for_rollback(self):
        connection = MagicMock()
        pool_context = MagicMock()
        pool_context.__enter__.return_value = connection
        pool_context.__exit__.return_value = False
        pool = MagicMock()
        pool.connection.return_value = pool_context

        with patch.object(database, "get_connection_pool", return_value=pool):
            with self.assertRaises(RuntimeError):
                with database.get_db_connection():
                    raise RuntimeError("query failed")

        self.assertIs(pool_context.__exit__.call_args.args[0], RuntimeError)

    def test_pool_timeout_becomes_safe_unavailable_error(self):
        pool_context = MagicMock()
        pool_context.__enter__.side_effect = PoolTimeout("pool wait expired")
        pool = MagicMock()
        pool.connection.return_value = pool_context

        with patch.object(database, "get_connection_pool", return_value=pool):
            with self.assertRaisesRegex(database.DatabaseUnavailableError, "PostgreSQL is unavailable"):
                with database.get_db_connection():
                    pass


if __name__ == "__main__":
    unittest.main()