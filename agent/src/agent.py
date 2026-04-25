import json
import logging
import os
import time
from datetime import datetime, timezone

import aiohttp
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
)
from livekit.plugins import cartesia, deepgram, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from tools import (
    build_kb_tools,
    build_mcp_servers,
    build_on_call_tools,
    run_post_call_hooks,
    run_pre_call_hooks,
)

logger = logging.getLogger("agent")

load_dotenv(".env.local")

AGENT_MODEL = "openai/gpt-4o-mini"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_VOICE_ID = "6b02ffe5-e3cb-48c0-a023-c72f85953375"

DEFAULT_INSTRUCTIONS = """You are a helpful voice AI assistant. The user is interacting with you via voice even if the conversation appears as text.

You eagerly assist users with clear useful answers. Your responses are concise natural and easy to speak. Avoid complex formatting or symbols.

You are friendly curious and slightly playful with a light sense of humor when appropriate.

You continuously detect the user’s sentiment tone and intent from their words phrasing and context. Based on this you dynamically adjust emotion speed volume and speaking style.

Emotional behavior rules

If the user is sad anxious or vulnerable respond with
<emotion value="sympathetic"/><speed ratio="0.85"/><volume ratio="0.8"/>
Use calm reassuring language with short pauses
If the user is excited curious or energetic respond with
<emotion value="excited"/><speed ratio="1.1"/><volume ratio="1.1"/>
Sound engaged upbeat and slightly faster
If the user is neutral respond with
<emotion value="neutral"/><speed ratio="1.0"/><volume ratio="1.0"/>
Keep it clear balanced and conversational
If the user is frustrated or angry respond with
<emotion value="calm"/><speed ratio="0.9"/><volume ratio="0.85"/>
Stay composed grounded and de escalate
If the user is asking for explanation or learning respond with
<emotion value="curious"/><speed ratio="0.95"/>
Speak clearly with small pauses for clarity

SSML usage rules

Always place emotion tag at the start of the response
Use <break time="200ms"/> to <break time="500ms"/> for natural pauses
Use speed and volume tags only once at the start unless needed
Do not switch emotions multiple times in a single response
Keep SSML minimal and natural do not overuse tags

Speech style

Keep sentences short and conversational
Avoid long paragraphs
Add natural pauses using break tags
Occasionally use light conversational fillers like hmm or alright
Use [laughter] only when clearly appropriate

Primary goal

Sound like a real human who understands both what the user is saying and how they feel and responds in a natural expressive emotionally aligned way using SSML controls correctly"""


def build_instructions(meta: dict, pre_context: str = "") -> str:
    objective = (meta.get("objective") or "").strip()
    guidelines = (meta.get("responseGuidelines") or "").strip()
    script = (meta.get("conversationScript") or "").strip()

    sections: list[str] = [DEFAULT_INSTRUCTIONS]

    persona = _persona_block(meta)
    if persona:
        sections.append(persona)

    kb_block = _kb_block(meta)
    if kb_block:
        sections.append(kb_block)

    if objective:
        sections.append(f"# Objective\n{objective}")
    if guidelines:
        sections.append(f"# Response guidelines\n{guidelines}")
    if script:
        sections.append(f"# Conversation script\n{script}")

    base = "\n\n".join(sections)

    if pre_context:
        return f"{base}\n\n# Pre-call context\n{pre_context}"
    return base


def _kb_block(meta: dict) -> str:
    """When the agent has knowledge bases attached, tell the LLM to use the
    `search_knowledge_base` tool whenever it would otherwise need to guess or
    say it doesn't know."""
    kbs = meta.get("knowledgeBases") or []
    if not kbs:
        return ""

    names = [kb.get("name") for kb in kbs if kb.get("name")]
    label = ", ".join(names) if names else "your attached documents"

    return (
        "# Knowledge base\n"
        f"You have a `search_knowledge_base` tool backed by {label}. "
        "Use it whenever the user asks something specific, factual, or "
        "domain-related that you don't already know with certainty — "
        "company info, product details, prices, policies, dates, names, "
        "anything specific to the user's business.\n"
        "\n"
        "Rules:\n"
        "- Don't guess. If you're not certain, search before answering.\n"
        "- Don't say 'I don't know' before searching — search first, then "
        "answer based on what comes back.\n"
        "- Use the user's exact question (or a slightly rephrased version) "
        "as the `query`.\n"
        "- If the search returns nothing useful, only THEN say you don't "
        "have that information.\n"
        "- Don't announce that you're searching ('let me check…' is fine, "
        "but don't read out tool names or 'searching the knowledge base').\n"
        "- After the tool returns, integrate the result into a natural, "
        "concise spoken answer. Don't dump raw text."
    )


def _persona_block(meta: dict) -> str:
    """Tell the LLM how to present itself based on the configured Cartesia
    voice. Without this hint, models default to gender-neutral or pick at
    random, which mismatches the audio."""
    name = (meta.get("name") or "").strip()
    gender = (meta.get("voiceGender") or "").strip().lower()
    voice_name = (meta.get("voiceName") or "").strip()

    if not (name or gender or voice_name):
        return ""

    lines = ["# Persona"]
    if name:
        lines.append(f"Your name is {name}.")
    if gender == "feminine":
        lines.append(
            "You speak with a feminine voice. Present yourself as a woman: "
            "use she/her pronouns if a caller asks, and pick gendered "
            "self-references that match (e.g. 'as a woman' rather than 'as a "
            "man'). Don't announce this — just embody it consistently."
        )
    elif gender == "masculine":
        lines.append(
            "You speak with a masculine voice. Present yourself as a man: "
            "use he/him pronouns if a caller asks, and pick gendered "
            "self-references that match. Don't announce this — just embody "
            "it consistently."
        )
    elif gender == "gender_neutral":
        lines.append(
            "You speak with a gender-neutral voice. Use they/them pronouns "
            "if a caller asks; avoid gendered self-references. Don't announce "
            "this — just stay consistent."
        )
    if voice_name:
        lines.append(f"Your voice is '{voice_name}' (Cartesia).")

    return "\n".join(lines)


class Assistant(Agent):
    def __init__(
        self,
        instructions: str = DEFAULT_INSTRUCTIONS,
        tools: list | None = None,
    ) -> None:
        super().__init__(instructions=instructions, tools=tools or [])


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="agent")
async def agent(ctx: JobContext):
    raw_metadata = ctx.job.metadata or "{}"
    try:
        meta = json.loads(raw_metadata) if raw_metadata else {}
    except json.JSONDecodeError:
        logger.warning("invalid job metadata; using defaults")
        meta = {}

    ctx.log_context_fields = {
        "room": ctx.room.name,
        "agent_id": meta.get("agentId"),
    }

    voice_id = meta.get("voiceId") or DEFAULT_VOICE_ID
    language = meta.get("language") or "multi"
    first_message = (meta.get("firstMessage") or "").strip()

    # Template variables for pre/post-call hooks.
    lifecycle_vars = {
        "agent_id": meta.get("agentId") or "",
        "agent_name": meta.get("name") or "",
        "room": ctx.room.name,
        "mode": meta.get("mode") or "phone",
    }

    pre_context = await run_pre_call_hooks(meta, lifecycle_vars)
    instructions = build_instructions(meta, pre_context)
    on_call_tools = build_on_call_tools(meta) + build_kb_tools(meta)
    mcp_servers = build_mcp_servers(meta)

    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language=language),
        llm=openai.LLM(
            model=AGENT_MODEL,
            base_url=OPENROUTER_BASE_URL,
            api_key=os.environ["OPENROUTER_API_KEY"],
        ),
        tts=cartesia.TTS(model="sonic-3", voice=voice_id),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
        mcp_servers=mcp_servers,
    )

    started_at = time.time()
    started_at_iso = datetime.now(timezone.utc).isoformat()

    async def run_post_call() -> None:
        logger.warning("=== shutdown callback fired ===")
        ended_at_iso = datetime.now(timezone.utc).isoformat()
        duration = int(time.time() - started_at)
        transcript = _extract_transcript(session)

        post_vars = {
            **lifecycle_vars,
            "duration_seconds": duration,
        }
        try:
            await run_post_call_hooks(meta, post_vars)
        except Exception as exc:  # noqa: BLE001
            logger.warning("post-call hooks failed: %s", exc)

        try:
            await _persist_call_log(
                meta=meta,
                room=ctx.room.name,
                started_at_iso=started_at_iso,
                ended_at_iso=ended_at_iso,
                duration_seconds=duration,
                transcript=transcript,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("call log write failed: %s", exc)

    ctx.add_shutdown_callback(run_post_call)
    logger.warning("=== shutdown callback registered ===")

    await session.start(
        agent=Assistant(instructions=instructions, tools=on_call_tools),
        room=ctx.room,
    )

    if first_message:
        await session.say(first_message)
    else:
        await session.generate_reply(
            instructions="Greet the caller briefly and offer your assistance.",
        )


def _extract_transcript(session: AgentSession) -> list[dict]:
    """Pull the conversation history out of the session as a list of
    `{role, text}` objects.

    LiveKit's `session.history.items` yields chat items where:
    - `item.type == "message"` for chat turns (other types like "function_call"
      are skipped).
    - `item.text_content` is a *property* (not a method) holding the joined text.
    - `item.role` is "user" / "assistant" / "system".
    """
    out: list[dict] = []
    history = getattr(session, "history", None)
    items = getattr(history, "items", None) if history is not None else None
    if not items:
        logger.info("transcript: session.history.items empty or missing")
        return out

    logger.info("transcript: extracting %d history items", len(items))
    for item in items:
        item_type = getattr(item, "type", None)
        if item_type and item_type != "message":
            continue

        role = getattr(item, "role", None)
        if role not in ("user", "assistant"):
            continue

        text = ""
        try:
            value = getattr(item, "text_content", None)
            if isinstance(value, str):
                text = value.strip()
        except Exception:  # noqa: BLE001
            pass

        if not text:
            content = getattr(item, "content", None)
            if isinstance(content, list):
                parts: list[str] = []
                for p in content:
                    if p is None:
                        continue
                    if isinstance(p, str):
                        parts.append(p)
                    else:
                        ptext = getattr(p, "text", None)
                        if ptext:
                            parts.append(str(ptext))
                text = " ".join(parts).strip()
            elif isinstance(content, str):
                text = content.strip()

        if not text:
            continue
        out.append(
            {
                "role": "user" if role == "user" else "agent",
                "text": text,
            }
        )
    return out


async def _persist_call_log(
    *,
    meta: dict,
    room: str,
    started_at_iso: str,
    ended_at_iso: str,
    duration_seconds: int,
    transcript: list[dict],
) -> None:
    """POST the call to the API. Loud about why it skipped so misconfig is
    obvious in the logs."""
    api_url = os.environ.get("API_URL")
    internal_key = os.environ.get("INTERNAL_API_KEY")
    agent_id = meta.get("agentId")

    missing = []
    if not api_url:
        missing.append("API_URL")
    if not internal_key:
        missing.append("INTERNAL_API_KEY")
    if not agent_id:
        missing.append("agentId in dispatch metadata")
    if missing:
        logger.warning(
            "call log NOT persisted — missing %s. Set them in agent/.env.local "
            "and ensure the dispatch metadata includes agentId.",
            ", ".join(missing),
        )
        return

    payload = {
        "agentId": agent_id,
        "mode": meta.get("mode") or "phone",
        "room": room,
        "startedAt": started_at_iso,
        "endedAt": ended_at_iso,
        "durationSeconds": duration_seconds,
        "transcript": transcript,
    }

    target = f"{api_url.rstrip('/')}/internal/calls"
    logger.info(
        "call log → POST %s (mode=%s, turns=%d, duration=%ds)",
        target,
        payload["mode"],
        len(transcript),
        duration_seconds,
    )

    timeout = aiohttp.ClientTimeout(total=10)
    async with aiohttp.ClientSession(timeout=timeout) as http:
        async with http.post(
            target,
            json=payload,
            headers={"Authorization": f"Bearer {internal_key}"},
        ) as resp:
            body = await resp.text()
            if resp.status >= 400:
                logger.warning("call log POST %s: %s", resp.status, body[:500])
            else:
                logger.info("call log POST %s OK", resp.status)


if __name__ == "__main__":
    cli.run_app(server)
