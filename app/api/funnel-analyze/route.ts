import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const COOKIE_NAME = "private_tool_auth";

const MAX_COPY = 9000;
const MAX_CATALOG = 14000;

type CatalogVariation = { number: string; title: string; description: string; funnelTypes?: string[] };
type CatalogGroup = { id: string; label: string; variations: CatalogVariation[] };

function isAuthed(req: NextRequest): boolean {
  const secret = process.env.PRIVATE_TOOL_COOKIE_SECRET;
  const passcode = process.env.PRIVATE_TOOL_PASSCODE;
  if (!secret || !passcode) return false;
  const got = req.cookies.get(COOKIE_NAME)?.value;
  if (!got) return false;
  const expected = createHmac("sha256", secret).update(passcode).digest("hex");
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(got, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("No JSON found in model output");
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Server is missing GROQ_API_KEY" }, { status: 500 });
  }

  let body: { copy?: unknown; catalog?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const copy = typeof body.copy === "string" ? body.copy.trim().slice(0, MAX_COPY) : "";
  if (copy.length < 40) {
    return Response.json({ error: "Paste more funnel copy to analyze (min ~40 characters)." }, { status: 400 });
  }

  const catalog: CatalogGroup[] = Array.isArray(body.catalog)
    ? (body.catalog as CatalogGroup[]).filter(
        (g) => g && typeof g.id === "string" && Array.isArray(g.variations)
      )
    : [];
  if (catalog.length === 0) {
    return Response.json({ error: "Missing section catalog." }, { status: 400 });
  }

  const validIds = new Set(catalog.map((g) => g.id));
  const validNums: Record<string, Set<string>> = {};
  for (const g of catalog) validNums[g.id] = new Set(g.variations.map((v) => v.number));

  const catalogStr = JSON.stringify(
    catalog.map((g) => ({
      id: g.id,
      label: g.label,
      v: g.variations.map((v) => ({
        n: v.number,
        d: (v.description || "").slice(0, 60),
        f: (v.funnelTypes ?? []).join("/"),
      })),
    }))
  ).slice(0, MAX_CATALOG);

  const system =
    "You are a senior funnel strategist who maps client copy onto the 10P Sales Page Framework. " +
    "You receive (1) a CATALOG of available section variations and (2) a client's full funnel COPY. " +
    'Each catalog item is {id, label, v:[{n,d,f}]} where n=variation number, d=design/vibe description, f=best-for tags. ' +
    "Do three things: (a) detect which sections from the catalog are present in the copy; " +
    "(b) for each present section extract the EXACT verbatim copy from the input that belongs to it, never rewrite, summarize, or invent text; " +
    "(c) recommend the single best-fit variation for that section by matching the copy's niche, tone and vibe to each variation's d/f, with a one-sentence reason. " +
    "Respond with STRICT JSON only (no markdown). Schema: " +
    '{"niche":string,"vibe":string,"sections":[{"sectionId":string,"recommendedVariation":string,"reason":string,"copy":string}]}. ' +
    "sectionId MUST be one of the catalog ids. recommendedVariation MUST be one of the n values under that section. " +
    "Order sections in the catalog's order. Only include sections that are genuinely present in the copy. Keep each reason under 20 words.";

  const user = `CATALOG:\n${catalogStr}\n\nFUNNEL COPY:\n${copy}`;

  let upstream: Response;
  try {
    upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 3500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch {
    return Response.json({ error: "Could not reach the analysis service." }, { status: 502 });
  }

  if (!upstream.ok) {
    let detail = "";
    try {
      detail = (await upstream.json())?.error?.message ?? "";
    } catch {
      /* ignore */
    }
    const tokenLimited =
      upstream.status === 413 ||
      upstream.status === 429 ||
      /rate.?limit|too large|tokens per minute|tpm/i.test(detail);
    return Response.json(
      {
        error: tokenLimited
          ? "That copy is too long for the current AI tier's per-minute limit. Trim it (or analyze in two passes) and try again."
          : "Analysis service error. Try again.",
      },
      { status: 502 }
    );
  }

  const data = await upstream.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";

  let parsed: { niche?: string; vibe?: string; sections?: unknown };
  try {
    parsed = extractJson(content) as typeof parsed;
  } catch {
    return Response.json({ error: "The model returned an unreadable result. Try again." }, { status: 502 });
  }

  const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
  const sections = rawSections
    .map((s) => s as { sectionId?: string; recommendedVariation?: string; reason?: string; copy?: string })
    .filter((s) => s && typeof s.sectionId === "string" && validIds.has(s.sectionId))
    .map((s) => {
      const id = s.sectionId as string;
      const recommended =
        typeof s.recommendedVariation === "string" && validNums[id].has(s.recommendedVariation)
          ? s.recommendedVariation
          : [...validNums[id]][0];
      return {
        sectionId: id,
        recommendedVariation: recommended,
        reason: typeof s.reason === "string" ? s.reason.slice(0, 400) : "",
        copy: typeof s.copy === "string" ? s.copy.slice(0, 6000) : "",
      };
    });

  return Response.json({
    niche: typeof parsed.niche === "string" ? parsed.niche.slice(0, 200) : "",
    vibe: typeof parsed.vibe === "string" ? parsed.vibe.slice(0, 200) : "",
    sections,
  });
}
