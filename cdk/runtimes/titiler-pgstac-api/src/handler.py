"""
Handler for AWS Lambda.
"""

import asyncio
import os

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from mangum import Mangum
from rio_tiler.io import STACReader
from titiler.core.factory import MultiBaseTilerFactory, TilerFactory
from titiler.extensions import (
    cogValidateExtension,
    cogViewerExtension,
    stacViewerExtension,
)
from titiler.pgstac.db import connect_to_db  # noqa: E402
from titiler.pgstac.main import app  # noqa: E402

from .settings import ApiSettings
from .factory import MosaicTilerFactory


api_settings = ApiSettings()


@app.on_event("startup")
async def startup_event() -> None:
    """Connect to database on startup."""
    await connect_to_db(app, settings=api_settings.postgres)


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


################################################
# Include the /stac router (for stac_ipyleaflet)
################################################
stac = MultiBaseTilerFactory(
    reader=STACReader,
    router_prefix="/stac",
    extensions=[
        stacViewerExtension(),
    ],
)

app.include_router(
    stac.router,
    prefix="/stac",
    tags=["SpatioTemporal Asset Catalog"],
)

#############################################################
# Include the /mosaics router (for legacy mosaicjson support)
#############################################################
mosaic = MosaicTilerFactory()
app.include_router(mosaic.router, tags=["MosaicJSON"])

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
