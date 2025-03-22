from pydantic import BaseModel

class Stats(BaseModel):
    data: dict | None = None
    temp: dict | None = None
    ports: dict | None = None
    
class Snmp(BaseModel):
    snmp: dict[str, Stats]
    time: int | None = None
    hash: str | None = None