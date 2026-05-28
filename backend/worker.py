from celery import Celery, current_task
from config import settings
import security
import agent_core
import psycopg

celery_app = Celery(
    "agent_worker",
    broker=settings.redis_url,
    backend=settings.redis_url
)

sync_db_url = settings.database_url.replace("+asyncpg", "")

def fetch_and_decrypt_key_sync(org_id: str) -> str:
    """Fetches the API key from PostgreSQL synchronously to avoid Event Loop collisions."""
    with psycopg.connect(sync_db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT encrypted_key FROM organization_secrets WHERE org_id = %s", 
                (org_id,)
            )
            result = cur.fetchone()
            
            if not result:
                raise ValueError("No API key configured for this Organization. Please add one in Settings.")
                
            return security.decrypt_key(result[0])

@celery_app.task(name="execute_agent")
def execute_agent_task(org_id: str, agent_id: str, session_id: str, prompt: str):
    task_id = current_task.request.id
    print(f"WORKER: Starting AI execution for Task {task_id} (Org: {org_id}, Session: {session_id})")
    
    try:
        decrypted_api_key = fetch_and_decrypt_key_sync(org_id)
        
        final_answer = agent_core.run_agent_workflow(prompt, task_id, decrypted_api_key, session_id, org_id)
        
        print(f"WORKER: Execution successful!")
        return {"status": "completed", "agent_id": agent_id, "result": final_answer}
        
    except ValueError as ve:
        print(f"WORKER ERROR: {str(ve)}")
        return {"status": "failed", "agent_id": agent_id, "error": str(ve)}
    except Exception as e:
        print(f"WORKER ERROR: {str(e)}")
        return {"status": "failed", "agent_id": agent_id, "error": str(e)}