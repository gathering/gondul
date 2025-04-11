from pydantic import BaseModel
from sqlmodel import Field, SQLModel

class OplogBase(SQLModel, table=True):
    __tablename__ = "oplog"
    
    id: int = Field(default=None, primary_key=True)
    time: int
    username: str | None = None
    systems: str | None = None
    message: str

class Oplog(BaseModel):
    oplog: list[OplogBase]
    time: int | None = None
    hash: str | None = None
    
class OplogCreate(BaseModel):
    username: str | None = None
    systems: str | None = None
    message: str
