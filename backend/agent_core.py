import os
import json
import redis
from dotenv import load_dotenv

load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from config import settings

redis_client = redis.from_url(settings.redis_url)

@tool
def calculate_multiply(a: int, b: int) -> int:
    """Useful for multiplying two numbers together. Always use this for multiplication."""
    return a * b

def run_agent_workflow(prompt: str, task_id: str, api_key: str):
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0, api_key=api_key)
    tools = [calculate_multiply]
    agent_executor = create_react_agent(llm, tools)
    
    channel_name = f"channel_{task_id}"
    
    redis_client.publish(channel_name, json.dumps({"status": "started", "message": "Agent initialized..."}))
    
    final_message = ""
    
    for event in agent_executor.stream({"messages": [("user", prompt)]}):
        for node_name, node_data in event.items():
            
            if node_name == "agent":
                msg = "Agent is reasoning..."
                if "messages" in node_data and len(node_data["messages"]) > 0:
                    final_message = node_data["messages"][-1].content
            elif node_name == "tools":
                msg = "Agent is executing a tool..."
            else:
                msg = f"Agent is at step: {node_name}"
                
            redis_client.publish(channel_name, json.dumps({"status": "processing", "step": node_name, "message": msg}))
            
    redis_client.publish(channel_name, json.dumps({"status": "completed", "result": final_message}))
    
    return final_message