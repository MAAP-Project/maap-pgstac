"""
Handler for AWS Lambda.
"""

import asyncio
import os

from mangum import Mangum
from utils import get_secret_dict

pgstac_secret_arn = os.environ["PGSTAC_SECRET_ARN"]

secret = get_secret_dict(pgstac_secret_arn)
os.environ.update(
    {
        "postgres_host": secret["host"],
        "postgres_dbname": secret["dbname"],
        "postgres_user": secret["username"],
        "postgres_pass": secret["password"],
        "postgres_port": str(secret["port"]),
    }
)

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from titiler.core.factory import TilerFactory
from titiler.extensions import (
    cogValidateExtension,
    cogViewerExtension,
)
from titiler.pgstac.db import connect_to_db  # noqa: E402
from titiler.pgstac.main import app  # noqa: E402


async def startup_event() -> None:
    """Connect to database on startup."""
    await connect_to_db(app)


########################################
# Include the /cog router
########################################
cog = TilerFactory(
    router_prefix="/cog",
    extensions=[
        cogValidateExtension(),
        cogViewerExtension(),
    ],
)

app.include_router(
    cog.router,
    prefix="/cog",
    tags=["Cloud Optimized GeoTIFF"],
)


########################################
# Redirect /mosaic requests to /searches
########################################
redirect_router = APIRouter()


@redirect_router.api_route(
    "/mosaic/{subpath:path}", methods=["GET", "POST"], status_code=307
)
async def redirect_to_searches(request: Request):
    new_path = request.url.path.replace("/mosaic", "/searches", 1)
    query_string = request.url.query
    if query_string:
        new_path = f"{new_path}?{query_string}"
    return RedirectResponse(url=new_path)


app.include_router(redirect_router)


handler = Mangum(app, lifespan="off")


if "AWS_EXECUTION_ENV" in os.environ:
    loop = asyncio.get_event_loop()
    loop.run_until_complete(app.router.startup())
