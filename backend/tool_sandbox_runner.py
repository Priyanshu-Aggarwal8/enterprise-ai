"""Isolated subprocess entrypoint for custom tool sandbox tests and runtime execution."""
import importlib
import inspect
import json
import sys

# Modules that are safe to import
SAFE_MODULES = {
    "math",
    "random",
    "decimal",
    "fractions",
    "statistics",
    "datetime",
    "time",
    "re",
    "json",
    "csv",
    "base64",
    "hashlib",
    "hmac",
    "uuid",
    "collections",
    "itertools",
    "functools",
    "operator",
}


def _restricted_import(name, *args, **kwargs):
    """Restricted import that only allows safe modules."""
    root = name.split(".")[0]
    if root not in SAFE_MODULES:
        raise ImportError(f"Module '{root}' is not allowed in sandbox")
    return importlib.import_module(name)


SAFE_BUILTINS = {
    "abs": abs,
    "all": all,
    "any": any,
    "bool": bool,
    "dict": dict,
    "enumerate": enumerate,
    "float": float,
    "int": int,
    "len": len,
    "list": list,
    "max": max,
    "min": min,
    "range": range,
    "reversed": reversed,
    "round": round,
    "set": set,
    "sorted": sorted,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "zip": zip,
    "True": True,
    "False": False,
    "None": None,
    "print": print,
    "__import__": _restricted_import,
}


def _find_run_callable(namespace: dict):
    if "run" in namespace and callable(namespace["run"]):
        return namespace["run"]
    for name, obj in namespace.items():
        if callable(obj) and not name.startswith("_"):
            return obj
    return None


def _call_with_args(fn, test_input: str) -> str:
    """Call function with appropriate argument(s) based on its signature."""
    sig = inspect.signature(fn)
    params = list(sig.parameters.values())
    
    # If function takes no arguments, call with no args
    if len(params) == 0:
        return fn()
    
    # If function takes 1 argument, pass the string directly
    if len(params) == 1:
        return fn(test_input)
    
    # For multi-parameter functions, try to parse test_input as JSON
    args_dict = None
    try:
        args_dict = json.loads(test_input)
        if not isinstance(args_dict, dict):
            args_dict = None
    except (json.JSONDecodeError, ValueError, TypeError):
        args_dict = None
    
    # If no valid JSON dict, try to generate realistic test values
    if args_dict is None:
        args_dict = {}
        for param in params:
            if param.default != inspect.Parameter.empty:
                # Has default, skip it
                continue
            # Generate realistic test values based on parameter names and type hints
            param_name = param.name.lower()
            param_type = param.annotation
            
            # Check parameter name for hints about appropriate test values
            if "rate" in param_name or "percent" in param_name:
                args_dict[param.name] = 7.5  # Realistic interest rate
            elif "principal" in param_name or "amount" in param_name:
                args_dict[param.name] = 100000  # Realistic monetary amount
            elif "tenure" in param_name or "month" in param_name or "year" in param_name:
                args_dict[param.name] = 60  # Realistic tenure
            elif "price" in param_name or "cost" in param_name or "value" in param_name:
                args_dict[param.name] = 1000  # Realistic value
            elif "count" in param_name or "number" in param_name or "num" in param_name:
                args_dict[param.name] = 10  # Reasonable count
            elif param_type == float or param_type == int:
                # Default numeric values
                args_dict[param.name] = 1 if param_type == int else 1.0
            else:
                # Default string
                args_dict[param.name] = "test"
    
    # Map JSON dict to function parameters
    try:
        bound = sig.bind_partial(**args_dict)
        bound.apply_defaults()
        return fn(*bound.args, **bound.kwargs)
    except TypeError as e:
        missing = [p.name for p in params if p.default == inspect.Parameter.empty and p.name not in args_dict]
        raise ValueError(f"Missing required parameters: {missing}")


def _execute(payload: dict) -> dict:
    code = payload.get("code", "")
    test_input = payload.get("test_input", "sandbox-test")
    namespace: dict = {"__builtins__": SAFE_BUILTINS}
    exec(compile(code, "<tool>", "exec"), namespace, namespace)
    run_fn = _find_run_callable(namespace)
    if not run_fn:
        return {"ok": False, "error": "No callable found to execute."}
    result = _call_with_args(run_fn, test_input)
    if not isinstance(result, str):
        result = str(result)
    if len(result) > 8000:
        result = result[:8000] + "...(truncated)"
    return {"ok": True, "output": result}


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read())
        print(json.dumps(_execute(payload)))
        return 0
    except Exception as exc:  # noqa: BLE001 — sandbox boundary
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
