from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    netbox_url: str
    netbox_token: str


settings = Settings()
