import os
import redis

def create_redis():
  return redis.ConnectionPool(
    host=os.environ.get('REDIS_HOST', 'localhost'), 
    port=os.environ.get('REDIS_PORT', 6379), 
    db=os.environ.get('REDIS_DB', 0), 
    decode_responses=True
  )

pool = create_redis()