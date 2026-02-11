import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response, FileResponse
import httpx

from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
    )
    GONDUL_URL: str
    GONDUL_USERNAME: str
    GONDUL_PASSWORD: str

settings = Settings()
app = FastAPI()

auth = httpx.BasicAuth(username=settings.GONDUL_USERNAME, password=settings.GONDUL_PASSWORD)

@app.get("/")
async def root():
    return FileResponse("../index.html")

@app.get("/api/{path:path}")
async def tile_request(path: str, response: Response):
    async with httpx.AsyncClient() as client:
        proxy = await client.get(f"{settings.GONDUL_URL}/api/{path}", auth=auth)
    response.body = proxy.content
    response.status_code = proxy.status_code
    return response

@app.post("/api/{path:path}")
async def tile_post_request(request: Request, path: str, response: Response):
    async with httpx.AsyncClient() as client:
        proxy = await client.post(f"{settings.GONDUL_URL}/api/{path}", auth=auth, data=await request.body())
    response.body = proxy.content
    response.status_code = proxy.status_code
    return response

# Mount web root
app.mount("/", StaticFiles(directory="../"))
