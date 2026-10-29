# Accord prototype: notes for Claude Code

Accord is a prototype for a PM take-home assignment ("Reimagine CRM"). It is a demo, not a product: keep it small, honest and working.

## Run and check
- `node server.js` serves on `PORT` (default 3000). Node 18+, zero npm dependencies. Do not add any.
- `node test.js` must print `ok` before every commit.
- Live AI: set `LLM_API_KEY` (any OpenAI-compatible API; default Google Gemini `gemini-3.8-flash`). Without it the app runs in demo mode.

## Layout
- `server.js`: static files + `/api/status`, `/api/capture`, `/api/buyer`, `/api/ask`. Prompts live here. Rate limit 60/h per IP.
- `demo-outputs.js`: hand-written outputs for the 3 capture samples and 3 Ask questions (demo mode only).
- `public/data.js`: ALL fictional seed data, including the Company Brain (`brain`, an ACCORD.md string) and the learning inbox (`learn`).
- `public/app.js`: vanilla JS, hash routes (`#today #capture/s1 #deal/d1 #pipeline #ask #brain #room #trust #about`), in-memory state.
- `public/styles.css`, `public/index.html`.

## Product rules the code must keep (these are the product, not style)
1. Cite or block: an AI-written field needs a quote found in the source text. Server drops uncited updates; the browser blocks quotes not found in the source.
2. Buyer agent answers only from the Brain's `## Buyer-safe answers` section (`### K<n> Title` entries). Commercial asks (discounts, custom terms, roadmap promises) always escalate. Unknown questions escalate with `gap: true` and create a Brain suggestion.
3. Nothing is added to the Brain without a person approving it. Learned lines carry `[learned: <date>, from <source>]`.
4. "Brain used" chips are verified against the Brain text, same as quotes.
5. Discounts, legal and custom terms can never be set to automatic.

## Honesty rules
- All companies, people and numbers are fictional; say so in the UI.
- Label demo output as demo output. Never present simulated features (sending, integrations, MCP) as real.
- Escape all model output before rendering (use `esc()`).
