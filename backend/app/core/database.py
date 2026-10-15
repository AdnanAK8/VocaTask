import os
import time
import socket
import logging
import subprocess
from pathlib import Path
from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg_pool import ConnectionPool, PoolTimeout
from psycopg.rows import dict_row

from app.core.config import settings

logger = logging.getLogger("database")


class DatabaseUnavailableError(Exception):
    """Raised when the configured PostgreSQL database cannot be reached."""


_pool: ConnectionPool | None = None


def is_port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    """Checks if a TCP port is currently open and reachable."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, OSError):
        return False


def ensure_tunnel_if_needed() -> bool:
    """
    If running locally against localhost:5433 and port 5433 is closed,
    auto-starts the SSH tunnel in the background using the project EC2 key.
    """
    if settings.PGHOST not in ("localhost", "127.0.0.1") or int(settings.PGPORT) != 5433:
        return True

    if is_port_open("127.0.0.1", 5433):
        return True

    # Search for EC2 pem key
    possible_keys = [
        Path(__file__).parent.parent.parent / "my-ec2-VocaTask-key.pem",
        Path(__file__).parent.parent.parent.parent / "my-ec2-VocaTask-key.pem",
        Path.home() / "Downloads" / "my-ec2-VocaTask-key.pem",
    ]
    key_file = next((k for k in possible_keys if k.is_file()), None)
    if not key_file:
        logger.warning("Port 5433 is closed and my-ec2-VocaTask-key.pem was not found.")
        return False

    ec2_host = os.environ.get("EC2_HOST", "54.206.74.126")
    ec2_user = os.environ.get("EC2_USER", "ec2-user")
    logger.info("Local PostgreSQL port 5433 is closed. Auto-starting SSH tunnel to %s...", ec2_host)

    try:
        cmd = [
            "ssh",
            "-i", str(key_file),
            "-o", "StrictHostKeyChecking=no",
            "-o", "ServerAliveInterval=30",
            "-o", "ServerAliveCountMax=3",
            "-N",
            "-L", "5433:127.0.0.1:5432",
            f"{ec2_user}@{ec2_host}",
        ]
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)

        for _ in range(35):
            time.sleep(0.1)
            if is_port_open("127.0.0.1", 5433):
                logger.info("SSH tunnel successfully opened on port 5433.")
                return True
    except Exception as exc:
        logger.warning("Could not auto-launch SSH tunnel: %s", exc)

    return is_port_open("127.0.0.1", 5433)


def get_connection_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        ensure_tunnel_if_needed()
        _pool = ConnectionPool(
            conninfo=settings.database_connection_string,
            min_size=0,
            max_size=settings.DATABASE_POOL_MAX_SIZE,
            timeout=settings.DATABASE_POOL_TIMEOUT,
            kwargs={"connect_timeout": 5, "row_factory": dict_row},
            open=False,
        )
        _pool.open(wait=False)
    return _pool


@contextmanager
def get_db_connection() -> Iterator[psycopg.Connection]:
    global _pool
    try:
        with get_connection_pool().connection() as connection:
            yield connection
    except (PoolTimeout, psycopg.OperationalError) as exc:
        logger.warning("Database connection failed (%s). Resetting connection pool and verifying tunnel...", exc)
        close_db_pool()
        if ensure_tunnel_if_needed():
            try:
                with get_connection_pool().connection(timeout=4) as connection:
                    yield connection
                    return
            except Exception as retry_exc:
                logger.error("Retry connection failed: %s", retry_exc)
        raise DatabaseUnavailableError("PostgreSQL is unavailable.") from exc
    except ValueError as exc:
        raise DatabaseUnavailableError(f"PostgreSQL configuration error: {exc}") from exc


def close_db_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
