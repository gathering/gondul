import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response, FileResponse
import httpx
from dotenv import load_dotenv

app = FastAPI()
load_dotenv()

auth = httpx.BasicAuth(username=os.environ.get("GONDUL_USERNAME"), password=os.environ.get("GONDUL_PASSWORD"))

@app.get("/")
async def root():
    return FileResponse("../index.html")

@app.get("/api/{path:path}")
async def tile_request(path: str, response: Response):
    async with httpx.AsyncClient() as client:
        proxy = await client.get(f"{os.environ.get("GONDUL_URL")}/api/{path}", auth=auth)
    response.body = proxy.content
    response.status_code = proxy.status_code
    return response

@app.post("/api/{path:path}")
async def tile_post_request(path: str, response: Response):
    async with httpx.AsyncClient() as client:
        proxy = await client.get(f"{os.environ.get("GONDUL_URL")}/api/{path}", auth=auth)
    response.body = proxy.content
    response.status_code = proxy.status_code
    return response

# Mount web root
app.mount("/", StaticFiles(directory="../"))