from contextlib import asynccontextmanager
from fastapi import FastAPI
from database import engine, Base
import models
from routers import organizations, agents, documents, tools, users
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="Enterprise Multi-AI Agent Platform",
    lifespan=lifespan
)

origins = [
    "http://localhost:4200",
    "http://127.0.0.1:4200"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

app.include_router(organizations.router)
app.include_router(agents.router)
app.include_router(documents.router)
app.include_router(tools.router)
app.include_router(users.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "API Gateway and Database connected."}