import type { ReactNode } from "react";
import {
  LandingCall,
  LandingCallTrigger,
} from "@/components/landing-call";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <AmbientBackground />
      <SiteNav />
      <main className="relative flex-1">
        <Hero />
        <StatsStrip />
        <Features />
        <HowItWorks />
        <CallToAction />
      </main>
      <SiteFooter />
      <LandingCall />
    </div>
  );
}

function AmbientBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full blur-3xl ambient-orb"
        style={{
          background:
            "radial-gradient(circle at center, rgba(255,157,92,0.22) 0%, rgba(255,157,92,0.06) 40%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute top-[40%] right-[-10%] h-[500px] w-[500px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, rgba(140,180,255,0.08) 0%, transparent 65%)",
        }}
      />
    </>
  );
}

function SiteNav() {
  return (
    <header className="relative z-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#demo" className="transition-colors hover:text-foreground">
            Demo
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="hidden text-sm text-muted transition-colors hover:text-foreground sm:inline-block"
          >
            Sign in
          </a>
          <a
            href="/signup"
            className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-accent-soft"
          >
            Start building
          </a>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <a href="/" className="flex items-center gap-2">
      <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-surface-2 ring-1 ring-border">
        <Waveform size="sm" />
      </span>
      <span className="text-lg font-semibold tracking-tight">Timbre</span>
    </a>
  );
}

function Waveform({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const bars = size === "lg" ? 24 : size === "md" ? 12 : 5;
  const heights = [10, 18, 26, 16, 22, 30, 14, 20, 28, 12, 24, 18];
  const max = size === "lg" ? 80 : size === "md" ? 40 : 14;
  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({ length: bars }).map((_, i) => {
        const h = heights[i % heights.length];
        const scaled = (h / 30) * max;
        return (
          <span
            key={i}
            className="wave-bar inline-block rounded-full bg-accent"
            style={{
              width: size === "lg" ? 4 : size === "md" ? 3 : 2,
              height: scaled,
              animationDelay: `${(i * 120) % 1400}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

function Hero() {
  return (
    <section className="relative" id="demo">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-20 pb-24 text-center md:pt-28 md:pb-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs tracking-wide text-muted backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          Live demo &mdash; click below to talk to a Timbre agent
        </span>

        <h1 className="mt-8 max-w-4xl text-5xl leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          A voice agent on{" "}
          <span className="font-serif italic text-accent">your website</span>.
          <br className="hidden sm:block" />
          One line of{" "}
          <span className="font-serif italic text-accent-soft">script</span>.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Timbre turns a single <code className="font-mono text-sm">&lt;script&gt;</code> tag into
          a full voice conversation in your visitor&rsquo;s browser. Bring your
          own prompt, pick a voice, plug in MCP servers and HTTP tools — your
          agent answers in &lt;500ms.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <LandingCallTrigger className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-background transition hover:bg-accent-soft">
            <PhoneIcon />
            Talk to our agent
          </LandingCallTrigger>
          <a
            href="/signup"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-border-strong px-6 text-sm font-medium text-foreground transition hover:bg-surface"
          >
            Start building free
            <ArrowIcon />
          </a>
        </div>

        <p className="mt-6 text-xs text-muted-2">
          No credit card &middot; First 1,000 minutes on us
        </p>

        <div className="relative mt-20 w-full max-w-4xl">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-4 rounded-[2rem] blur-2xl"
        style={{
          background:
            "linear-gradient(120deg, rgba(255,157,92,0.18), rgba(255,157,92,0) 40%, rgba(140,180,255,0.1) 70%, rgba(255,157,92,0) 100%)",
        }}
      />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-surface/80 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex items-center justify-between border-b border-border px-5 py-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
            <span className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
            <span className="h-2 w-2 rounded-full bg-[#28c840]" />
            <span className="ml-3 font-mono text-muted-2">
              acme.com
            </span>
          </div>
          <span className="hidden font-mono text-muted-2 sm:inline">
            timbre embed widget
          </span>
        </div>

        <div className="grid gap-0 sm:grid-cols-[1.1fr_1fr]">
          <div className="border-b border-border p-6 sm:border-b-0 sm:border-r">
            <div className="text-xs uppercase tracking-wider text-muted-2">
              Live web call
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-accent/10 text-accent ring-1 ring-accent/30">
                <PhoneIcon />
              </div>
              <div>
                <div className="text-sm font-medium">
                  Visitor &middot; Bella (Cartesia)
                </div>
                <div className="font-mono text-xs text-muted-2">
                  WebRTC &middot; en
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-4 text-sm">
              <Bubble who="Visitor">
                Hey, what does Timbre actually do?
              </Bubble>
              <Bubble who="Bella" accent>
                We turn one script tag into a live voice agent on your site &mdash;
                speech, tools, MCP, the works. Want me to show you the embed
                snippet?
              </Bubble>
              <Bubble who="Visitor">
                Yeah, drop it.
              </Bubble>
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3">
              <Waveform size="lg" />
              <span className="ml-auto font-mono text-[10px] text-muted-2">
                sonic-3 &middot; 320ms
              </span>
            </div>
          </div>

          <div className="p-6">
            <div className="text-xs uppercase tracking-wider text-muted-2">
              Embed snippet
            </div>
            <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background/70 px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground/80">
{`<script
  src="https://app.timbre.app/embed.js"
  data-key="pk_live_..."
  async
></script>`}
            </pre>
            <div className="mt-5 text-xs uppercase tracking-wider text-muted-2">
              On-call tools
            </div>
            <ul className="mt-3 space-y-2 font-mono text-xs">
              <ToolRow name="lookup_order(id)" ok />
              <ToolRow name="mcp:zapier.send_email" ok />
              <ToolRow name="book_meeting(time)" pending />
            </ul>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5 text-center">
              <Stat label="Voices" value="50+" />
              <Stat label="Latency" value="<500ms" />
              <Stat label="MCP" value="native" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  children,
  who,
  accent = false,
}: {
  children: ReactNode;
  who: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-2">
        {who}
      </div>
      <div
        className={
          accent
            ? "rounded-2xl rounded-tl-sm border border-accent/30 bg-accent/10 px-4 py-3 text-foreground"
            : "rounded-2xl rounded-tl-sm border border-border bg-background/60 px-4 py-3 text-muted"
        }
      >
        {children}
      </div>
    </div>
  );
}

function ToolRow({
  name,
  ok = false,
  pending = false,
}: {
  name: string;
  ok?: boolean;
  pending?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 text-muted">
      <span
        className={
          ok
            ? "h-1.5 w-1.5 rounded-full bg-emerald-400"
            : pending
              ? "h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
              : "h-1.5 w-1.5 rounded-full bg-muted-2"
        }
      />
      <span className="truncate">{name}</span>
      <span className="ml-auto text-[10px] text-muted-2">
        {ok ? "200 OK" : pending ? "…" : ""}
      </span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-semibold tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-2">
        {label}
      </div>
    </div>
  );
}

function StatsStrip() {
  const items = [
    { k: "<500ms", v: "voice-to-voice" },
    { k: "50+", v: "Cartesia voices" },
    { k: "Multi", v: "lingual STT" },
    { k: "MCP", v: "native tools" },
  ];
  return (
    <section className="relative border-y border-border bg-surface/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.v} className="text-center md:text-left">
            <div className="font-serif text-3xl italic tracking-tight text-foreground">
              {i.k}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-2">
              {i.v}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="relative">
      <div className="mx-auto max-w-6xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-accent">
            What ships today
          </div>
          <h2 className="mt-4 text-4xl leading-tight tracking-tight sm:text-5xl">
            Voice that talks to your{" "}
            <span className="font-serif italic text-accent-soft">stack</span>.
          </h2>
          <p className="mt-5 text-lg text-muted">
            Embed on any site, attach your tools, ship in an afternoon. Phone
            number routing comes next.
          </p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2">
          <FeatureCard
            icon={<EmbedIcon />}
            title="Embed widget"
            tagline="One script tag. That&rsquo;s it."
            description="Drop a single script onto any page and visitors get a floating call bubble. Per-agent public key, allowed-origin allowlist, theming you control from the dashboard."
            bullets={[
              "Custom button shape, color, icon",
              "Per-key concurrent + daily quotas",
              "Live transcripts streamed back to you",
            ]}
          />
          <FeatureCard
            icon={<MCPIcon />}
            title="MCP-native"
            tagline="Plug in your stack."
            description="Attach any MCP server &mdash; Zapier, Linear, your own &mdash; and its tools appear automatically inside the agent. Per-agent scoping, encrypted headers at rest."
            bullets={[
              "HTTP & SSE transports, auto-detected",
              "Encrypted Authorization headers",
              "Tools resolve at dispatch, not at build time",
            ]}
          />
          <FeatureCard
            icon={<HookIcon />}
            title="Lifecycle hooks"
            tagline="Pre-call. On-call. Post-call."
            description="Define HTTP tools that fire at each phase. Pull caller context before the agent speaks, expose tools for the LLM to call mid-conversation, hand off transcripts to your CRM after hangup."
            bullets={[
              "Mustache-style {{var}} templating",
              "JSON-Schema params for on-call tools",
              "Headers + body templates encrypted at rest",
            ]}
          />
          <FeatureCard
            icon={<VoiceIcon />}
            title="Voices & emotion"
            tagline="Sound human, on purpose."
            description="50+ Cartesia voices in dozens of languages, dynamic SSML emotion based on caller sentiment, multilingual auto-detection via Deepgram nova-3."
            bullets={[
              "Cartesia sonic-3 TTS",
              "Deepgram nova-3 multilingual STT",
              "Emotion / speed / volume picked per turn",
            ]}
          />
        </div>

        <div className="mt-10 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-5 py-4 text-center">
          <p className="text-sm text-amber-300">
            <span className="mr-2 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-200">
              Soon
            </span>
            Inbound &amp; outbound phone calling via your own SIP / Twilio
            trunk &mdash;{" "}
            <a href="/signup" className="underline">
              join the waitlist
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  tagline,
  description,
  bullets,
}: {
  icon: ReactNode;
  title: string;
  tagline: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface/60 p-7 transition hover:border-border-strong hover:bg-surface">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle at center, rgba(255,157,92,0.35), transparent 70%)",
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-background ring-1 ring-border text-accent">
            {icon}
          </div>
          <div>
            <div className="text-sm font-medium">{title}</div>
            <div className="font-serif text-sm italic text-muted">
              {tagline}
            </div>
          </div>
        </div>
        <p className="mt-5 text-[15px] leading-relaxed text-muted">
          {description}
        </p>
        <ul className="mt-5 space-y-2 text-sm text-foreground/90">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <CheckIcon />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Create an agent",
      body: "Pick a Cartesia voice, write a system prompt and first message, choose a language (or let multi auto-detect).",
    },
    {
      n: "02",
      title: "Attach tools",
      body: "Connect MCP servers and define HTTP tools for pre-call context, on-call functions, and post-call webhooks.",
    },
    {
      n: "03",
      title: "Embed",
      body: "Toggle Embed on the agent, allowlist your domains, and drop the snippet onto your site. Visitors talk to your agent in their browser.",
    },
  ];
  return (
    <section id="how" className="relative">
      <div className="mx-auto max-w-6xl px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-accent">
            How it works
          </div>
          <h2 className="mt-4 text-4xl leading-tight tracking-tight sm:text-5xl">
            From prompt to{" "}
            <span className="font-serif italic text-accent-soft">live call</span>{" "}
            in minutes.
          </h2>
        </div>
        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <li
              key={s.n}
              className="rounded-2xl border border-border bg-surface/40 p-6"
            >
              <div className="font-serif text-3xl italic text-accent/80">
                {s.n}
              </div>
              <div className="mt-3 text-base font-medium">{s.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section id="start" className="relative">
      <div className="mx-auto max-w-6xl px-6 pb-28">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/80 px-8 py-16 text-center md:px-16 md:py-20">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at top, rgba(255,157,92,0.2) 0%, transparent 55%)",
            }}
          />
          <div className="relative">
            <h3 className="mx-auto max-w-2xl text-4xl leading-tight tracking-tight sm:text-5xl">
              Hear it before you{" "}
              <span className="font-serif italic text-accent">build</span> it.
            </h3>
            <p className="mx-auto mt-5 max-w-xl text-muted">
              Click below to talk to a real Timbre agent running this exact
              stack. Then go ship one yourself.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <LandingCallTrigger className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-background transition hover:bg-accent-soft">
                <PhoneIcon />
                Talk to our agent
              </LandingCallTrigger>
              <a
                href="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-border-strong px-6 text-sm font-medium text-foreground transition hover:bg-surface-2"
              >
                Create an account
                <ArrowIcon />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="relative border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden text-xs text-muted-2 md:inline">
            &copy; {new Date().getFullYear()} Timbre Labs, Inc.
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-muted sm:grid-cols-3">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#how" className="hover:text-foreground">
            How it works
          </a>
          <a href="#demo" className="hover:text-foreground">
            Demo
          </a>
          <a href="/login" className="hover:text-foreground">
            Sign in
          </a>
          <a href="/signup" className="hover:text-foreground">
            Start free
          </a>
        </div>
      </div>
    </footer>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
    >
      <path
        d="M3 7h8M8 4l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="mt-1 shrink-0 text-accent"
      aria-hidden
    >
      <path
        d="M3 7.5l2.5 2.5L11 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.2 4.1c.5-1.1 1.7-1.8 2.9-1.6l.5.1c.6.1 1 .6 1.1 1.2l.3 1.6c.1.5-.1 1-.5 1.3l-.8.6c.7 1.4 1.8 2.5 3.2 3.2l.6-.8c.3-.4.8-.6 1.3-.5l1.6.3c.6.1 1 .5 1.2 1.1l.1.5c.2 1.2-.5 2.4-1.6 2.9-3.4 1.4-7.3-.6-8.7-4-.9-2.1-.8-3.7-.2-4.9z"
        fill="currentColor"
      />
    </svg>
  );
}

function EmbedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M7 5l-4 5 4 5M13 5l4 5-4 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MCPIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="2.5"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="11.5"
        y="2.5"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="7"
        y="11.5"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M5.5 8.5v1.5M14.5 8.5v1.5M10 11.5v-1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3 5h4l2 2h8M3 10h14M3 15h8l2-2h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3 8v4M6 6v8M9 4v12M12 6v8M15 8v4M18 9v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
