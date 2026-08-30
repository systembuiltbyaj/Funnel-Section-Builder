# Funnel Section Builder

A public gallery of funnel section templates. Browse 110 sections across the 12
groups of the 10P framework, preview any of them live re-skinned to your brand,
and copy a ready-to-use prompt. Add sections to the tray to assemble a whole
funnel and get one combined master prompt from the Funnel Builder tab.

The gallery also carries 64 browse-only Extras — 53 image prompts, 6 carousel
sections and 5 full-page layouts (`lib/gallery-extras.ts`). Extras cannot join a
funnel; their cards only offer "Copy prompt".

No account and no database — your work is kept in the browser.

It is a **layout picker**: you choose a variation per section and set a brand
kit. There are no copy fields, and generated pages come back with placeholder
copy for you to replace.

In the Funnel Builder tab you can either copy a master prompt to run yourself, or
have the app **generate the page for you**: it builds each section in its own
request and stitches them into one single-file HTML document you can download and
edit. There is also an **Analyze Copy (AI)** mode — paste a client's page and the
app recommends the best-fit variation for each of the 10P sections, with a reason
for each pick. Your pasted text is used for the recommendation only; it is never
saved and never appears in the output.

Both AI paths need `GROQ_API_KEY` or `ANTHROPIC_API_KEY` (Groq is used when both
are set, because it is free and fast). Without either, the app still works and
simply offers the prompt instead.

Most variations ship a rendered HTML sample, so a section — or the whole selected
funnel — can be previewed live and re-skinned in the client's brand kit before a
prompt is generated (`app/live-preview.tsx`, `lib/samples.ts`). Entries with no
sample (the image-prompt library, layout screenshots) fall back to their static
thumbnail; see `CLAUDE.md` for which and why.

Extracted from the System Built by AJ portfolio into its own app.

## Stack
Next.js 16 (App Router) · React 19 · Tailwind v4.

## Run locally
```bash
npm install
npm run dev            # http://localhost:3100
npm run typecheck      # tsc --noEmit
npm run lint
npm test               # node --test, no extra dependencies
```

## Deploy (Vercel)
Push to a GitHub repo and import in Vercel.

Set `GROQ_API_KEY` (free, the default) or `ANTHROPIC_API_KEY` if you want in-app
HTML generation and the AI analyzer; everything else works without either. **If
you use a paid provider, set a hard monthly budget cap in its console** — the app
is public and has no accounts, so that cap is the only real limit on spend.
Generation runs one request per section deliberately, because Vercel Hobby caps a
function at 60 seconds.
