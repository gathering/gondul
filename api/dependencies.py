import logging
import time
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request
import redis

from .config.cache import pool
from .config.logger import setup_logger
from .config.netbox import nb

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_logger()
    logger.warning(f"Starting the application")
    yield
    logger.warning("Shutting down the application")

async def get_redis():
    return redis.Redis(connection_pool=pool)

async def get_netbox():
    return nb

async def add_process_time_header(request: Request, call_next: Callable):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["Server-Timing"] = f"Total;dur={process_time: .6f}"
    return response
