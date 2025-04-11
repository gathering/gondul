import hashlib
import time

from fastapi import APIRouter, Request, Response, HTTPException, Depends
from sqlmodel import select

from app.api.deps import get_db
from app.models.oplog import Oplog, OplogBase, OplogCreate
from app.api.deps import get_db

router = APIRouter(prefix="/v2/oplog", tags=["oplog"])

# oplog
@router.get("/")
async def list_oplog(request: Request, response: Response, db=Depends(get_db)) -> Oplog:
    last = db.exec(select(OplogBase).order_by(OplogBase.time.desc())).first()

    updated = str(last.time)
    etag = None
    if updated is not None:
        etag = hashlib.md5(updated.encode("utf-8")).hexdigest()
        response.headers["etag"] = etag
    if etag is not None and request.headers.get("If-None-Match") == etag:
        raise HTTPException(status_code=304)

    oplogs = db.exec(select(OplogBase)).all()
    return {"oplog": oplogs, "time": updated, "hash": etag}

@router.post("/")
async def create_oplog(oplog: OplogCreate, db=Depends(get_db)):
    db.add(OplogBase.model_validate(oplog, update={"time": round(time.time())}))
    db.commit()
    return oplog
