from datetime import datetime
from zoneinfo import ZoneInfo
from pydantic import BaseModel, AwareDatetime
from sqlmodel import Field, SQLModel, DateTime, Field as SqlField

class OplogBase(SQLModel, table=True):
    __tablename__ = "oplog"
    
    id: int = Field(default=None, primary_key=True)
    time: AwareDatetime = SqlField(
        default = datetime.now(ZoneInfo("UTC")),
        sa_type = DateTime(timezone=True),
    )
    username: str | None = None
    systems: str | None = None
    message: str

class Oplog(BaseModel):
    oplog: list[OplogBase]
    time: AwareDatetime = SqlField(
        default = datetime.now(ZoneInfo("UTC")),
        sa_type = DateTime(timezone=True),
    )
    hash: str | None = None
    
class OplogCreate(BaseModel):
    username: str | None = None
    systems: str | None = None
    message: str
