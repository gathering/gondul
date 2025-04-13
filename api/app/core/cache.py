from app.core.config import settings
import redis

def create_redis():
    return redis.ConnectionPool(
        host=settings.REDIS_SERVER,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=True,
    )


pool = create_redis()