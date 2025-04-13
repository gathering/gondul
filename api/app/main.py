import time

from fastapi import FastAPI, Request
from starlette.middleware.cors import CORSMiddleware
from typing import Callable


from app.api.main import api_router
from app.core.config import settings

async def add_process_time_header(request: Request, call_next: Callable):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["Server-Timing"] = f"Total;dur={process_time: .6f}"
    return response

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/api/openapi.json"
)
app.middleware("http")(add_process_time_header)

# Set all CORS enabled origins
if settings.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["etag"],
    )

app.include_router(api_router, prefix="/api")