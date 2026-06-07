import json
import redis
import ssl
import psycopg
from dotenv import load_dotenv

load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.postgres import PostgresSaver
from langchain_core.tools import tool, StructuredTool
from config import settings
from tool_sandbox import execute_tool_safely
from tool_approval import request_tool_approval

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


def _requires_approval_flag(value: str | None) -> bool:
    return str(value or "").lower() in {"true", "1", "yes"}


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
    channel_name = f"channel_{task_id}"

    @tool
    def search_company_documents(query: str) -> str:
        """Search the company's private uploaded documents. Use this whenever the user asks about specific company knowledge, files, or reports."""
        from langchain_huggingface import HuggingFaceEmbeddings
        
        _, approved = request_tool_approval(
            task_id=task_id,
            channel_name=channel_name,
            tool_name="search_company_documents",
            tool_id="builtin:search_company_documents",
            risk_tier="sensitive",
            args_preview=f"query={query[:200]}",
        )
        if not approved:
            return "Error: Document search denied by user."

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
                    (org_id, vector_str),
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
                    SELECT ct.id, ct.name, ct.description, ct.python_code,
                           ct.risk_tier, ct.requires_approval, ct.sandbox_status
                    FROM custom_tools ct
                    INNER JOIN agent_tool_bindings atb ON atb.tool_id = ct.id
                    WHERE atb.agent_id = %s AND ct.org_id = %s
                    """,
                    (agent_id, org_id),
                )
            else:
                cur.execute(
                    "SELECT id, name, description, python_code, risk_tier, requires_approval, sandbox_status "
                    "FROM custom_tools WHERE org_id = %s AND 1=0",
                    (org_id,),
                )
            custom_db_tools = cur.fetchall()

            for t_id, t_name, t_desc, t_code, risk_tier, requires_approval, sandbox_status in custom_db_tools:
                if sandbox_status != "passed":
                    print(f"AGENT TOOL: Skipping unvalidated tool -> {t_name}")
                    continue

                needs_approval = _requires_approval_flag(requires_approval) or risk_tier in {
                    "sensitive",
                    "dangerous",
                }

                def make_tool_runner(
                    code_string: str,
                    tool_name: str,
                    tool_uuid: str,
                    tier: str,
                    approval_required: bool,
                ):
                    def sandboxed_tool(input_string: str) -> str:
                        if approval_required:
                            _, approved = request_tool_approval(
                                task_id=task_id,
                                channel_name=channel_name,
                                tool_name=tool_name,
                                tool_id=str(tool_uuid),
                                risk_tier=tier,
                                args_preview=f"input={str(input_string)[:200]}",
                            )
                            if not approved:
                                return f"Error: Execution of '{tool_name}' denied by user."
                        return execute_tool_safely(code_string, str(input_string))

                    return sandboxed_tool

                runner = make_tool_runner(
                    t_code,
                    t_name,
                    str(t_id),
                    risk_tier or "safe",
                    needs_approval,
                )

                dynamic_tool = StructuredTool.from_function(
                    func=runner,
                    name=t_name,
                    description=t_desc,
                )
                tools.append(dynamic_tool)
                print(f"AGENT TOOL: Loaded sandboxed custom tool -> {t_name} ({risk_tier})")

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
                    msg = "Agent is executing an approved tool..."
                else:
                    msg = f"Agent is at step: {node_name}"

                redis_client.publish(
                    channel_name,
                    json.dumps({"status": "processing", "step": node_name, "message": msg}),
                )

    redis_client.publish(channel_name, json.dumps({"status": "completed", "result": final_message}))
    return final_message
