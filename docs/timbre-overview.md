# Timbre — Product Description

This document is meant to be uploaded into Timbre's own demo knowledge base so the landing-page voice agent can answer visitor questions accurately. It's written so each section stands alone, since RAG chunks documents at ~800-character boundaries and retrieves them out of order.

---

## What Timbre is

Timbre is a voice AI platform that turns a single line of script into a working voice agent on any website. You write a prompt, pick a voice, optionally upload your docs and connect your tools — and Timbre gives you a ready-to-paste embed snippet. Visitors to your site click a button, talk to the agent in their browser over WebRTC, and get an answer in under 500 milliseconds.

The tagline is: *A voice agent on your website. One line of script.*

Timbre is for SaaS teams, e-commerce stores, support orgs, and indie builders who want to put a real conversational voice agent on their product without dealing with telephony providers, signal routing, glue code, or learning a new framework. It's built and operated by a small team and runs on an open, modern stack.

---

## What you can do with Timbre today

Today you can:

1. Create a voice agent with a custom system prompt, first message, objective, response guidelines, and conversation script.
2. Pick from 50+ Cartesia voices in dozens of languages, with multilingual auto-detection if you don't want to commit to one language.
3. Upload PDFs, plain text, and Markdown files into knowledge bases, attach them to one or more agents, and the agent will answer using your documents (vector RAG via pgvector).
4. Connect MCP servers (Zapier, Linear, your own) and expose all their tools to the agent automatically.
5. Define HTTP tools that fire at three different points in a call: pre-call (fetch context before greeting), on-call (LLM-callable functions), and post-call (webhooks for CRM logging).
6. Embed a voice widget on any website with a single `<script>` tag — fully themeable (color, shape, label, position, custom SVG icon).
7. Test-call your agent from the dashboard before going live.
8. Browse every call's full transcript, filtered by mode (test / embed / demo / phone) and agent.
9. See dashboard metrics: total calls, minutes, avg duration, daily activity, top agents, mode breakdown.

---

## What's coming soon

Phone calling — both inbound (visitors call your number) and outbound (the agent dials out) via your own SIP or Twilio trunk — is currently marked "Coming soon" in the dashboard. The infrastructure is built (per-number LiveKit inbound trunks, dispatch rules, Twilio driver), but it's gated until we open it to early customers. Multi-prompt agents with handoffs and task workflows are also coming soon.

For now, every conversation happens in the visitor's browser over WebRTC. No phone number needed.

---

## How the embed widget works

The embed widget is the headline product. The pattern is the same as Intercom or Vapi: you drop a single script tag onto your website, like this:

```
<script src="https://app.timbre.app/embed.js" data-key="pk_..." async></script>
```

That script injects an iframe in the bottom-right corner of your page (or wherever you configured). When a visitor clicks the button, a popup opens, the visitor grants microphone access, and a WebRTC connection is established to your agent. They have a real voice conversation — no phone, no app, no signup.

You configure each agent's embed independently with a public key, an allowed-origins allowlist (so only domains you authorize can use the embed), and abuse caps (max concurrent calls, daily call quota). Theming is full: button label, accent color, button shape (circle or pill), corner position, greeting text, and even a custom SVG icon.

You can rotate the public key from the dashboard if it leaks. Old keys stop working immediately.

---

## How knowledge bases work

A knowledge base is a named collection of documents that an agent can search during a call. You upload PDFs, plain text, or Markdown files (up to 20 MB each). Timbre extracts the text page-by-page using LangChain's PDF loader, splits it into ~800-character chunks at paragraph and sentence boundaries, embeds each chunk with OpenAI's `text-embedding-3-small` model (1536 dimensions), and stores them in a Postgres table with a pgvector HNSW index for fast cosine-similarity search.

When a knowledge base is attached to an agent, Timbre exposes a `search_knowledge_base(query)` tool to the LLM. The agent's system prompt explicitly tells it to use this tool whenever the user asks something specific or factual that the agent doesn't already know with certainty. Don't guess — search first. If the search returns nothing useful, only then say you don't have that information.

Knowledge bases are a shared library. You can attach the same KB to many agents (e.g. a "Product docs" KB powering both your support agent and your sales-qualification agent). The original uploaded file is discarded after extraction; only the chunks and embeddings persist.

---

## How MCP support works

MCP (Model Context Protocol) is the standard interface for connecting LLMs to external tools and data. Timbre treats it as a first-class integration: you paste your MCP server's URL, optionally add an authorization header, and every tool the server exposes becomes available to the agent during calls automatically.

Tool discovery happens at dispatch time. The agent's LLM sees the MCP tools alongside any HTTP tools you've defined and any knowledge-base search tool. Authorization headers are encrypted at rest with AES-256-GCM using a key the operator never has to handle directly. Timbre supports HTTP and SSE transports, with auto-detection from the URL.

Common patterns: connect Zapier MCP to give the agent access to thousands of integrations, point at an internal MCP server you wrote in 50 lines for your own data, or use Linear/GitHub/Notion MCPs for project-aware support.

---

## How HTTP tools work (the three phases)

Beyond MCP, Timbre lets you define plain HTTP requests as tools. Every tool has a name, description, method (GET/POST/PATCH/PUT/DELETE), URL, optional encrypted headers, optional body template, and an associated lifecycle phase. URLs, headers, and bodies all support `{{variable}}` substitution.

There are three phases:

**Pre-call** tools fire once after the call is dispatched but before the agent greets the visitor. Their output is appended to the agent's system prompt as fresh context. Use this to look up the caller's account in your CRM, pull their recent order history, or fetch any context that should shape the conversation from word one.

**On-call** tools are exposed to the LLM as callable functions. The model decides when to invoke them mid-conversation, supplies the arguments based on a JSON-Schema you provide, and the response is fed back to the LLM. Use this for things like "look up an order status", "check our inventory", "schedule a meeting".

**Post-call** tools fire after the visitor disconnects. They have access to the full transcript, duration, and call metadata. Use this to push the conversation summary to your CRM, send a Slack notification, or trigger any downstream workflow.

---

## Voices

Timbre uses Cartesia's sonic-3 model for text-to-speech, which is currently among the lowest-latency, highest-quality voice synthesis APIs available. The voice picker lets you browse 50+ voices across dozens of languages with audio previews. Each voice has a name, gender, language, and description.

The agent's system prompt automatically gets a "Persona" block based on the voice's gender so the LLM presents itself with matching pronouns and self-references. A feminine voice means the agent says "as a woman" rather than "as a man" if asked, uses she/her pronouns naturally, and stays consistent throughout the call.

Speech-to-text uses Deepgram's nova-3 model. Default language is "multi" (multilingual auto-detection), or you can pin it to a specific ISO-639-1 code (en, es, fr, hi, etc.). The agent emits SSML emotion, speed, volume, and break tags based on detected user sentiment, which Cartesia consumes for expressive playback.

---

## How a call works end-to-end

When a visitor clicks the widget button:

1. The widget calls Timbre's API to request a token. The API validates the parent origin against the agent's allowlist, checks concurrent and daily quotas, and dispatches a fresh LiveKit Agent into a new room with the agent's full configuration as metadata (prompt, voice, language, MCP servers, HTTP tools, knowledge bases). It returns a short-lived 30-second WebRTC access token.

2. The visitor's browser connects to LiveKit Cloud, joins the room, and starts streaming microphone audio. The Python agent worker also joins the room as a participant.

3. The agent runs the conversation loop: VAD detects when the visitor is speaking, Deepgram streams partial transcripts, OpenRouter (gpt-4o-mini) generates the response, and Cartesia streams the synthesized voice back over WebRTC.

4. Live transcripts of both sides stream back to the widget over LiveKit data channels and render in the popup.

5. When the visitor disconnects, the agent runs all post-call HTTP tools, captures the conversation history, and POSTs the full transcript with metadata back to the API. It's now visible in the operator's dashboard under "Calls".

---

## Tech stack

The frontend is Next.js 16 (App Router) with Tailwind v4, hosted on Vercel. Authentication is Supabase, with Google and email/password sign-in via `@supabase/ssr`. The dashboard is a single-page app with sticky tabs for each agent's settings (general, prompt, voice, knowledge, tools, embed, phone).

The API is Hono on Bun, hosted on Railway or Fly.io. It uses Drizzle ORM against Supabase Postgres (with the pgvector extension enabled for the knowledge-base feature). All routes are scoped by user ID, with cross-user access blocked at the query level. JWT verification happens server-side via JWKS against Supabase's public keys.

The agent is Python 3.14 using LiveKit Agents 1.5, deployed on LiveKit Cloud's managed agent hosting. It's stateless — every call is dispatched fresh with full context in the metadata. STT/LLM/TTS pipeline plus MCP support, function tools, and call-history capture are all built into the LiveKit Agents framework.

Real-time media runs on LiveKit Cloud (WebRTC for web, SIP for phone when telephony is enabled). The realtime transport never touches Timbre's API — it goes browser-to-LiveKit directly, which is why latency is consistently under 500ms voice-to-voice.

---

## Latency and quality

Voice-to-voice latency (visitor finishes speaking → agent starts speaking) is typically 300-500 milliseconds end-to-end. The architecture pipelines aggressively: Deepgram returns partial transcripts as the visitor talks, the LLM starts generating before the user finishes (preemptive generation, with rollback if the user keeps talking), and Cartesia streams audio frames as soon as the first tokens arrive.

Adaptive interruption detection means visitors can talk over the agent and the agent stops mid-sentence, like a real conversation. There's no "press 1 for support" feeling.

Voice quality with Cartesia sonic-3 is essentially indistinguishable from a human in casual A/B tests. The SSML emotion/speed/volume controls let the agent shift tone based on detected user sentiment — calmer when frustrated callers come in, more upbeat when curious or excited.

---

## Pricing

The free tier includes the first 1,000 minutes on the house — no credit card required to sign up. After that, Timbre bills based on call minutes plus the marginal cost of the underlying providers (Cartesia for TTS, Deepgram for STT, the LLM provider, and OpenAI for embeddings if you use knowledge bases).

The exact paid pricing isn't published yet — the platform is in early access and pricing is being finalized based on customer feedback. Anyone interested in production usage should sign up for the waitlist on the landing page.

---

## Who Timbre is for

Three primary user types:

1. **SaaS support teams** who want to deflect tier-one tickets with a voice agent that knows their docs, pulls account context from their CRM, and hands off to a human when needed.

2. **E-commerce stores** that want to add a "talk to us" bubble on every product page — order status, returns policy, sizing questions — without staffing a phone team.

3. **Indie devs and product teams** building voice-first features into their own apps and want a managed runtime for the messy parts (WebRTC, telephony when it ships, call logging, embedding) so they can focus on the prompt and tool design.

Timbre is *not* a general-purpose AI infrastructure platform. It's specifically a voice-agent product. If you want to build a chat interface or a generic LLM API, Timbre is the wrong tool.

---

## How to get started

Sign up at the landing page, create an agent (give it a name and a prompt), pick a voice from the picker, optionally upload a few documents into a knowledge base and attach it. Use the in-dashboard "Test call" button to talk to your agent and iterate on the prompt. When you're happy, enable the embed for that agent, add your website's origin to the allowlist, and copy the snippet onto your site. The whole loop — agent creation to live on your website — takes about 15 minutes.

Telephony (inbound and outbound calling via your own SIP or Twilio trunk) is the next major feature shipping. Multi-prompt agents with handoffs are after that.

The platform is still early. Feedback to the team is encouraged.

---

## Common questions visitors ask

**"What is Timbre?"** — A platform for adding voice AI agents to your website with one line of script.

**"How do I add it to my site?"** — Sign up, create an agent, enable the embed, copy the script tag, paste it on any page. Five minutes.

**"What does it cost?"** — First 1,000 minutes free, no credit card. Paid pricing coming soon.

**"Can it call phone numbers?"** — Phone calling (inbound and outbound) is coming soon. Today everything runs over WebRTC in the browser.

**"Does it support my language?"** — Yes — 50+ Cartesia voices across dozens of languages, plus multilingual auto-detection on the speech-to-text side.

**"Can it use my company's docs?"** — Yes. Upload PDFs, text, or Markdown into a knowledge base, attach it to your agent, and the agent will search it whenever a visitor asks something the docs would answer.

**"Can it call my APIs?"** — Yes. Define HTTP tools at one of three call phases (before, during, after) and the agent will call them with templated variables.

**"Does it support MCP?"** — Yes. Paste your MCP server URL and its tools become available to the agent automatically.

**"How fast is it?"** — Typically 300-500 milliseconds voice-to-voice, which feels indistinguishable from a real conversation.

**"How do I see what visitors said?"** — Every call is logged with a full transcript in the dashboard's Calls section.

**"Is it open source?"** — No, Timbre is a hosted commercial product. The agent runtime under the hood is built on LiveKit Agents (open source).

**"Where is it hosted?"** — Frontend on Vercel, API on Railway, agent on LiveKit Cloud, database on Supabase.
