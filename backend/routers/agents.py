from fastapi import APIRouter
from pydantic import BaseModel
import worker 

router = APIRouter(
    prefix="/agents",
    tags=["Agents Execution"]
)

class AgentRunRequest(BaseModel):
    agent_id: str
    prompt: str

@router.post("/run")
async def run_agent(request: AgentRunRequest):
    task = worker.execute_agent_task.delay(request.agent_id, request.prompt)
    
    return {
        "message": "Agent execution queued successfully",
        "task_id": task.id
    }