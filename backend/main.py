from fastapi import FastAPI

app = FastAPI(
    title="Enterprise Multi-AI Agent Platform",
    description="API Gateway for Agent Orchestration",
    version="1.0.0"
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "API Gateway is running safely."}