import os
import json
import redis
import psycopg
from dotenv import load_dotenv

load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.postgres import PostgresSaver
from langchain_huggingface import HuggingFaceEmbeddings 
from langchain_core.tools import tool, StructuredTool
from config import settings

redis_client = redis.from_url(settings.redis_url)
sync_db_url = settings.database_url.replace("+asyncpg", "")

def _load_agent_config(org_id: str, agent_id: str | None) -> tuple[str, str, str]:
    """Returns (system_prompt, model_name, agent_purpose)."""
    default_system = (
        "You are a helpful enterprise AI assistant. Use available tools and "
        "company documents to answer questions accurately and concisely."
    )
    default_model = "gemini-2.5-flash"
    default_purpose = "General assistant"

    if not agent_id:
        return default_system, default_model, default_purpose

    with psycopg.connect(sync_db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT system_prompt, model_name, purpose
                FROM agent_definitions
                WHERE id = %s AND org_id = %s
                """,
                (agent_id, org_id),
            )
            row = cur.fetchone()
            if row:
                return row[0] or default_system, row[1] or default_model, row[2] or default_purpose

    return default_system, default_model, default_purpose


def run_agent_workflow(
    prompt: str,
    task_id: str,
    api_key: str,
    session_id: str,
    org_id: str,
    agent_id: str | None = None,
):
    system_prompt, model_name, agent_purpose = _load_agent_config(org_id, agent_id)
    full_system = f"{system_prompt}\n\nAgent purpose: {agent_purpose}"

    llm = ChatGoogleGenerativeAI(model=model_name, temperature=0, api_key=api_key)
    
    @tool
    def search_company_documents(query: str) -> str:
        """Search the company's private uploaded documents. Use this whenever the user asks about specific company knowledge, files, or reports."""
        print(f"AGENT TOOL: Searching database for -> {query}")
        
        embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        query_vector = embeddings_model.embed_query(query)
        
        vector_str = f"[{','.join(map(str, query_vector))}]"
        
        with psycopg.connect(sync_db_url, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT content 
                    FROM document_chunks 
                    WHERE org_id = %s 
                    ORDER BY embedding <=> %s::vector 
                    LIMIT 3
                    """,
                    (org_id, vector_str)
                )
                results = cur.fetchall()
                
                if not results:
                    return "No relevant documents found for this query."
                
                return "\n\n---\n\n".join([r[0] for r in results])
            
    tools = [search_company_documents]

    with psycopg.connect(sync_db_url) as conn:
        with conn.cursor() as cur:
            if agent_id:
                cur.execute(
                    """
                    SELECT ct.name, ct.description, ct.python_code
                    FROM custom_tools ct
                    INNER JOIN agent_tool_bindings atb ON atb.tool_id = ct.id
                    WHERE atb.agent_id = %s AND ct.org_id = %s
                    """,
                    (agent_id, org_id),
                )
            else:
                cur.execute(
                    "SELECT name, description, python_code FROM custom_tools WHERE org_id = %s AND 1=0",
                    (org_id,),
                )
            custom_db_tools = cur.fetchall()
            
            for t_name, t_desc, t_code in custom_db_tools:
                def create_dynamic_function(code_string):
                    namespace = {}
                    exec(code_string, globals(), namespace)
                    
                    for name, obj in namespace.items():
                        if callable(obj) and not name.startswith("__"):
                            return obj
                    
                    def dummy_fallback() -> str:
                        return "Error: No valid Python function found in the tool code."
                    return dummy_fallback

                dynamic_tool = StructuredTool.from_function(
                    func=create_dynamic_function(t_code),
                    name=t_name,
                    description=t_desc
                )
                tools.append(dynamic_tool) 
                print(f"AGENT TOOL: Successfully loaded custom tool -> {t_name}")
    

    channel_name = f"channel_{task_id}"
    redis_client.publish(channel_name, json.dumps({"status": "started", "message": "Agent initialized..."}))
    
    final_message = ""
    
    with psycopg.connect(sync_db_url, autocommit=True) as conn:
        checkpointer = PostgresSaver(conn)
        checkpointer.setup()
        
        agent_executor = create_react_agent(llm, tools, checkpointer=checkpointer)
        config = {"configurable": {"thread_id": session_id}}
        
        for event in agent_executor.stream(
            {"messages": [("system", full_system), ("user", prompt)]},
            config=config,
        ):
            for node_name, node_data in event.items():
                if node_name == "agent":
                    msg = "Agent is reasoning..."
                    if "messages" in node_data and len(node_data["messages"]) > 0:
                        raw_content = node_data["messages"][-1].content
                        if isinstance(raw_content, list):
                            final_message = raw_content[0].get("text", str(raw_content))
                        else:
                            final_message = raw_content
                            
                elif node_name == "tools":
                    msg = "Agent is reading company documents or executing a tool..." 
                else:
                    msg = f"Agent is at step: {node_name}"
                    
                redis_client.publish(channel_name, json.dumps({"status": "processing", "step": node_name, "message": msg}))
                
    redis_client.publish(channel_name, json.dumps({"status": "completed", "result": final_message}))
    return final_message