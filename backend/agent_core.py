import os
from dotenv import load_dotenv

load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from config import settings

@tool
def calculate_multiply(a: int, b: int) -> int:
    """Useful for multiplying two numbers together. Always use this for multiplication."""
    return a * b

def run_agent_workflow(prompt: str):
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)
    
    tools = [calculate_multiply]
    agent_executor = create_react_agent(llm, tools)
    
    events = agent_executor.invoke(
        {"messages": [("user", prompt)]}
    )
    
    final_message = events["messages"][-1].content
    return final_message