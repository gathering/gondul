from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    NETBOX_URL: str
    NETBOX_TOKEN: str

    REDIS_SERVER: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    PROM_URL: str
    PROM_USER: str | None = None
    PROM_PASSWORD: str | None = None

    PSQL_CONNECTION_STRING: str

settings = Settings()  # type: ignore
