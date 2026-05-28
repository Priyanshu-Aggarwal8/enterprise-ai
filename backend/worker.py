import asyncio
from celery import Celery, current_task
from sqlalchemy.future import select
from config import settings
from database import AsyncSessionLocal
import models
import security
import agent_core

celery_app = Celery(
    "agent_worker",
    broker=settings.redis_url,
    backend=settings.redis_url
)

async def fetch_and_decrypt_key(org_id: str) -> str:
    async with AsyncSessionLocal() as db:
        stmt = select(models.OrganizationSecret).where(
            models.OrganizationSecret.org_id == org_id
        )
        result = await db.execute(stmt)
        secret_record = result.scalar_one_or_none()
        
        if not secret_record:
            raise ValueError("No API key configured for this Organization. Please add one in Settings.")
            
        return security.decrypt_key(secret_record.encrypted_key)

@celery_app.task(name="execute_agent")
def execute_agent_task(org_id: str, agent_id: str, prompt: str):
    task_id = current_task.request.id
    print(f"WORKER: Starting AI execution for Task {task_id} (Org: {org_id})")
    
    try:
        decrypted_api_key = asyncio.run(fetch_and_decrypt_key(org_id))
        final_answer = agent_core.run_agent_workflow(prompt, task_id, decrypted_api_key)
        
        print(f"WORKER: Execution successful!")
        return {"status": "completed", "agent_id": agent_id, "result": final_answer}
        
    except ValueError as ve:
        print(f"WORKER ERROR: {str(ve)}")
        return {"status": "failed", "agent_id": agent_id, "error": str(ve)}
    except Exception as e:
        print(f"WORKER ERROR: {str(e)}")
        return {"status": "failed", "agent_id": agent_id, "error": str(e)}