"""settings for titiler-pgstac runtime"""

from typing import Optional

from pydantic_settings import BaseSettings


class MosaicSettings(BaseSettings):
    """Application settings"""

    backend: Optional[str]
    host: Optional[str]
    format: str = ".json.gz"  # format will be ignored for dynamodb backend

    class Config:
        """model config"""

        env_prefix = "MOSAIC_"
        env_file = ".env"
