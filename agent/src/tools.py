"""Templating + HTTP tool execution + MCP server construction.

Helpers the agent uses to translate the per-call dispatch metadata produced
by the API (`buildAgentMetadata`) into runtime behaviour:

- `render_template` substitutes `{{var}}` tokens in strings.
- `run_http_tool` executes a single curl-style tool (pre / on / post).
- `build_mcp_servers` converts MCP server metadata to `mcp.MCPServerHTTP`.
- `build_on_call_tools` synthesises raw `function_tool`s from on-call tool configs.
- `build_kb_tools` synthesises a `search_knowledge_base` tool when KBs are attached.
- `run_pre_call_hooks` / `run_post_call_hooks` fire the lifecycle phases.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any

import aiohttp
from livekit.agents import mcp
from livekit.agents.llm import function_tool

logger = logging.getLogger("agent.tools")

_TEMPLATE_RE = re.compile(r"{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}")


def render_template(template: str | None, values: dict[str, Any]) -> str:
    if template is None:
        return ""

    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in values:
            logger.debug("template var missing: %s", key)
            return ""
        value = values[key]
        return "" if value is None else str(value)

    return _TEMPLATE_RE.sub(replace, template)


async def run_http_tool(tool: dict[str, Any], values: dict[str, Any]) -> str:
    """Execute a single HTTP tool. Returns the response body as a string
    (possibly prefixed with a status note on non-2xx responses). Logs and
    returns a clear error string on exception."""
    method: str = tool.get("method", "GET")
    url = render_template(tool.get("url"), values)
    headers_in = tool.get("headers") or {}
    headers = {
        k: render_template(v, values) if isinstance(v, str) else v
        for k, v in headers_in.items()
    }
    body_tpl = tool.get("bodyTemplate")
    body = render_template(body_tpl, values) if body_tpl else None

    try:
        async with aiohttp.ClientSession() as session:
            async with session.request(
                method,
                url,
                headers=headers or None,
                data=body if body else None,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                text = await resp.text()
                if resp.status >= 400:
                    return f"[HTTP {resp.status}] {text[:2000]}"
                return text[:8000]
    except Exception as exc:  # noqa: BLE001
        logger.warning("http tool %s failed: %s", tool.get("name"), exc)
        return f"[error] {exc}"


def build_mcp_servers(meta: dict[str, Any]) -> list[mcp.MCPServerHTTP]:
    servers: list[mcp.MCPServerHTTP] = []
    for entry in meta.get("mcpServers", []) or []:
        url = entry.get("url")
        if not url:
            continue
        transport = entry.get("transport", "auto")
        kwargs: dict[str, Any] = {}
        if transport == "http" or transport == "sse":
            kwargs["transport_type"] = transport
        if entry.get("headers"):
            kwargs["headers"] = entry["headers"]
        try:
            servers.append(mcp.MCPServerHTTP(url, **kwargs))
        except Exception as exc:  # noqa: BLE001
            logger.warning("skipping MCP server %s: %s", url, exc)
    return servers


def build_on_call_tools(meta: dict[str, Any]) -> list[Any]:
    tools = []
    for entry in (meta.get("tools") or {}).get("on", []) or []:
        raw_params = entry.get("parameters")
        try:
            parameters = json.loads(raw_params) if isinstance(raw_params, str) else (raw_params or {})
        except json.JSONDecodeError:
            logger.warning("skipping tool %s: invalid parameters JSON", entry.get("name"))
            continue

        def make_handler(cfg: dict[str, Any]):
            async def handler(raw_arguments: dict[str, Any]) -> str:
                return await run_http_tool(cfg, raw_arguments or {})
            return handler

        try:
            tools.append(
                function_tool(
                    make_handler(entry),
                    raw_schema={
                        "name": entry["name"],
                        "description": entry.get("description") or "",
                        "parameters": parameters,
                    },
                )
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("skipping tool %s: %s", entry.get("name"), exc)
    return tools


def build_kb_tools(meta: dict[str, Any]) -> list[Any]:
    """If the agent has knowledge bases attached, synthesize a single
    `search_knowledge_base(query)` raw function tool that hits the API's
    `/internal/kb/search` endpoint."""
    kbs = meta.get("knowledgeBases") or []
    if not kbs:
        return []

    api_url = os.environ.get("API_URL")
    internal_key = os.environ.get("INTERNAL_API_KEY")
    if not api_url or not internal_key:
        logger.warning(
            "build_kb_tools: API_URL or INTERNAL_API_KEY not set; "
            "search_knowledge_base tool disabled"
        )
        return []

    kb_ids = [kb["id"] for kb in kbs if kb.get("id")]
    if not kb_ids:
        return []

    # Pick the override description from the first KB if present, else a
    # sensible default that mentions every KB by name.
    names = ", ".join(kb.get("name", "") for kb in kbs if kb.get("name"))
    description = (
        next((kb.get("toolDescription") for kb in kbs if kb.get("toolDescription")), None)
        or (
            f"Search the assistant's knowledge bases ({names}) for relevant "
            "information. Use this when the user asks something that the "
            "documents you've been given would answer."
        )
    )

    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query phrased as the user's intent",
            }
        },
        "required": ["query"],
    }

    target = f"{api_url.rstrip('/')}/internal/kb/search"

    async def handler(raw_arguments: dict[str, Any]) -> str:
        query = (raw_arguments or {}).get("query", "")
        if not isinstance(query, str) or not query.strip():
            return "[error] empty query"
        try:
            timeout = aiohttp.ClientTimeout(total=15)
            async with aiohttp.ClientSession(timeout=timeout) as http:
                async with http.post(
                    target,
                    json={
                        "knowledgeBaseIds": kb_ids,
                        "query": query,
                        "k": 4,
                    },
                    headers={"Authorization": f"Bearer {internal_key}"},
                ) as resp:
                    text = await resp.text()
                    if resp.status >= 400:
                        return f"[search error {resp.status}] {text[:300]}"
                    body = json.loads(text)
                    chunks = body.get("chunks") or []
                    if not chunks:
                        return "No relevant information found in the knowledge base."
                    return "\n\n---\n\n".join(
                        f"From {c.get('documentName', 'document')}:\n{c.get('text', '')}"
                        for c in chunks
                    )
        except Exception as exc:  # noqa: BLE001
            logger.warning("kb search failed: %s", exc)
            return f"[error] {exc}"

    try:
        return [
            function_tool(
                handler,
                raw_schema={
                    "name": "search_knowledge_base",
                    "description": description,
                    "parameters": parameters,
                },
            )
        ]
    except Exception as exc:  # noqa: BLE001
        logger.warning("could not build search_knowledge_base tool: %s", exc)
        return []


async def run_pre_call_hooks(meta: dict[str, Any], values: dict[str, Any]) -> str:
    """Run every pre-call tool in parallel; combine results into a single
    context block suitable for appending to the agent's instructions."""
    entries = (meta.get("tools") or {}).get("pre", []) or []
    if not entries:
        return ""
    results = await asyncio.gather(
        *(run_http_tool(t, values) for t in entries),
        return_exceptions=True,
    )
    blocks: list[str] = []
    for entry, result in zip(entries, results):
        name = entry.get("name", "tool")
        if isinstance(result, BaseException):
            blocks.append(f"## {name}\n[error] {result}")
        else:
            blocks.append(f"## {name}\n{result}")
    return "\n\n".join(blocks)


async def run_post_call_hooks(meta: dict[str, Any], values: dict[str, Any]) -> None:
    entries = (meta.get("tools") or {}).get("post", []) or []
    if not entries:
        return
    await asyncio.gather(
        *(run_http_tool(t, values) for t in entries),
        return_exceptions=True,
    )
