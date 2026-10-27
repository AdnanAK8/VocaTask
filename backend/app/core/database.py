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
_last_unreachable_time: float = 0.0
_UNREACHABLE_CACHE_TTL: float = 20.0  # seconds to cache failed EC2 tunnel checks


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
    Fails fast if the remote host or port 22 is unreachable.
    """
    global _last_unreachable_time

    if settings.PGHOST not in ("localhost", "127.0.0.1") or int(settings.PGPORT) != 5433:
        return True

    if is_port_open("127.0.0.1", 5433, timeout=0.1):
        _last_unreachable_time = 0.0
        return True

    now = time.time()
    if (now - _last_unreachable_time) < _UNREACHABLE_CACHE_TTL:
        return False

    # SSH tunnel auto-launch is strictly opt-in to avoid unwanted subprocesses
    tunnel_opt_in = os.getenv("ENABLE_SSH_TUNNEL", "").lower() in ("true", "1") or os.getenv("AUTO_SSH_TUNNEL", "").lower() in ("true", "1")
    if not tunnel_opt_in:
        return False

    ec2_host = os.environ.get("EC2_HOST")
    if not ec2_host:
        logger.debug("Port 5433 is closed and EC2_HOST is not set; skipping SSH tunnel.")
        return False

    # Search for EC2 pem key
    possible_keys = [
        Path(__file__).parent.parent.parent / "my-ec2-VocaTask-key.pem",
        Path(__file__).parent.parent.parent.parent / "my-ec2-VocaTask-key.pem",
        Path.home() / "Downloads" / "my-ec2-VocaTask-key.pem",
    ]
    key_file = next((k for k in possible_keys if k.is_file()), None)
    if not key_file:
        logger.warning("Port 5433 is closed and my-ec2-VocaTask-key.pem was not found.")
        _last_unreachable_time = now
        return False

    ec2_user = os.environ.get("EC2_USER", "ec2-user")

    # Fast probe: check if EC2 host has port 22 open before trying to spawn ssh
    if not is_port_open(ec2_host, 22, timeout=0.5):
        logger.warning("Remote EC2 host %s:22 is unreachable. Skipping SSH tunnel attempt.", ec2_host)
        _last_unreachable_time = now
        return False

    logger.info("Local PostgreSQL port 5433 is closed. Auto-starting SSH tunnel to %s...", ec2_host)

    try:
        cmd = [
            "ssh",
            "-i", str(key_file),
            "-o", "StrictHostKeyChecking=no",
            "-o", "ConnectTimeout=2",
            "-o", "ServerAliveInterval=30",
            "-o", "ServerAliveCountMax=3",
            "-N",
            "-L", "5433:127.0.0.1:5432",
            f"{ec2_user}@{ec2_host}",
        ]
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)

        for _ in range(10):
            time.sleep(0.1)
            if is_port_open("127.0.0.1", 5433, timeout=0.1):
                logger.info("SSH tunnel successfully opened on port 5433.")
                _last_unreachable_time = 0.0
                return True
    except Exception as exc:
        logger.warning("Could not auto-launch SSH tunnel: %s", exc)

    tunnel_open = is_port_open("127.0.0.1", 5433, timeout=0.1)
    if not tunnel_open:
        _last_unreachable_time = now
    return tunnel_open


def get_connection_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        if settings.PGHOST in ("localhost", "127.0.0.1") and int(settings.PGPORT) == 5433:
            if not is_port_open("127.0.0.1", 5433, timeout=0.1):
                if not ensure_tunnel_if_needed():
                    raise DatabaseUnavailableError("PostgreSQL port 5433 is closed and SSH tunnel is unavailable.")

        _pool = ConnectionPool(
            conninfo=settings.database_connection_string,
            min_size=1,  # ponytail: keep 1 warm connection
            max_size=settings.DATABASE_POOL_MAX_SIZE,
            timeout=settings.DATABASE_POOL_TIMEOUT,
            kwargs={"connect_timeout": 2, "row_factory": dict_row},
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
        logger.warning("Database connection failed (%s).", exc)
        close_db_pool()
        raise DatabaseUnavailableError("PostgreSQL is unavailable.") from exc
    except ValueError as exc:
        raise DatabaseUnavailableError(f"PostgreSQL configuration error: {exc}") from exc


def close_db_pool() -> None:
    global _pool
    if _pool is not None:
        try:
            _pool.close()
        except Exception:
            pass
        _pool = None
