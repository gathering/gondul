from pydantic import BaseModel


class OplogData(BaseModel):
    id: int
    username: str | None = None
    time: str
    timestamp: str
    systems: str
    log: str


class Oplog(BaseModel):
    oplog: list[OplogData]
    time: int | None = None
    hash: str | None = None
