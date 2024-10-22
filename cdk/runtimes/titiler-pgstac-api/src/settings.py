"""settings for titiler-pgstac runtime"""

from typing import Optional

from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings
from titiler.pgstac.settings import PostgresSettings

from .utils import get_secret_dict


class ApiSettings(BaseSettings):
    """FASTAPI application settings."""

    pgstac_secret_arn: str
    postgres: Optional[PostgresSettings] = None
    name: str = "impact-tiler"
    cors_origins: str = "*"
    cachecontrol: str = "public, max-age=3600"
    root_path: str = ""
    debug: bool = False

    @field_validator("postgres")
    def load_postgres_settings(cls, v, info: ValidationInfo):
        """Set the PostgresSettings for titiler-pgstac"""
        if v is not None:
            return v
        secret_arn = info.data.get("pgstac_secret_arn")
        if secret_arn:
            postgres_secret = get_secret_dict(secret_arn)
            return PostgresSettings(
                postgres_user=postgres_secret["username"],
                postgres_pass=postgres_secret["password"],
                postgres_host=postgres_secret["host"],
                postgres_dbname=postgres_secret["dbname"],
                postgres_port=postgres_secret["port"],
            )

        else:
            raise ValueError("You must provide pgstac_secret_arn")

    @field_validator("cors_origins", mode="before")
    def parse_cors_origin(cls, v):
        """Parse CORS origins."""
        return [origin.strip() for origin in v.split(",")]

    class Config:
        env_file = ".env"


class MosaicSettings(BaseSettings):
    """Application settings"""

    backend: Optional[str]
    host: Optional[str]
    format: str = ".json.gz"  # format will be ignored for dynamodb backend

    class Config:
        """model config"""

        env_prefix = "MOSAIC_"
        env_file = ".env"
