// Accord prototype server. Zero dependencies: Node 18+ (global fetch).
// Serves /public and three agent endpoints. LLM is any OpenAI-compatible API (default: Google Gemini).
// No LLM_API_KEY -> demo mode: pre-computed outputs for the built-in samples, clearly labelled.
const http = require('http');
const fs = require('fs');
const path = require('path');
const DEMO = require('./demo-outputs');

const PORT = process.env.PORT || 3000;
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
const LLM_MODEL = process.env.LLM_MODEL || 'gemini-2.5-flash';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const MAX_INPUT = 8000; // chars of user text sent to the model
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

// shortcut: in-memory per-IP limit, resets on restart; move to Redis if this ever runs multi-instance.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 60 * 60 * 1000, max = 60;
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < win)) hits.delete(k);
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}
// Behind Render's proxy the socket address is the proxy, so use the first X-Forwarded-For hop.
const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

// Commercial asks always go to a person. Enforced here in code, in live mode too, not left to the model.
const COMMERCIAL = /(discount|\d+\s*%\s*off|cheaper|price match|custom term|contract change|roadmap|promise)/i;
const STAGES = ['Discovery', 'Evaluation', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
const FIELDS = ['stage', 'amount', 'close_date', 'next_step', 'pain', 'decision_process', 'competitors', 'champion', 'economic_buyer', 'risks'];
const MIN_QUOTE = 12; // chars: a one-letter "quote" must not pass cite-or-block
const norm = x => String(x).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
const quoted = (q, src) => norm(q).length >= MIN_QUOTE && norm(src).includes(norm(q));

async function llmJSON(system, user) {
  const r = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_API_KEY}` },
    body: JSON.stringify({
      model: LLM_MODEL, temperature: 0.2, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return JSON.parse(j.choices[0].message.content);
}

const arr = v => (Array.isArray(v) ? v : []);
const str = (v, n = 600) => (typeof v === 'string' ? v.slice(0, n) : '');

// --- Agent 1: capture an interaction -> proposed, evidence-cited CRM changes ---
const CAPTURE_SYS = `You are the seller-side CRM agent in "Accord". Read ONE customer interaction and the current deal record.
Propose changes to the record. Rules:
- Every update MUST quote the exact supporting words from the interaction in "evidence". If no quote supports it, do not propose it.
- confidence is "high" (explicitly stated), "medium" (strongly implied) or "low" (inferred).
- Never invent numbers, names or dates that are not in the interaction or the record.
- Allowed fields: stage, amount, close_date, next_step, pain, decision_process, competitors, champion, economic_buyer, risks.
- Stages: Discovery, Evaluation, Proposal, Negotiation, Closed Won, Closed Lost.
- The draft follow-up goes back on the same channel, is short, specific, and in the buyer's language.
- You are given the company's Brain (ACCORD.md). Follow its stage definitions, voice, rules and objection handling.
  List in "brain_used" the exact Brain lines you relied on, copied word for word (max 4).
Return JSON: {"summary": string (2 sentences), "brain_used":[string], "updates":[{"field","from","to","evidence","confidence"}],
"stakeholders":[{"name","role","signal"}], "next_steps":[{"task","owner":"rep|buyer|agent","due":"YYYY-MM-DD or ''"}],
"risks":[{"risk","evidence"}], "draft":{"channel":"email|whatsapp|call","to":string,"body":string}}`;

// source (the interaction text) is optional so the unit test can call this without one; the server always passes it.
function cleanCapture(o, source) {
  const cited = e => source === undefined ? !!e : quoted(e, source);
  return {
    summary: str(o.summary, 500),
    brain_used: arr(o.brain_used).slice(0, 4).map(b => str(b, 300)).filter(Boolean),
    updates: arr(o.updates).slice(0, 10).map(u => ({ field: str(u.field, 40), from: str(String(u.from ?? ''), 200), to: str(String(u.to ?? ''), 300), evidence: str(u.evidence, 400), confidence: ['high', 'medium', 'low'].includes(u.confidence) ? u.confidence : 'low' }))
      .filter(u => FIELDS.includes(u.field) && cited(u.evidence) && (u.field !== 'stage' || STAGES.includes(u.to))), // uncited, unknown-field or invalid-stage updates are dropped: a hard product rule, not a prompt wish
    stakeholders: arr(o.stakeholders).slice(0, 6).map(s => ({ name: str(s.name, 80), role: str(s.role, 80), signal: str(s.signal, 200) })),
    next_steps: arr(o.next_steps).slice(0, 6).map(s => ({ task: str(s.task, 200), owner: str(s.owner, 10), due: str(s.due, 10) })),
    risks: arr(o.risks).slice(0, 5).map(s => ({ risk: str(s.risk, 200), evidence: str(s.evidence, 300) })).filter(r => r.risk && cited(r.evidence)),
    draft: { channel: str(o.draft?.channel, 10), to: str(o.draft?.to, 80), body: str(o.draft?.body, 1500) },
  };
}

// --- Agent 2: buyer-room agent, grounded only in approved knowledge ---
const BUYER_SYS = `You are the buyer-facing agent in an Accord Buyer Room. You answer the BUYER's questions on behalf of the seller.
Use ONLY the approved knowledge and deal facts provided. Cite the ids you used in "sources".
If the answer is not in the knowledge, or the question asks for a commercial commitment (discounts, custom terms, legal changes, roadmap promises),
do NOT answer it: set escalate=true, say a named human will reply, and give a one-line reason for the rep.
Set gap=true when you escalated only because the approved knowledge has no answer (not a commercial ask): the seller can then add an approved answer to their Brain.
Return JSON: {"answer": string, "sources": [id], "escalate": boolean, "gap": boolean, "reason": string}`;

// --- Agent 3: ask the pipeline ---
const ASK_SYS = `You answer a sales manager's question using ONLY the pipeline JSON and the company Brain provided. Be concise (max 6 bullet lines).
Name deals and quote the evidence field values you relied on. If the data cannot answer it, say so.
Return JSON: {"answer": string (may contain "\\n- " bullets), "deals": [deal id]}`;

const commercialEscalation = q => ({ answer: 'That needs a person with authority, so I have passed it to Asha (your account executive). She will reply here today.', sources: [], escalate: true, gap: false, reason: 'Commercial ask outside approved knowledge: ' + q.slice(0, 120) });

function demoBuyer(q, kb) {
  // Demo-mode retrieval: keyword overlap over approved KB; commercial asks escalate. Honest, not an LLM.
  const t = q.toLowerCase();
  if (COMMERCIAL.test(t)) return commercialEscalation(q);
  const STOP = new Set(['what', 'your', 'where', 'does', 'that', 'this', 'with', 'have', 'from', 'about', 'will', 'when', 'which', 'there']);
  const words = t.split(/\W+/).filter(w => w.length > 3 && !STOP.has(w));
  let best = null, score = 0;
  for (const k of kb) {
    const s = words.filter(w => (k.title + ' ' + k.text).toLowerCase().includes(w)).length;
    if (s > score) { score = s; best = k; }
  }
  if (!best || score < 2) return { answer: "I don't have an approved answer for that yet, so I have asked Asha to reply here.", sources: [], escalate: true, gap: true, reason: 'No approved knowledge matched: ' + q.slice(0, 120) };
  return { answer: best.text, sources: [best.id], escalate: false, gap: false, reason: '' };
}

async function readBody(req) {
  let b = '';
  for await (const c of req) { b += c; if (b.length > 200000) throw new Error('body too large'); }
  return JSON.parse(b || '{}');
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.pathname === '/api/status')
      return send(res, 200, { live: !!LLM_API_KEY, model: LLM_API_KEY ? LLM_MODEL : null });

    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      if (rateLimited(clientIp(req))) return send(res, 429, { error: 'Rate limit: 60 agent calls/hour. Try later.' });
      const body = await readBody(req);
      const input = str(body.input, MAX_INPUT);
      const live = !!LLM_API_KEY;

      if (url.pathname === '/api/capture') {
        if (!input.trim()) return send(res, 400, { error: 'Empty interaction' });
        if (!live) {
          const d = DEMO.capture[body.sampleId];
          if (!d) return send(res, 200, { mode: 'demo', error: 'Demo mode runs the three built-in samples only. Add LLM_API_KEY to analyse your own text.' });
          return send(res, 200, { mode: 'demo', result: d });
        }
        const out = await llmJSON(CAPTURE_SYS, `Company Brain (ACCORD.md):\n${str(body.brain, 12000)}\n\nToday: ${body.today}\nChannel: ${str(body.channel, 20)}\nCurrent deal record:\n${JSON.stringify(body.deal).slice(0, 6000)}\n\nInteraction:\n${input}`);
        return send(res, 200, { mode: 'live', result: cleanCapture(out, input) });
      }

      if (url.pathname === '/api/buyer') {
        const kb = arr(body.kb).slice(0, 40);
        if (!input.trim()) return send(res, 400, { error: 'Empty question' });
        if (!live) return send(res, 200, { mode: 'demo', result: demoBuyer(input, kb) });
        if (COMMERCIAL.test(input)) return send(res, 200, { mode: 'live', result: commercialEscalation(input) });
        const out = await llmJSON(BUYER_SYS, `Approved knowledge:\n${JSON.stringify(kb).slice(0, 8000)}\nDeal facts:\n${JSON.stringify(body.facts).slice(0, 2000)}\n\nBuyer question: ${input}`);
        return send(res, 200, { mode: 'live', result: { answer: str(out.answer, 1200), sources: arr(out.sources).map(String).slice(0, 5), escalate: !!out.escalate, gap: !!out.escalate && !!out.gap, reason: str(out.reason, 300) } });
      }

      if (url.pathname === '/api/ask') {
        if (!input.trim()) return send(res, 400, { error: 'Empty question' });
        if (!live) {
          const d = DEMO.ask[body.sampleId];
          return send(res, 200, d ? { mode: 'demo', result: d } : { mode: 'demo', error: 'Demo mode answers the suggested questions only. Add LLM_API_KEY for free-form questions.' });
        }
        const out = await llmJSON(ASK_SYS, `Company Brain (ACCORD.md):\n${str(body.brain, 8000)}\n\nToday: ${body.today}\nPipeline:\n${JSON.stringify(body.pipeline).slice(0, 12000)}\n\nQuestion: ${input}`);
        return send(res, 200, { mode: 'live', result: { answer: str(out.answer, 2000), deals: arr(out.deals).map(String) } });
      }
      return send(res, 404, { error: 'Unknown endpoint' });
    }

    // static files
    let dec; try { dec = decodeURIComponent(url.pathname); } catch { return send(res, 400, { error: 'Bad URL' }); }
    let p = path.normalize(dec).replace(/^([/\\])+/, '');
    if (!p || p === '.') p = 'index.html';
    const file = path.join(PUBLIC, p);
    if (!file.startsWith(PUBLIC)) return send(res, 403, { error: 'Forbidden' });
    fs.readFile(file, (err, data) => {
      if (err) { // SPA fallback
        return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, html) => { res.writeHead(e2 ? 404 : 200, { 'Content-Type': 'text/html' }); res.end(html); });
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) {
    console.error(e);
    send(res, 502, { error: 'Agent failed: ' + e.message.slice(0, 200) });
  }
});

if (require.main === module) server.listen(PORT, () => console.log(`Accord on :${PORT} (${LLM_API_KEY ? 'live ' + LLM_MODEL : 'demo mode'})`));
module.exports = { cleanCapture, demoBuyer, COMMERCIAL };
