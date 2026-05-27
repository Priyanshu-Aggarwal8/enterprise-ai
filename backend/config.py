from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    master_encryption_key: str
    redis_url: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()