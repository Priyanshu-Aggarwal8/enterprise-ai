"""Static analysis and WASM-style isolated execution for custom Python tools."""
from __future__ import annotations

import ast
import inspect
import json
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

RUNNER_PATH = Path(__file__).resolve().parent / "tool_sandbox_runner.py"
MAX_CODE_BYTES = 32_000
SANDBOX_TIMEOUT_SECONDS = 5

FORBIDDEN_MODULES = {
    "os",
    "sys",
    "subprocess",
    "socket",
    "shutil",
    "pathlib",
    "importlib",
    "ctypes",
    "multiprocessing",
    "threading",
    "pickle",
    "builtins",
    "requests",
    "urllib",
    "http",
    "ftplib",
    "smtplib",
    "sqlite3",
    "psycopg",
    "redis",
    "celery",
    "dotenv",
    "sqlalchemy",
    "asyncio",
}

FORBIDDEN_CALLS = {
    "eval",
    "exec",
    "compile",
    "__import__",
    "open",
    "input",
    "breakpoint",
    "globals",
    "locals",
    "vars",
    "getattr",
    "setattr",
    "delattr",
    "help",
    "memoryview",
}

SENSITIVE_KEYWORDS = {
    "delete",
    "drop",
    "truncate",
    "remove",
    "write",
    "upload",
    "shell",
    "command",
    "password",
    "secret",
    "token",
    "credential",
}


@dataclass
class SandboxReport:
    passed: bool
    risk_tier: str
    requires_approval: bool
    issues: list[str] = field(default_factory=list)
    test_output: str | None = None
    test_error: str | None = None
    hints: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "risk_tier": self.risk_tier,
            "requires_approval": self.requires_approval,
            "issues": self.issues,
            "test_output": self.test_output,
            "test_error": self.test_error,
            "hints": self.hints,
        }


class _ToolAstVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.issues: list[str] = []
        # Tracks whether the code defines any callable we can execute
        self.has_callable_def = False
        self.sensitive_hits: set[str] = set()
        # Track callable signatures for better error messages
        self.callables: dict[str, list[str]] = {}  # name -> param names

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            root = alias.name.split(".")[0]
            if root in FORBIDDEN_MODULES:
                self.issues.append(f"Forbidden import: {alias.name}")

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module:
            root = node.module.split(".")[0]
            if root in FORBIDDEN_MODULES:
                self.issues.append(f"Forbidden import: {node.module}")

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        # Any function definition counts as an executable callable
        if not node.name.startswith("_"):
            self.has_callable_def = True
            # Extract parameter names
            param_names = [arg.arg for arg in node.args.args]
            self.callables[node.name] = param_names
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        # Async functions are also valid callables
        if not node.name.startswith("_"):
            self.has_callable_def = True
            param_names = [arg.arg for arg in node.args.args]
            self.callables[node.name] = param_names
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        name = _call_name(node.func)
        if name in FORBIDDEN_CALLS:
            self.issues.append(f"Forbidden call: {name}()")
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        lowered = node.attr.lower()
        for keyword in SENSITIVE_KEYWORDS:
            if keyword in lowered:
                self.sensitive_hits.add(keyword)
        self.generic_visit(node)

    def visit_Constant(self, node: ast.Constant) -> None:
        if isinstance(node.value, str):
            lowered = node.value.lower()
            for keyword in SENSITIVE_KEYWORDS:
                if keyword in lowered:
                    self.sensitive_hits.add(keyword)
        self.generic_visit(node)


def _call_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def _classify_risk(issues: Iterable[str], sensitive_hits: Iterable[str]) -> tuple[str, bool]:
    issues_list = list(issues)
    if issues_list:
        return "dangerous", True
    sensitive = set(sensitive_hits)
    if sensitive:
        return "sensitive", True
    return "safe", False


def analyze_tool_code(code: str, description: str = "") -> SandboxReport:
    issues: list[str] = []
    hints: list[str] = []
    
    if not code or not code.strip():
        return SandboxReport(False, "dangerous", True, ["Tool code is empty."])

    if len(code.encode("utf-8")) > MAX_CODE_BYTES:
        return SandboxReport(False, "dangerous", True, ["Tool code exceeds maximum size."])

    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return SandboxReport(False, "dangerous", True, [f"Syntax error: {exc.msg}"])

    visitor = _ToolAstVisitor()
    visitor.visit(tree)

    if not visitor.has_callable_def:
        issues.append("Tool must define at least one top-level callable (e.g., a function) to execute.")
    else:
        # Generate hints for multi-parameter functions
        for name, params in visitor.callables.items():
            if len(params) > 1:
                example_json = json.dumps({param: "value" for param in params})
                hints.append(
                    f"Function '{name}' has {len(params)} parameters. "
                    f"To test it, provide test_input as JSON: {example_json}"
                )
            elif len(params) == 0:
                hints.append(f"Function '{name}' takes no parameters; test_input will be ignored.")

    desc_lower = (description or "").lower()
    for keyword in SENSITIVE_KEYWORDS:
        if keyword in desc_lower:
            visitor.sensitive_hits.add(keyword)

    all_issues = issues + visitor.issues
    risk_tier, requires_approval = _classify_risk(all_issues, visitor.sensitive_hits)
    if risk_tier == "dangerous":
        return SandboxReport(False, risk_tier, True, all_issues, hints=hints)

    return SandboxReport(True, risk_tier, requires_approval, all_issues, hints=hints)


def run_sandbox_test(code: str, test_input: str = "sandbox-test") -> tuple[bool, str | None, str | None]:
    """Execute tool code in an isolated subprocess with restricted builtins."""
    payload = json.dumps({"code": code, "test_input": test_input})
    try:
        completed = subprocess.run(
            [sys.executable, str(RUNNER_PATH)],
            input=payload,
            capture_output=True,
            text=True,
            timeout=SANDBOX_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return False, None, "Sandbox test timed out."

    if completed.returncode != 0 and not completed.stdout.strip():
        return False, None, completed.stderr.strip() or "Sandbox runner failed."

    try:
        result = json.loads(completed.stdout.strip() or "{}")
    except json.JSONDecodeError:
        return False, None, "Invalid sandbox runner response."

    if result.get("ok"):
        return True, result.get("output"), None
    return False, None, result.get("error") or "Sandbox execution failed."


def validate_tool_for_save(code: str, description: str, test_input: str = "sandbox-test") -> SandboxReport:
    report = analyze_tool_code(code, description)
    if not report.passed:
        return report

    ok, output, error = run_sandbox_test(code, test_input)
    report.test_output = output
    report.test_error = error
    if not ok:
        report.passed = False
        report.risk_tier = "dangerous"
        report.requires_approval = True
        report.issues.append(error or "Sandbox test failed.")
    return report


def execute_tool_safely(code: str, tool_input: str) -> str:
    """Runtime execution path used by the agent worker (same sandbox as tests)."""
    ok, output, error = run_sandbox_test(code, tool_input)
    if ok:
        return output or ""
    return f"Error: {error or 'Tool execution blocked by sandbox.'}"
