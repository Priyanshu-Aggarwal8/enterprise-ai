from celery import Celery
from config import settings
import agent_core 

celery_app = Celery(
    "agent_worker",
    broker=settings.redis_url,
    backend=settings.redis_url
)

@celery_app.task(name="execute_agent")
def execute_agent_task(agent_id: str, prompt: str):
    print(f"WORKER: Starting AI execution for ID {agent_id}...")
    
    try:
        final_answer = agent_core.run_agent_workflow(prompt)
        
        print(f"WORKER: Execution successful!")
        return {
            "status": "completed", 
            "agent_id": agent_id, 
            "result": final_answer
        }
    except Exception as e:
        print(f"WORKER ERROR: {str(e)}")
        return {
            "status": "failed",
            "agent_id": agent_id,
            "error": str(e)
        }