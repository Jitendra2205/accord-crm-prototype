# Accord: the two-sided, agent-run CRM (prototype)

Built by Jitendra Singh for the 8th Element "Product Manager - AI Solutions" assignment: *Reimagine CRM for the future of sales.*

**Idea.** CRM has been the seller's private notebook, filled in by reps for managers. Accord turns it into a shared, agent-run relationship layer:

1. **Seller agent:** captures calls, emails and WhatsApp, keeps the record true, drafts the next step. Every AI-written field quotes its source; a change whose quote isn't in the source is blocked.
2. **Buyer Room:** buyers (and their own AI agents) get answers any time, only from approved content. Commercial or unknown questions go to a person.
3. **Manager truth:** the stage the rep sets next to the stage the evidence supports.
4. **Company Brain (ACCORD.md):** a versioned markdown file the company owns, like CLAUDE.md for a codebase. Every agent reads it (stage definitions, voice, rules, objections, competitors, buyer-safe answers). Usage proposes cited additions (buyer questions with no answer, rep edits, objections heard on calls) and a person approves them, so the CRM gets more specific to the company and product the more it is used.
5. **Autonomy dial:** per action type, from "Suggest only" to "Auto"; discounts and legal terms are always human.

Why the Brain: a B2B sales professional I spoke to (one conversation, Oct 2026) said deal creation, contact management and email automation are common to every CRM; what's missing is a brain that gets personalised to the company and product with use.

## Demo path (5 minutes)
Today → *Review in Capture* (Lumen call) → run agent → apply → deal record fills with cited fields → run samples 2 and 3 → **Buyer Room**: ask "Do you support Okta SSO?" then "Can you give us 20% off…?" → escalation lands in **Today** → **Pipeline** (rep stage vs evidence stage) → **Ask** → **Agent controls** (autonomy + audit log).

Brain loop (2 minutes): **Buyer Room** → ask "What happens to our data if we cancel?" → it escalates (no approved answer) → **Brain** → approve the K7 suggestion → ask again in the Buyer Room → answered from the Brain. Ask any other unknown question and a new "write the answer" suggestion appears in the Brain inbox.

First visit opens a 5-step tour (reopen it from the sidebar: *Take the 1-minute tour*). *Reset demo* in the sidebar restores the seed state; the Brain page has *Download ACCORD.md*.

## Run locally
```bash
node server.js        # Node 18+, no npm install needed
open http://localhost:3000
node test.js          # self-check: demo quotes are real, uncited changes dropped, commercial asks escalate
```

## Live AI vs demo mode
| Env var | Default | |
|---|---|---|
| `LLM_API_KEY` | *(empty = demo mode)* | Google Gemini key (free tier works) or any OpenAI-compatible key |
| `LLM_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | any OpenAI-compatible endpoint, e.g. Groq: `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | `gemini-3.8-flash` | e.g. Groq: `openai/gpt-oss-120b` |

- **Live mode:** capture, Buyer Room and Ask call the model on any text you paste. The key stays on the server. Requests are limited to 60 per IP per hour.
- **Demo mode:** the three capture samples and the suggested Ask questions return hand-written outputs; the Buyer Room uses keyword retrieval with a rule that sends commercial asks to a person. The UI labels which mode produced each answer.

## Deploy on Render
1. Push this folder to a GitHub repo.
2. In Render: **New → Blueprint** and pick the repo (uses `render.yaml`), or **New → Web Service** with build command `true` and start command `node server.js`.
3. Add `LLM_API_KEY` under Environment (get a free key at aistudio.google.com/apikey). Leave it empty to run in demo mode.
4. Free instances sleep after inactivity; open the link once a minute before you present.

## Honest scope
Real: the UI, the agent prompts and endpoints, the evidence check, the escalation rule, the audit log.
Simulated: sending messages, integrations (email, calendar, WhatsApp, telephony, CRM sync), the MCP endpoint, overnight activity.
All companies, people and numbers are fictional. State lives in the browser tab; reload to reset.

## Files
`CLAUDE.md` (notes for Claude Code) · `server.js` (HTTP server + 3 agent endpoints) · `demo-outputs.js` · `public/` (index.html, app.js, data.js, styles.css) · `test.js` · `render.yaml`
