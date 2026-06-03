"""Human-in-the-loop approval for sensitive tool execution."""
from __future__ import annotations

import json
import uuid

import redis

from config import settings

redis_client = redis.from_url(settings.redis_url)
APPROVAL_TIMEOUT_SECONDS = 300


def request_tool_approval(
    task_id: str,
    channel_name: str,
    tool_name: str,
    tool_id: str,
    risk_tier: str,
    args_preview: str,
) -> tuple[str, bool]:
    """Publish approval request and block until user responds."""
    approval_id = str(uuid.uuid4())
    redis_client.publish(
        channel_name,
        json.dumps(
            {
                "status": "approval_required",
                "approval_id": approval_id,
                "task_id": task_id,
                "tool_name": tool_name,
                "tool_id": tool_id,
                "risk_tier": risk_tier,
                "args_preview": args_preview[:500],
                "message": (
                    f"Human approval required before running tool '{tool_name}' "
                    f"({risk_tier} risk)."
                ),
            }
        ),
    )

    queue_key = f"approval_response:{approval_id}"
    response = redis_client.brpop(queue_key, timeout=APPROVAL_TIMEOUT_SECONDS)
    if not response:
        return approval_id, False

    try:
        decision = json.loads(response[1])
    except (json.JSONDecodeError, TypeError):
        return approval_id, False

    return approval_id, bool(decision.get("approved"))


def submit_approval_decision(approval_id: str, approved: bool, user_id: str) -> bool:
    queue_key = f"approval_response:{approval_id}"
    payload = json.dumps({"approved": approved, "user_id": user_id})
    redis_client.lpush(queue_key, payload)
    redis_client.expire(queue_key, APPROVAL_TIMEOUT_SECONDS)
    return True
