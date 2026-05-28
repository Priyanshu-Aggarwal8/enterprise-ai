from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import redis.asyncio as aioredis
import json
from config import settings
import worker 

router = APIRouter(
    prefix="/agents",
    tags=["Agents Execution"]
)

class AgentRunRequest(BaseModel):
    org_id: str
    agent_id: str
    session_id: str
    prompt: str

@router.post("/run")
async def run_agent(request: AgentRunRequest):
    task = worker.execute_agent_task.delay(request.org_id, request.agent_id, request.session_id, request.prompt)
    
    return {
        "message": "Agent execution queued successfully",
        "task_id": task.id
    }

@router.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    
    redis_client = aioredis.from_url(settings.redis_url)
    pubsub = redis_client.pubsub()
    
    channel_name = f"channel_{task_id}"
    await pubsub.subscribe(channel_name)
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"].decode("utf-8")
                
                await websocket.send_text(data)
                
                payload = json.loads(data)
                if payload.get("status") == "completed":
                    break
                    
    except WebSocketDisconnect:
        print(f"Client disconnected from task {task_id}")
    finally:
        await pubsub.unsubscribe(channel_name)
        await redis_client.aclose()