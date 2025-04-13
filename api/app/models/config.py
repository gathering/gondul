from pydantic import BaseModel


class ConfigData(BaseModel):
    sitename: str | None = None
    publicvhost: str | None = "public-gondul.tg.no"
    public: bool = False
    shortname: str | None = "tg25"


class Config(BaseModel):
    config: ConfigData
    time: int | None = None
    hash: str | None = None
