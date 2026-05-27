from contextlib import asynccontextmanager
from fastapi import FastAPI
from database import engine, Base
import models
from routers import organizations, agents # IMPORT THE ROUTER

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="Enterprise Multi-AI Agent Platform",
    lifespan=lifespan
)

app.include_router(organizations.router)
app.include_router(agents.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "API Gateway and Database connected."}