import json
import redis
import psycopg
from celery import Celery
from config import settings
import agent_core
from auth_utils import decrypt_api_key

celery_app = Celery(
    "agent_worker",
    broker=settings.redis_url,
    backend=settings.redis_url
)

sync_db_url = settings.database_url.replace("+asyncpg", "")
redis_client = redis.from_url(settings.redis_url)

@celery_app.task(name="worker.execute_agent")
def execute_agent(prompt: str, org_id: str, session_id: str):
    """
    Executes the AI workflow. Arguments sent by agents.py:
    [prompt, org_id, session_id]
    Task ID is automatically provided by Celery via self.request.id
    """
    task_id = execute_agent.request.id
    print(f"WORKER: Starting AI execution for Task {task_id} (Org: {org_id}, Session: {session_id})")
    channel_name = f"channel_{task_id}"
    
    try:
        with psycopg.connect(sync_db_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT encrypted_key FROM organization_secrets WHERE org_id = %s AND provider = 'google'", 
                    (org_id,)
                )
                secret_record = cur.fetchone()
                
                if not secret_record:
                    error_msg = "No Google API key configured for this Organization. Please add one in Settings."
                    redis_client.publish(channel_name, json.dumps({"status": "failed", "error": error_msg}))
                    return {"status": "failed", "error": error_msg}
                    
                decrypted_api_key = decrypt_api_key(secret_record[0])

        final_answer = agent_core.run_agent_workflow(
            prompt, 
            task_id, 
            decrypted_api_key, 
            session_id, 
            org_id
        )
        
        print(f"WORKER: Execution successful!")
        return {"status": "completed", "result": final_answer}
        
    except Exception as e:
        error_msg = str(e)
        print(f"WORKER ERROR: {error_msg}")
        redis_client.publish(channel_name, json.dumps({"status": "failed", "error": error_msg}))
        return {"status": "failed", "error": error_msg}