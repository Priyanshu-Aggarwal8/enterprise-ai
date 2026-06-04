from contextlib import asynccontextmanager
from fastapi import FastAPI
from database import engine, Base
import models
from routers import organizations, agents, documents, tools, users, chats
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

        await conn.execute(text(
            "ALTER TABLE custom_tools ADD COLUMN IF NOT EXISTS risk_tier VARCHAR DEFAULT 'unknown'"
        ))

        await conn.execute(text(
            "ALTER TABLE custom_tools ADD COLUMN IF NOT EXISTS sandbox_status VARCHAR DEFAULT 'pending'"
        ))

        await conn.execute(text(
            "ALTER TABLE custom_tools ADD COLUMN IF NOT EXISTS sandbox_report TEXT"
        ))

        # Create column correctly as BOOLEAN for new databases
        await conn.execute(text(
            "ALTER TABLE custom_tools ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT FALSE"
        ))

        # One-time migration for older deployments where the column was created as VARCHAR
        await conn.execute(text("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'custom_tools'
                AND column_name = 'requires_approval'
                AND data_type = 'character varying'
            ) THEN
                ALTER TABLE custom_tools
                ALTER COLUMN requires_approval TYPE BOOLEAN
                USING (
                    CASE
                        WHEN lower(requires_approval) IN ('true', '1', 'yes')
                        THEN TRUE
                        ELSE FALSE
                    END
                );

                ALTER TABLE custom_tools
                ALTER COLUMN requires_approval SET DEFAULT FALSE;
            END IF;
        END $$;
        """))

        # Create IVFFlat index for fast approximate vector similarity search
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding "
            "ON document_chunks USING ivfflat (embedding vector_cosine_ops) "
            "WITH (lists = 100)"
        ))

    yield

app = FastAPI(
    title="Mnemos",
    lifespan=lifespan
)

origins = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "https://project-dd94ff34-4f30-4abf-bdc.web.app",
    "https://project-dd94ff34-4f30-4abf-bdc.firebaseapp.com"
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
app.include_router(chats.router)

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "message": "API Gateway and Database connected."
    }