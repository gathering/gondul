from pydantic import BaseModel, Field


class PingData(BaseModel):
    latency4: float | None = Field(description="In milliseconds")
    latency6: float | None = Field(description="In milliseconds")
    age4: float | None = Field(description="In seconds")
    age6: float | None = Field(description="In seconds")


class Ping(BaseModel):
    switches: dict[str, PingData]
    time: int | None = None
    hash: str | None = None
