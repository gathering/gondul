from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from .routers import public, read, prometheus, v2
from .dependencies import lifespan, add_process_time_header

app = FastAPI(lifespan=lifespan)
app.middleware("http")(add_process_time_header)
app.add_middleware(GZipMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["etag"],
)

app.include_router(public.router)
app.include_router(read.router)
app.include_router(prometheus.router)
app.include_router(v2.router)


@app.get("/api/")
async def root():
    return {"status": "ok"}
