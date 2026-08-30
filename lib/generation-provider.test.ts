import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pickProvider,
  buildProviderRequest,
  parseProviderReply,
  parseRetryAfterSeconds,
} from "./generation-provider.ts";

// --- selection -----------------------------------------------------------

test("nothing configured yields null, so the route can fall back to the prompt", () => {
  assert.equal(pickProvider({}), null);
  assert.equal(pickProvider({ GROQ_API_KEY: "", ANTHROPIC_API_KEY: "  " }), null);
});

test("the free, fast provider wins when both keys are present", () => {
  const c = pickProvider({ GROQ_API_KEY: "g", ANTHROPIC_API_KEY: "a" });
  assert.equal(c?.provider, "groq", "Groq is ~5x faster, which is what fits the 60s ceiling");
});

test("anthropic is used when it is the only key", () => {
  assert.equal(pickProvider({ ANTHROPIC_API_KEY: "a" })?.provider, "anthropic");
});

test("an explicit override beats the default preference", () => {
  const c = pickProvider({ GENERATION_PROVIDER: "anthropic", GROQ_API_KEY: "g", ANTHROPIC_API_KEY: "a" });
  assert.equal(c?.provider, "anthropic");
});

test("an override without its key falls through rather than failing at request time", () => {
  const c = pickProvider({ GENERATION_PROVIDER: "anthropic", GROQ_API_KEY: "g" });
  assert.equal(c?.provider, "groq");
});

test("each provider carries a token budget sized to its own speed", () => {
  const groq = pickProvider({ GROQ_API_KEY: "g" })!;
  const anthropic = pickProvider({ ANTHROPIC_API_KEY: "a" })!;
  assert.ok(
    groq.maxOutputTokens > anthropic.maxOutputTokens,
    "the faster provider can afford a larger section inside the same wall-clock budget"
  );
});

// --- request shaping -----------------------------------------------------

test("the groq request uses the chat-completions shape with a system message", () => {
  const cfg = pickProvider({ GROQ_API_KEY: "secret-groq" })!;
  const req = buildProviderRequest(cfg, { system: "SYS", prompt: "USER" });
  assert.ok(req.url.includes("api.groq.com"));
  assert.equal(req.headers.authorization, "Bearer secret-groq");
  const body = JSON.parse(req.body);
  assert.equal(body.messages[0].role, "system");
  assert.equal(body.messages[0].content, "SYS");
  assert.equal(body.messages[1].content, "USER");
  assert.equal(body.max_tokens, cfg.maxOutputTokens);
});

test("the anthropic request uses the messages shape with a top-level system field", () => {
  const cfg = pickProvider({ ANTHROPIC_API_KEY: "secret-anthropic" })!;
  const req = buildProviderRequest(cfg, { system: "SYS", prompt: "USER" });
  assert.ok(req.url.includes("api.anthropic.com"));
  assert.equal(req.headers["x-api-key"], "secret-anthropic");
  assert.equal(req.headers["anthropic-version"], "2023-06-01");
  const body = JSON.parse(req.body);
  assert.equal(body.system, "SYS");
  assert.equal(body.messages[0].role, "user");
  assert.equal(body.messages.length, 1, "anthropic takes no system message in the array");
});

test("the api key never appears anywhere but the headers", () => {
  for (const env of [{ GROQ_API_KEY: "leaky" }, { ANTHROPIC_API_KEY: "leaky" }]) {
    const cfg = pickProvider(env)!;
    const req = buildProviderRequest(cfg, { system: "s", prompt: "p" });
    assert.ok(!req.body.includes("leaky"), `${cfg.provider}: key must not reach the body`);
    assert.ok(!req.url.includes("leaky"), `${cfg.provider}: key must not reach the url`);
  }
});

// --- reply parsing -------------------------------------------------------

test("groq replies are read from choices[0].message.content", () => {
  const reply = { choices: [{ message: { content: "<section>hi</section>" } }] };
  assert.equal(parseProviderReply("groq", reply), "<section>hi</section>");
});

test("anthropic replies concatenate only the text parts", () => {
  const reply = {
    content: [
      { type: "text", text: "<section>" },
      { type: "thinking", text: "ignore me" },
      { type: "text", text: "hi</section>" },
    ],
  };
  assert.equal(parseProviderReply("anthropic", reply), "<section>hi</section>");
});

test("a malformed reply yields an empty string rather than throwing", () => {
  for (const junk of [null, undefined, 42, "text", {}, { choices: [] }, { content: null }]) {
    assert.equal(parseProviderReply("groq", junk), "");
    assert.equal(parseProviderReply("anthropic", junk), "");
  }
});

// --- rate-limit backoff --------------------------------------------------

function headers(map: Record<string, string>) {
  return (name: string) => map[name.toLowerCase()] ?? null;
}

test("a standard retry-after in seconds is used directly", () => {
  assert.equal(parseRetryAfterSeconds(headers({ "retry-after": "20" })), 20);
});

test("groq's duration format is parsed, seconds and minutes both", () => {
  assert.equal(parseRetryAfterSeconds(headers({ "x-ratelimit-reset-tokens": "13.075s" })), 14);
  assert.equal(parseRetryAfterSeconds(headers({ "x-ratelimit-reset-tokens": "1m30s" })), 60, "90s clamps to the 60s ceiling");
  assert.equal(parseRetryAfterSeconds(headers({ "x-ratelimit-reset-requests": "4m19.2s" })), 60);
});

test("retry-after wins over the vendor header when both are present", () => {
  assert.equal(
    parseRetryAfterSeconds(headers({ "retry-after": "5", "x-ratelimit-reset-tokens": "45s" })),
    5
  );
});

test("the wait is clamped so it can never busy-loop or hang for ever", () => {
  assert.equal(parseRetryAfterSeconds(headers({ "retry-after": "0" })), 15, "zero is not usable");
  assert.equal(parseRetryAfterSeconds(headers({ "retry-after": "-5" })), 15);
  assert.equal(parseRetryAfterSeconds(headers({ "x-ratelimit-reset-tokens": "0.4s" })), 2);
  assert.equal(parseRetryAfterSeconds(headers({ "retry-after": "9999" })), 60);
});

test("junk or missing headers fall back to a sane short wait", () => {
  assert.equal(parseRetryAfterSeconds(headers({})), 15);
  assert.equal(parseRetryAfterSeconds(headers({ "retry-after": "soon" })), 15);
  assert.equal(parseRetryAfterSeconds(headers({ "x-ratelimit-reset-tokens": "nonsense" })), 15);
});

test("groq asks for a strict JSON object when json mode is on", () => {
  const config = { provider: "groq", apiKey: "k", model: "m", maxOutputTokens: 100 } as const;
  const req = buildProviderRequest(config, { system: "s", prompt: "p" }, { json: true, temperature: 0.2 });
  const body = JSON.parse(req.body);
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(body.temperature, 0.2);
});

test("anthropic honours temperature but carries no response_format", () => {
  const config = { provider: "anthropic", apiKey: "k", model: "m", maxOutputTokens: 100 } as const;
  const req = buildProviderRequest(config, { system: "s", prompt: "p" }, { json: true, temperature: 0.2 });
  const body = JSON.parse(req.body);
  assert.equal(body.temperature, 0.2);
  assert.equal("response_format" in body, false);
});

test("omitting options leaves the generation defaults untouched", () => {
  const config = { provider: "groq", apiKey: "k", model: "m", maxOutputTokens: 100 } as const;
  const body = JSON.parse(buildProviderRequest(config, { system: "s", prompt: "p" }).body);
  assert.equal(body.temperature, 0.4);
  assert.equal("response_format" in body, false);
});
