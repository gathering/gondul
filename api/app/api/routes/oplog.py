import hashlib
import time

from fastapi import APIRouter, BackgroundTasks, Request, Response, HTTPException, Depends
from sqlmodel import select

from app.api.deps import get_db
from app.models.oplog import Oplog, OplogBase, OplogCreate
from app.core.slack_webhook import send_oplog_notification

router = APIRouter(prefix="/v2/oplog", tags=["oplog"])

# oplog
@router.get("/")
async def list_oplog(request: Request, response: Response, db=Depends(get_db)) -> Oplog:
    last = db.exec(select(OplogBase).order_by(OplogBase.time.desc())).first()
    updated = str(last.time) if last is not None else None
    etag = None
    if updated is not None:
        etag = hashlib.md5(updated.encode("utf-8")).hexdigest()
        response.headers["etag"] = etag
    if etag is not None and request.headers.get("If-None-Match") == etag:
        raise HTTPException(status_code=304)

    oplogs = db.exec(select(OplogBase)).all()
    return {"oplog": oplogs, "time": updated, "hash": etag}

@router.post("/")
async def create_oplog(oplog: OplogCreate, background_tasks: BackgroundTasks, db=Depends(get_db)):
    validated_oplog = OplogBase.model_validate(
        oplog.model_dump(exclude={"send_to_slack"}),
        update={"time": round(time.time())}
    )
    db.add(validated_oplog)
    db.commit()
    if oplog.send_to_slack != False: # Optional parameter to disable sending slack messages. Default is to send messages for backwards compatibility.
        background_tasks.add_task(send_oplog_notification, validated_oplog)
    return oplog
