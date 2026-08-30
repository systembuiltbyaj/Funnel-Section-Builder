/**
 * Which model writes the HTML, and how to talk to it.
 *
 * Two providers, chosen by which key is present. Groq is the default because
 * it is free and — the reason that matters here — roughly five times faster.
 *
 * Measured on this project's own sections:
 *
 *   provider              tokens/sec   4,500-token section
 *   groq  llama-3.3-70b       ~460        ~10s
 *   anthropic  sonnet-5        ~95        ~47s
 *
 * Vercel Hobby kills a function at 60s. At Sonnet's rate a list-heavy section
 * (FAQ) landed between 34s and 43s and truncated intermittently; at Groq's rate
 * the same work has roughly six times the headroom. Speed is not a nice-to-have
 * in this architecture, it is what makes per-section generation viable at all.
 *
 * Anthropic remains supported for output quality: set ANTHROPIC_API_KEY and no
 * GROQ_API_KEY, or force it with GENERATION_PROVIDER=anthropic.
 *
 * Pure functions — no fetch here — so the request shaping is unit-testable.
 */

export type Provider = "groq" | "anthropic";

export type ProviderConfig = {
  provider: Provider;
  apiKey: string;
  model: string;
  /** Doubles as a latency budget: tokens ÷ rate must stay under the ceiling. */
  maxOutputTokens: number;
  /**
   * How much pasted page the analyzer will accept, in characters.
   *
   * Provider-derived because it is set by the per-minute token budget, not by
   * anything about the page. Measured on this catalogue: the fixed part of an
   * analyze request is ~4,350 tokens (3,992 of it the 110-variation catalogue)
   * plus a 1,200-token reply ceiling. On Groq's free 8,000/min that leaves
   * ~2,450 tokens — hence 9,000 characters. Anthropic's budget is far larger,
   * so the same arithmetic allows an order of magnitude more.
   */
  analyzeCopyMax: number;
  /**
   * Output ceiling for the analyzer, which is NOT just "enough for the reply".
   *
   * claude-sonnet-5 thinks by default and **thinking tokens are billed against
   * `max_tokens`**. Measured on a 9,900-token analyze request: at a 1,200
   * ceiling it spent all 1,200 thinking, emitted zero text blocks, and came
   * back with `stop_reason: "max_tokens"` — a silent empty reply, not an error.
   * At 4,000 it used 1,552 thinking + ~490 text and answered correctly.
   *
   * Groq's ceiling is small for the opposite reason: it counts `max_tokens`
   * against the per-minute budget up front, so a generous ceiling there is what
   * trips the rate limit.
   */
  analyzeMaxOutputTokens: number;
};

/**
 * gpt-oss-120b, not llama-3.3-70b. Both are free and fast on Groq, but llama
 * did not hold the design contract: it set light section backgrounds on a dark
 * page and emitted placeholder tokens like BG_IMAGE as real CSS urls. Coherence
 * is the whole point of the token block, so instruction-following matters more
 * here than raw speed — and both models have speed to spare.
 */
const GROQ_MODEL = "openai/gpt-oss-120b";
const ANTHROPIC_MODEL = "claude-sonnet-5";

export type Env = Record<string, string | undefined>;

const GROQ: Omit<ProviderConfig, "apiKey"> = {
  provider: "groq",
  model: GROQ_MODEL,
  maxOutputTokens: 6_000,
  analyzeCopyMax: 9_000,
  analyzeMaxOutputTokens: 1_200,
};

const ANTHROPIC: Omit<ProviderConfig, "apiKey"> = {
  provider: "anthropic",
  model: ANTHROPIC_MODEL,
  maxOutputTokens: 4_500,
  analyzeCopyMax: 90_000,
  analyzeMaxOutputTokens: 6_000,
};

/**
 * Which job the provider is being resolved for.
 *
 * They are separable because their constraints differ. Generation is bound by
 * the 60s function ceiling — Anthropic produces the better page but was
 * measured at 34-43s for FAQ-class sections, truncating intermittently, which
 * is why the free-and-fast provider is the default there. Analysis has no such
 * pressure (its reply is a few hundred tokens) and is instead bound by how much
 * page it can accept, where Anthropic's larger budget wins outright.
 */
export type ProviderRole = "generation" | "analysis";

/**
 * Resolve the provider for a job, or null when nothing is configured (the
 * caller then returns 503 and the UI falls back to copying the prompt).
 *
 * `ANALYZE_PROVIDER` overrides `GENERATION_PROVIDER` for analysis only, so a
 * deployment can pay for big-paste analysis while keeping generation free.
 */
export function pickProvider(env: Env, role: ProviderRole = "generation"): ProviderConfig | null {
  const override = role === "analysis" ? env.ANALYZE_PROVIDER?.trim().toLowerCase() : undefined;
  const forced = override || env.GENERATION_PROVIDER?.trim().toLowerCase();
  const groqKey = env.GROQ_API_KEY?.trim();
  const anthropicKey = env.ANTHROPIC_API_KEY?.trim();

  if (forced === "anthropic" && anthropicKey) return { ...ANTHROPIC, apiKey: anthropicKey };
  if (forced === "groq" && groqKey) return { ...GROQ, apiKey: groqKey };
  // Unforced: prefer the free, fast one.
  if (groqKey) return { ...GROQ, apiKey: groqKey };
  if (anthropicKey) return { ...ANTHROPIC, apiKey: anthropicKey };
  return null;
}

export type ProviderRequest = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

/**
 * Per-call overrides. Generation wants a little warmth; classification wants
 * near-determinism and a parseable object.
 *
 * `json` is a Groq-only hint — Anthropic's Messages API has no
 * `response_format`, so a JSON reply there is secured by the system prompt
 * instead. Callers must not assume the flag alone guarantees valid JSON.
 */
export type ProviderOptions = {
  temperature?: number;
  json?: boolean;
  /**
   * Override the config's output ceiling.
   *
   * Groq bills `max_tokens` against the per-minute token budget up front, as
   * part of the *request* size — so asking for a generation-sized ceiling on a
   * call that replies with three lines is what trips the limit, not the reply.
   * Classification passes a small number here.
   */
  maxOutputTokens?: number;
};

export function buildProviderRequest(
  config: ProviderConfig,
  args: { system: string; prompt: string },
  options: ProviderOptions = {}
): ProviderRequest {
  const { system, prompt } = args;
  // Low but not zero: layout benefits from a little variety, structure does not.
  const temperature = options.temperature ?? 0.4;
  const maxTokens = options.maxOutputTokens ?? config.maxOutputTokens;

  if (config.provider === "groq") {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        temperature,
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    };
  }

  // No `temperature`: claude-sonnet-5 rejects the request outright with
  // "`temperature` is deprecated for this model". Sampling is left at the
  // model's default and the JSON shape is enforced by the system prompt, which
  // is the only lever that works on both providers anyway.
  return {
    url: "https://api.anthropic.com/v1/messages",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  };
}

/** Pull the text out of either provider's response shape. */
export function parseProviderReply(provider: Provider, json: unknown): string {
  if (typeof json !== "object" || json === null) return "";

  if (provider === "groq") {
    const choices = (json as { choices?: Array<{ message?: { content?: string } }> }).choices;
    return choices?.[0]?.message?.content ?? "";
  }

  const content = (json as { content?: Array<{ type?: string; text?: string }> }).content;
  return (content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

/**
 * How long to wait after a 429, in seconds.
 *
 * Groq's free tier is capped on tokens-per-minute (12,000 at time of writing)
 * and reports the bucket refill in `x-ratelimit-reset-tokens` as a duration
 * like "13.075s" or "1m30s". Standard `retry-after` is preferred when present.
 *
 * Returns a clamped value: never 0 (which would busy-loop) and never longer
 * than a minute (past which the user should be told to come back, not spun on).
 */
export function parseRetryAfterSeconds(
  header: (name: string) => string | null | undefined
): number {
  const plain = header("retry-after");
  if (plain) {
    const seconds = Number(plain.trim());
    if (Number.isFinite(seconds) && seconds > 0) return clampWait(seconds);
  }

  const reset = header("x-ratelimit-reset-tokens") ?? header("x-ratelimit-reset-requests");
  if (reset) {
    const match = reset.trim().match(/^(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/);
    if (match && (match[1] || match[2])) {
      const minutes = Number(match[1] ?? 0);
      const seconds = Number(match[2] ?? 0);
      const total = minutes * 60 + seconds;
      if (total > 0) return clampWait(total);
    }
  }

  // Nothing usable: the token bucket refills on a ~60s window, so a short
  // wait is the right guess rather than an immediate retry.
  return 15;
}

function clampWait(seconds: number): number {
  return Math.min(60, Math.max(2, Math.ceil(seconds)));
}

/**
 * Did the provider refuse this call because of a token rate limit?
 *
 * Groq does NOT always answer with 429. When the request itself (prompt +
 * `max_tokens`) exceeds the per-minute budget it replies **413** with
 * `code: "rate_limit_exceeded"` — a distinction worth honouring, because a
 * rate limit is recoverable by waiting and a genuine 413 is not. Treating the
 * 413 as a hard failure tells the user the service is broken when it is merely
 * busy.
 */
export function isTokenRateLimit(status: number, body: string): boolean {
  if (status === 429) return true;
  if (status !== 413) return false;
  return /rate_limit_exceeded|tokens per minute|TPM/i.test(body);
}
