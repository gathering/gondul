from collections.abc import Generator
from sqlmodel import Session
import redis

from app.core.db import engine
from app.core.cache import pool
from app.core.netbox import nb


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

def get_cache():
    return redis.Redis(connection_pool=pool)

def get_netbox():
    return nb
