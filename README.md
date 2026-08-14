# Funnel Section Builder

A public gallery of funnel section templates. Browse 110 sections across the 12
groups of the 10P framework, preview any of them live re-skinned to your brand,
and copy a ready-to-use prompt. Add sections to the tray to assemble a whole
funnel and get one combined master prompt from `/build`.

No account, no API keys, no backend — your work is kept in the browser.

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
Push to a GitHub repo and import in Vercel. No environment variables are
required.
