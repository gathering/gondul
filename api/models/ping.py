from pydantic import BaseModel, Field

class PingData(BaseModel):
    latency4: float = Field(description="In milliseconds")
    latency6: float = Field(description="In milliseconds")
    age4: int = Field(description="In seconds")
    age6: int = Field(description="In seconds")
    
class Ping(BaseModel):
    switches: dict[str, PingData]
    time: int | None = None
    hash: str | None = None