# Timbre Agent

The voice AI agent service for Timbre. Built with [LiveKit Agents for Python](https://github.com/livekit/agents) and deployed to [LiveKit Cloud](https://cloud.livekit.io/).

Sits alongside:

- `../frontend` — Next.js dashboard for clients
- `../api` — Hono API

This service owns all voice-agent tasks (STT/LLM/TTS pipeline, turn detection, noise cancellation, inbound/outbound calls once SIP is wired up).

## Setup

1. Install [uv](https://docs.astral.sh/uv/getting-started/installation/).
2. Install dependencies:

   ```bash
   uv sync
   ```

3. Copy `.env.example` to `.env.local` and fill in:

   - `LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`

   Or, with the [LiveKit CLI](https://docs.livekit.io/intro/basics/cli/):

   ```bash
   lk cloud auth
   lk app env -w -d .env.local
   ```

4. Download model files (Silero VAD, turn detector, etc.):

   ```bash
   uv run python src/agent.py download-files
   ```

## Run

- Terminal console (talk to it directly from the shell):

  ```bash
  uv run python src/agent.py console
  ```

- Dev mode (for use with the frontend or telephony):

  ```bash
  uv run python src/agent.py dev
  ```

- Production:

  ```bash
  uv run python src/agent.py start
  ```

## Tests

```bash
uv run pytest
```

## Deploy

Deploy to LiveKit Cloud from this directory:

```bash
lk agent create
```

See the [deployment guide](https://docs.livekit.io/deploy/agents/) for details.
