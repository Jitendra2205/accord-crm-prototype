/* Accord prototype - vanilla JS, hash routing, in-memory state (reload = reset). */
const S = structuredClone(window.SEED);
S.done = new Set(); S.chat = []; S.audit = []; S.captured = new Set(); S.brainStart = S.brainVersion;
let chatSeen = 0, lastRoute = null; // animate only what is new: the latest chat message, and a page only when the route changes
let LIVE = false, MODEL = null, lastCapture = null;

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Number(n || 0).toLocaleString('en-US');
const deal = id => S.deals.find(d => d.id === id);
const dateFmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-';
const FIELD_LABEL = { stage: 'Stage', amount: 'Amount', close_date: 'Close date', next_step: 'Next step', pain: 'Pain / goal', decision_process: 'Decision process', competitors: 'Competitors', champion: 'Champion', economic_buyer: 'Economic buyer', risks: 'Risks' };
const STAGE_P = { Discovery: 0.1, Evaluation: 0.25, Proposal: 0.5, Negotiation: 0.75, 'Closed Won': 1, 'Closed Lost': 0 };
// Lucide-style 24px stroke icons (inline SVG, inherit currentColor) instead of emoji/glyphs.
const svg = p => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const CH_ICON = {
  call: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
  email: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
  whatsapp: svg('<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z"/>'),
  room: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>'),
  doc: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>'),
};

function audit(who, what) { S.audit.unshift({ t: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), who, what }); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); }
async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: 'Bad response' }));
  if (!r.ok && !j.error) j.error = 'HTTP ' + r.status;
  return j;
}
const confChip = c => `<span class="chip conf-${esc(c)}">${esc(c)} confidence</span>`;

/* ---------------- Brain helpers (ACCORD.md) ---------------- */
const LEARNED = /\s*\[learned: [^\]]*\]/;
// Buyer-safe answers = the only Brain section the buyer agent may quote. "### K1 Title" starts an entry.
function kb() {
  const sec = (S.brain.split(/^## /m).find(x => x.startsWith('Buyer-safe answers')) || '').split('\n').slice(1).join('\n');
  return sec.split(/^### /m).slice(1).map(e => { const [head, ...rest] = e.split('\n'); const m = head.replace(LEARNED, '').match(/^(\S+)\s+(.*)$/) || [, head, head]; return { id: m[1], title: m[2], text: rest.join(' ').trim() }; });
}
function addToBrain(section, lines) {
  const i = S.brain.indexOf('\n## ' + section + '\n'); if (i < 0) return false;
  const next = S.brain.indexOf('\n## ', i + 4), at = next < 0 ? S.brain.length : next;
  S.brain = S.brain.slice(0, at).replace(/\n*$/, '\n') + lines + '\n' + S.brain.slice(at); S.brainVersion++; return true;
}
// Strip every [learned: …] tag from both sides: the model may quote a line with or without its tag.
const noTag = s => s.replace(new RegExp(LEARNED.source, 'g'), '').toLowerCase().trim();
const inBrain = q => q && noTag(S.brain).includes(noTag(q));
function renderBrain(md) {
  return md.split('\n').map(l => {
    const m = l.match(LEARNED), tag = m ? ` <span class="chip learned">${esc(m[0].trim().slice(1, -1))}</span>` : '', t = esc(l.replace(LEARNED, ''));
    if (l.startsWith('# ')) return `<h2 class="b-h1">${t.slice(2)}</h2>`;
    if (l.startsWith('## ')) return `<h3 class="b-h2">${t.slice(3)}</h3>`;
    if (l.startsWith('### ')) return `<h4 class="b-h3">${t.slice(4)}${tag}</h4>`;
    if (l.startsWith('- ')) return `<p class="b-li">• ${t.slice(2)}${tag}</p>`;
    return l.trim() ? `<p class="b-p">${t}${tag}</p>` : '';
  }).join('');
}

/* ---------------- Today ---------------- */
function viewToday() {
  const items = S.today.filter(i => !S.done.has(i.id));
  const open = S.deals.filter(d => !d.stage.startsWith('Closed'));
  const atRisk = open.filter(d => d.health === 'risk').length;
  return `
  <header class="page-h"><div><h1>Good morning, Asha</h1><p class="sub">Your agent worked overnight. ${items.length} things need you; everything else is done.</p></div></header>
  <div class="stats">
    <div class="stat"><b>${items.length}</b><span>need your decision</span></div>
    <div class="stat"><b>${S.autoLog.length}</b><span>done automatically</span></div>
    <div class="stat"><b>${atRisk}</b><span>deal at risk</span></div>
    <div class="stat"><b>0</b><span>fields you typed this week</span></div>
  </div>
  <details class="autolog"><summary>✓ Done automatically overnight (${S.autoLog.length}) - every item is in the audit log and can be undone</summary>
    <ul>${S.autoLog.map(a => `<li>${esc(a)}</li>`).join('')}</ul></details>
  <div class="queue">${items.length ? items.map(card).join('') : '<div class="empty">All clear. Go sell. ☕</div>'}</div>`;
}

function card(i) {
  const d = deal(i.deal);
  const kindLabel = { review: 'Review capture', risk: 'Risk', signal: 'Buying signal', 'deal-desk': 'Needs a human', update: 'Field update', followup: 'Follow-up draft', escalation: 'Buyer Room escalation', brain: 'Brain' }[i.kind];
  return `<article class="card kind-${i.kind}" data-id="${i.id}">
    <div class="card-top"><span class="kind">${kindLabel}</span><a href="#deal/${d.id}" class="deal-link">${esc(d.name)} · ${money(d.amount)}</a><span class="auto">Autonomy: ${esc(i.autonomy)}</span></div>
    <h3>${esc(i.title)}</h3><p class="why">${esc(i.why)}</p>
    ${(i.evidence || []).map(e => `<blockquote class="ev">“${esc(e.q)}”<cite>${esc(e.at)}</cite></blockquote>`).join('')}
    ${i.change ? `<div class="change"><b>${FIELD_LABEL[i.change.field]}</b> <s>${esc(i.change.from)}</s> → <ins>${esc(i.change.to)}</ins> ${confChip(i.change.conf)}</div>` : ''}
    ${i.draft ? `<div class="draft"><div class="draft-h">${CH_ICON[i.draft.channel] || ''} Draft ${esc(i.draft.channel)} to <b>${esc(i.draft.to)}</b></div><textarea class="draft-body" rows="${Math.min(9, i.draft.body.split('\n').length + 1)}">${esc(i.draft.body)}</textarea></div>` : ''}
    <div class="actions">
      ${i.kind === 'review' ? `<button class="btn primary" data-act="review" data-sample="${i.sample}">${esc(i.cta)}</button>` : ''}
      ${i.kind === 'brain' ? `<button class="btn primary" data-act="brain">${esc(i.cta)} (${S.learn.length})</button>` : ''}
      ${i.kind === 'deal-desk' ? `<button class="btn primary" data-act="desk">${esc(i.cta)}</button>` : ''}
      ${i.draft ? `<button class="btn primary" data-act="send">Approve & send</button>` : ''}
      ${i.change ? `<button class="btn primary" data-act="apply">Approve change</button>` : ''}
      ${i.kind === 'escalation' ? `<button class="btn primary" data-act="reply">Reply in Buyer Room</button>` : ''}
      <button class="btn ghost" data-act="dismiss">Dismiss</button>
    </div></article>`;
}

function bindToday() {
  document.querySelectorAll('.card [data-act]').forEach(b => b.onclick = () => {
    const el = b.closest('.card'), i = S.today.find(x => x.id === el.dataset.id), d = deal(i.deal), act = b.dataset.act;
    if (act === 'review') return location.hash = '#capture/' + b.dataset.sample;
    if (act === 'brain') return location.hash = '#brain';
    if (act === 'reply') return location.hash = '#room';
    if (act === 'send') {
      const body = el.querySelector('.draft-body').value, edited = body !== i.draft.body;
      audit('Asha', `Approved ${edited ? 'edited ' : ''}${i.draft.channel} to ${i.draft.to} (${d.name})`);
      toast(`Sent by ${i.draft.channel} to ${i.draft.to} (simulated)${edited ? ' - your edit is a learning signal' : ''}`);
      (d.timeline ||= []).unshift({ at: TODAY, ch: i.draft.channel, title: `${i.draft.channel === 'email' ? 'Email' : 'WhatsApp'} sent to ${i.draft.to}`, body: body.slice(0, 160) });
    }
    if (act === 'apply') { applyField(d, i.change.field, i.change.to, i.evidence[0].q, i.evidence[0].at, i.change.conf); if (i.change.field === 'close_date') d.close = i.change.to; audit('Asha', `Approved ${i.change.field} → ${i.change.to} (${d.name})`); toast('Record updated with its evidence attached'); }
    if (act === 'desk') { audit('Asha', `Routed ${d.name} redlines to deal desk`); toast('Sent to deal desk with clause comparison'); }
    if (act === 'dismiss') { audit('Asha', `Dismissed: ${i.title}`); toast('Dismissed - the agent will learn from this'); }
    S.done.add(i.id); render();
  });
}

function applyField(d, f, value, quote, at, conf) {
  if (!d.fields) return;
  d.fields[f] = { value: String(value), src: 'evidence', quote, at, conf };
  if (f === 'stage') d.evidenceStage = value;
  if (f === 'amount') d.amount = Number(String(value).replace(/[^\d.]/g, '')) || d.amount;
  if (f === 'close_date') d.close = value;
}

/* ---------------- Deal ---------------- */
function viewDeal(id) {
  const d = deal(id); if (!d) return '<p>Deal not found.</p>';
  const mismatch = d.evidenceStage && d.evidenceStage !== d.stage;
  const head = `<header class="page-h"><div><a href="#pipeline" class="back">← Pipeline</a><h1>${esc(d.name)}</h1>
    <p class="sub">${money(d.amount)} · close ${dateFmt(d.close)} · owner ${esc(d.owner)}</p></div>
    <div class="stagebox"><div><small>Stage set by rep</small><b>${esc(d.stage)}</b></div><div class="${mismatch ? 'warn' : ''}"><small>Stage the evidence supports</small><b>${esc(d.evidenceStage || 'Not verified yet')}</b></div></div></header>`;
  if (!d.fields) return head + `<div class="panel"><h3>Evidence summary</h3><p>${esc(d.evidence)}</p>${(d.risks || []).length ? `<h3>Risks</h3><ul>${d.risks.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}<p class="muted">Full record view is built out for Lumen Logistics in this prototype.</p></div>`;
  const rows = Object.entries(d.fields).map(([k, f]) => `<tr>
    <td class="fl">${FIELD_LABEL[k]}</td>
    <td>${f.value ? esc(k === 'amount' ? money(f.value) : f.value) : '<span class="muted">empty</span>'}</td>
    <td>${f.src === 'evidence' ? `<details class="src"><summary>${confChip(f.conf)} source</summary><blockquote class="ev">“${esc(f.quote)}”<cite>${esc(f.at)}</cite></blockquote></details>`
      : f.src === 'rep' ? `<span class="chip rep" title="${esc(f.note)}">typed by rep · no evidence</span>` : '<span class="chip none">unknown</span>'}</td></tr>`).join('');
  return head + `<div class="grid2">
    <section class="panel"><h3>Record <small class="muted">every AI-written field links to the words it came from</small></h3><table class="fields">${rows}</table></section>
    <section>
      <div class="panel"><h3>Buying group</h3>${d.stakeholders.map(p => `<div class="person"><div class="av">${esc(p.name[0])}</div><div><b>${esc(p.name)}</b><small>${esc(p.role)}</small></div><span class="chip">${esc(p.tag)}</span><span class="heat h${p.heat}" title="engagement"></span></div>`).join('')}</div>
      <div class="panel"><h3>Timeline <small class="muted">captured automatically</small></h3>${d.timeline.map(t => `<div class="tl"><span class="ic">${CH_ICON[t.ch] || '•'}</span><div><b>${esc(t.title)}</b><small>${dateFmt(t.at)}</small>${t.body ? `<p>${esc(t.body)}</p>` : ''}</div></div>`).join('')}</div>
    </section></div>`;
}

/* ---------------- Capture (live agent) ---------------- */
function viewCapture(sid) {
  const s = S.samples[sid] || null;
  return `<header class="page-h"><div><h1>Capture agent</h1><p class="sub">Calls, emails and WhatsApp come in on their own. The agent proposes record changes; each one must quote its source or it is blocked.</p></div></header>
  <div class="grid2 cap">
    <section class="panel">
      <h3>1 · Interaction <small class="muted">Deal: Lumen Logistics (matched from participants)</small></h3>
      <div class="samples">${Object.entries(S.samples).map(([k, v]) => `<button class="pill ${k === sid ? 'on' : ''}" data-s="${k}">${CH_ICON[v.channel]} ${esc(v.label)}${S.captured.has(k) ? ' ✓' : ''}</button>`).join('')}</div>
      <textarea id="capText" aria-label="Interaction text" rows="16" placeholder="Paste a call transcript, email or chat… (live AI mode only)">${esc(s ? s.text : '')}</textarea>
      <div class="row"><select id="capCh" aria-label="Channel">${['call', 'email', 'whatsapp'].map(c => `<option ${s && s.channel === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <button class="btn primary" id="runCap">Run capture agent</button></div>
      <p class="muted small">${LIVE ? `Live AI: ${esc(MODEL)}. Your text is sent to the model and not stored.` : 'Demo mode: the three samples return pre-computed agent output. Set LLM_API_KEY on the server for live AI on any text.'}</p>
    </section>
    <section id="capOut" class="panel">${lastCapture ? renderCapture(lastCapture) : '<div class="empty">Pick a sample and run the agent. Try them in order 1 → 2 → 3 to watch the record fill itself.</div>'}</section>
  </div>`;
}

function renderCapture({ result, mode, source, sid }) {
  const d = deal('d1');
  const norm = x => x.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');
  const found = q => q && norm(q).trim().length >= 12 && norm(source).includes(norm(q)); // min length: a 1-letter "quote" must not pass
  const stages = Object.keys(STAGE_P);
  result.updates = result.updates.filter(u => FIELD_LABEL[u.field] && (u.field !== 'stage' || stages.includes(u.to))); // unknown fields / invalid stages never reach the record
  let marked = esc(source);
  // shortcut: highlight needs an exact (case-insensitive) match; whitespace-variant quotes pass the check but stay unhighlighted.
  result.updates.forEach(u => { const q = esc(u.evidence), i = q ? marked.toLowerCase().indexOf(q.toLowerCase()) : -1; if (i >= 0) marked = marked.slice(0, i) + '<mark>' + marked.slice(i, i + q.length) + '</mark>' + marked.slice(i + q.length); });
  return `<h3>2 · Agent proposal <span class="chip ${mode}">${mode === 'live' ? 'live AI' : 'demo output'}</span></h3>
    <p>${esc(result.summary)}</p>
    ${(result.brain_used || []).length ? `<div class="brainused"><b>⋀ Used from your Brain:</b> ${result.brain_used.map(b => inBrain(b) ? `<span class="chip learned" title="Found in ACCORD.md">${esc(b)}</span>` : `<span class="chip warn" title="Not found in ACCORD.md">⚠ not in Brain: ${esc(b)}</span>`).join(' ')}</div>` : ''}
    <table class="diff"><thead><tr><th></th><th>Field</th><th>Now</th><th>Proposed</th><th>Evidence</th></tr></thead><tbody>
    ${result.updates.map((u, k) => { const ok = found(u.evidence), cur = u.field === 'amount' && d.fields.amount.value ? money(d.fields.amount.value) : (d.fields[u.field]?.value || ''); return `<tr class="${ok ? '' : 'blocked'}">
      <td><input type="checkbox" data-k="${k}" ${ok ? (u.confidence === 'high' ? 'checked' : '') : 'disabled'}></td>
      <td><b>${esc(FIELD_LABEL[u.field] || u.field)}</b><br>${confChip(u.confidence)}</td>
      <td class="muted">${esc(cur) || 'empty'}</td><td>${esc(u.to)}</td>
      <td>${ok ? `<q>${esc(u.evidence)}</q>` : `<span class="blockmsg">⚠ Quote not found in source. Blocked.</span>`}</td></tr>`; }).join('')}
    </tbody></table>
    <p class="muted small">High confidence is pre-ticked (your autonomy setting: Auto + notify). Medium/low wait for your tick.</p>
    <div class="grid2 tight">
      <div><h4>Buying group</h4>${result.stakeholders.map(s => `<p class="li"><b>${esc(s.name)}</b> · ${esc(s.role)}<br><small>${esc(s.signal)}</small></p>`).join('')}</div>
      <div><h4>Next steps</h4>${result.next_steps.map(s => `<p class="li">☐ ${esc(s.task)} <small>${esc(s.owner)}${s.due ? ' · ' + dateFmt(s.due) : ''}</small></p>`).join('')}
      <h4>Risks</h4>${result.risks.map(r => `<p class="li">⚑ ${esc(r.risk)}<br><small>“${esc(r.evidence)}”</small></p>`).join('')}</div>
    </div>
    ${result.draft?.body ? `<div class="draft"><div class="draft-h">${CH_ICON[result.draft.channel] || ''} Draft ${esc(result.draft.channel)} to <b>${esc(result.draft.to)}</b> - goes to your Today queue for approval</div><pre>${esc(result.draft.body)}</pre></div>` : ''}
    <div class="row"><button class="btn primary" id="applyCap">Apply ticked changes</button><a class="btn ghost" href="#deal/d1">Open deal</a></div>
    <details class="src"><summary>Source with cited passages highlighted</summary><pre class="srcpre">${marked}</pre></details>`;
}

function bindCapture() {
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { lastCapture = null; location.hash = '#capture/' + b.dataset.s; });
  $('#runCap').onclick = async () => {
    const text = $('#capText').value, sid = (location.hash.split('/')[1] || ''), s = S.samples[sid];
    const sampleId = s && s.text === text ? sid : null; // edited text is not the sample any more
    $('#capOut').innerHTML = '<div class="empty"><span class="spin"></span> Agent reading the interaction…</div>';
    const d = deal('d1'), rec = Object.fromEntries(Object.entries(d.fields).map(([k, f]) => [k, f.value]));
    const j = await post('/api/capture', { input: text, sampleId, channel: $('#capCh').value, today: TODAY, deal: { name: d.name, ...rec }, brain: S.brain });
    if (j.error) { $('#capOut').innerHTML = `<div class="empty err">${esc(j.error)}</div>`; return; }
    lastCapture = { ...j, source: text, sid: sampleId };
    $('#capOut').innerHTML = renderCapture(lastCapture); bindApply();
  };
  if (lastCapture) bindApply();
}

function bindApply() {
  const b = $('#applyCap'); if (!b) return;
  b.onclick = () => {
    const { result, sid } = lastCapture, d = deal('d1'), label = S.samples[sid]?.label || 'Pasted interaction, ' + dateFmt(TODAY);
    const picked = [...document.querySelectorAll('.diff input:checked')].map(c => result.updates[c.dataset.k]);
    picked.forEach(u => applyField(d, u.field, u.to, u.evidence, label, u.confidence));
    result.stakeholders.forEach(s => {
      const first = s.name.split(' ')[0].toLowerCase(), p = d.stakeholders.find(x => x.name.toLowerCase().startsWith(first));
      if (p) { p.heat = Math.min(3, p.heat + 1); if (p.tag === 'Unknown') p.tag = s.role.split(' - ').pop(); }
      else if (!/unknown/i.test(s.name)) d.stakeholders.push({ name: s.name, role: s.role, tag: s.role.split(' - ').pop(), heat: 1, last: TODAY });
    });
    d.timeline.unshift({ at: TODAY, ch: S.samples[sid]?.channel || $('#capCh').value, title: `Captured: ${label}`, body: `${picked.length} field(s) updated with evidence. ${result.summary}` });
    if (result.draft?.body) S.today.unshift({ id: 'f' + Date.now(), deal: 'd1', kind: 'followup', title: `Follow-up ready for ${result.draft.to}`, why: 'Drafted from the interaction you just reviewed. Edit anything; your edits teach the agent your style.', draft: result.draft, autonomy: 'Approve' });
    if (sid) S.captured.add(sid); if (sid === 's1') S.done.add('t1');
    d.lastTouch = TODAY;
    audit('Agent', `Proposed ${result.updates.length} changes to Lumen Logistics`); audit('Asha', `Applied ${picked.length} evidence-backed changes`);
    toast(`${picked.length} fields updated · follow-up added to Today`);
    lastCapture = null; location.hash = '#deal/d1';
  };
}

/* ---------------- Buyer Room ---------------- */
const ROOM_Q = ['Do you support Okta SSO?', 'How long does rollout take for 6 depots?', 'Where is our data hosted?', 'Can you give us 20% off if we sign this month?'];
function viewRoom() {
  return `<div class="buyer-banner">Buyer view · You are <b>Priya Raman</b>, VP Operations, Lumen Logistics. This room is shared by Cobalt Route.</div>
  <header class="page-h"><div><h1>Lumen × Cobalt Route</h1><p class="sub">One place for the plan, documents and answers. Ask anything, any time. A person steps in when it matters.</p></div></header>
  <div class="grid2">
    <section>
      <div class="panel"><h3>Mutual action plan</h3>${S.map.map(m => `<div class="map ${m.done ? 'done' : ''}"><span>${m.done ? '✔' : '○'}</span><div><b>${esc(m.step)}</b><small>${esc(m.owner)} · ${dateFmt(m.due)}</small></div></div>`).join('')}</div>
      <div class="panel"><h3>Resources</h3>${S.roomFiles.map(f => `<p class="li">▤ ${esc(f)}</p>`).join('')}</div>
      <div class="panel agentapi"><h3>For your AI agent <span class="chip">MCP · read-only</span></h3>
        <p class="small">Buyers increasingly research with AI. Your own assistant can read this room's approved facts and plan, with your login, instead of guessing from the web.</p>
<pre>→ tools/call  accord.get_deal_room
  { "room": "lumen-cobalt" }
← { "plan": [6 steps], "approved_facts": ["K1".."K6"],
    "open_questions": 1, "contact": "Asha Menon" }</pre></div>
    </section>
    <section class="panel chat">
      <h3>Ask Cobalt Route <small class="muted">answers only from approved content · ${LIVE ? 'live AI' : 'demo retrieval'}</small></h3>
      <p class="muted small">Prototype: the approved answers come from the Brain in this browser tab. A real deployment would keep them server-side.</p>
      <div id="msgs" role="log" aria-live="polite">${S.chat.length ? S.chat.map((m, i) => msg(m, i >= chatSeen)).join('') : '<div class="empty">Ask about security, rollout, pricing or the pilot.</div>'}</div>
      <div class="samples">${ROOM_Q.map(q => `<button class="pill" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="row"><input id="roomQ" aria-label="Your question" placeholder="Type a question…"><button class="btn primary" id="roomSend">Ask</button></div>
    </section>
  </div>`;
}
function msg(m, fresh) {
  const pop = fresh ? ' pop' : '';
  if (m.who === 'buyer') return `<div class="msg me${pop}">${esc(m.text)}</div>`;
  const K = kb(), src = (m.sources || []).map(id => K.find(k => k.id === id)).filter(Boolean);
  return `<div class="msg bot ${m.escalate ? 'esc' : ''}${pop}">${esc(m.text)}${src.length ? `<div class="srcs">${src.map(k => `<span class="chip">${esc(k.id)} · ${esc(k.title)}</span>`).join('')}</div>` : ''}${m.escalate ? '<div class="srcs"><span class="chip warn">Handed to Asha (account executive)</span></div>' : ''}</div>`;
}
function bindRoom() {
  const ask = async q => {
    if (!q.trim()) return;
    S.chat.push({ who: 'buyer', text: q }); render();
    $('#msgs').insertAdjacentHTML('beforeend', '<div class="msg bot"><span class="spin"></span></div>');
    const j = await post('/api/buyer', { input: q, kb: kb(), facts: { deal: 'Lumen Logistics', plan: S.map, account_exec: 'Asha Menon' } });
    if (j.error) S.chat.push({ who: 'bot', text: 'Sorry, something went wrong: ' + j.error });
    else {
      const r = j.result; S.chat.push({ who: 'bot', text: r.answer, sources: r.sources, escalate: r.escalate });
      audit('Buyer agent', r.escalate ? `Escalated: "${q}"` : `Answered "${q}" from ${r.sources.join(', ')}`);
      if (r.gap && !S.learn.some(l => l.q === q)) S.learn.unshift({ id: 'G' + Date.now(), q, source: 'Buyer Room, just now', title: `Buyer asked: “${q}”`, evidence: 'No approved answer in the Brain, so it went to Asha. Write one once and the Buyer Room answers it from now on.', section: 'Buyer-safe answers', write: true, owner: 'Needs an admin: buyers will see this' });
      if (r.escalate) S.today.unshift({ id: 'e' + Date.now(), deal: 'd1', kind: 'escalation', title: `Priya asked: “${q}”`, why: r.reason || 'Outside approved knowledge.', autonomy: 'Never auto' });
    }
    render();
  };
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => ask(b.dataset.q));
  $('#roomSend').onclick = () => ask($('#roomQ').value);
  $('#roomQ').onkeydown = e => { if (e.key === 'Enter') ask(e.target.value); };
  const m = $('#msgs'); m.scrollTop = m.scrollHeight; chatSeen = S.chat.length;
}

/* ---------------- Charts: inline SVG, no libraries; each has a text summary and the table below is the accessible alternative ---------------- */
const kfmt = n => n >= 1000 ? '$' + +(n / 1000).toFixed(1) + 'k' : '$' + n;
const C_REP = '#98a2b3', C_EV = '#0f766e';
function barChart(cats, series, label) {
  const W = 560, H = 250, L = 46, R = 8, T = 18, B = 34, max = Math.max(1, ...series.flatMap(s => s.vals)), top = Math.ceil(max / 20000) * 20000 || 20000;
  const gw = (W - L - R) / cats.length, bw = Math.min(46, (gw - 18) / series.length), y = v => T + (H - T - B) * (1 - v / top);
  const grid = [0, .25, .5, .75, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${y(top * f)}" y2="${y(top * f)}" class="ch-grid"/><text x="${L - 6}" y="${y(top * f) + 4}" text-anchor="end" class="ch-t">${kfmt(top * f)}</text>`).join('');
  const bars = cats.map((c, i) => { const x0 = L + gw * i + (gw - bw * series.length) / 2;
    return series.map((s, j) => { const v = s.vals[i], x = x0 + bw * j;
      return `<g><title>${esc(c)} · ${esc(s.name)}: ${money(v)}</title><rect x="${x}" y="${y(v)}" width="${bw - 3}" height="${Math.max(0, H - B - y(v))}" rx="3" fill="${s.color}" class="ch-bar" style="--d:${i * 60 + j * 30}ms"/>${v ? `<text x="${x + (bw - 3) / 2}" y="${y(v) - 5}" text-anchor="middle" class="ch-v">${kfmt(v)}</text>` : ''}</g>`; }).join('') +
      `<text x="${L + gw * i + gw / 2}" y="${H - 12}" text-anchor="middle" class="ch-t">${esc(c)}</text>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(label)}">${grid}${bars}</svg>`;
}
function donut(items, centre) {
  const total = items.reduce((a, i) => a + i.value, 0) || 1, R = 52, C = 2 * Math.PI * R; let off = 0;
  const arcs = items.filter(i => i.value).map(i => { const len = C * i.value / total, el = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${i.color}" stroke-width="22" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${esc(i.label)}: ${money(i.value)}</title></circle>`; off += len; return el; }).join('');
  return `<div class="donut"><svg viewBox="0 0 140 140" class="chart" role="img" aria-label="${esc(items.map(i => `${i.label} ${money(i.value)}`).join(', '))}">${arcs}<text x="70" y="68" text-anchor="middle" class="ch-big">${esc(centre)}</text><text x="70" y="84" text-anchor="middle" class="ch-t">open value</text></svg>
    <ul class="legend">${items.map(i => `<li><i style="background:${i.color}"></i><b>${esc(i.label)}</b> ${money(i.value)} <small>${Math.round(100 * i.value / total)}%</small></li>`).join('')}</ul></div>`;
}
function pipelineCharts(open) {
  const STG = ['Discovery', 'Evaluation', 'Proposal', 'Negotiation'], sum = f => open.filter(f).reduce((a, d) => a + d.amount, 0);
  const rep = STG.map(s => sum(d => d.stage === s)), ev = STG.map(s => sum(d => (d.evidenceStage || d.stage) === s));
  const ahead = open.filter(d => d.evidenceStage && STAGE_ORDER(d.evidenceStage) < STAGE_ORDER(d.stage)), aheadV = ahead.reduce((a, d) => a + d.amount, 0);
  const months = [...new Set(open.map(d => d.close.slice(0, 7)))].sort(), mLabel = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  const byMonth = months.map(m => open.filter(d => d.close.startsWith(m)).reduce((a, d) => a + d.amount, 0));
  const health = [['good', 'On track', '#067647'], ['watch', 'Watch', '#f79009'], ['risk', 'At risk', '#b42318']].map(([h, label, color]) => ({ label, color, value: sum(d => d.health === h) }));
  return `<div class="charts">
    <section class="panel wide"><h3>Pipeline by stage <small class="muted">rep-set vs evidence-supported</small></h3>
      ${barChart(STG, [{ name: 'Rep stage', color: C_REP, vals: rep }, { name: 'Evidence stage', color: C_EV, vals: ev }], 'Open pipeline value by stage, comparing the stage set by the rep with the stage the evidence supports')}
      <div class="legend inline"><span><i style="background:${C_REP}"></i>Rep stage</span><span><i style="background:${C_EV}"></i>Evidence stage</span></div>
      <p class="insight">${ahead.length ? `<b>${money(aheadV)}</b> in ${ahead.length} deal${ahead.length > 1 ? 's' : ''} sits ahead of its evidence (${ahead.map(d => esc(d.name)).join(', ')}).` : 'Every verified deal is at the stage its evidence supports.'} Unverified deals are shown at the rep stage.</p></section>
    <section class="panel"><h3>Deal health <small class="muted">by value</small></h3>${donut(health, money(open.reduce((a, d) => a + d.amount, 0)))}</section>
    <section class="panel"><h3>Expected closes <small class="muted">by month, rep dates</small></h3>${barChart(months.map(mLabel), [{ name: 'Open value', color: C_EV, vals: byMonth }], 'Open pipeline value by expected close month')}</section></div>`;
}
const STAGE_ORDER = s => ['Discovery', 'Evaluation', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'].indexOf(s);

/* ---------------- Pipeline ---------------- */
function viewPipeline() {
  const open = S.deals.filter(d => !d.stage.startsWith('Closed'));
  const repF = open.reduce((a, d) => a + d.amount * STAGE_P[d.stage], 0);
  const evF = open.reduce((a, d) => a + d.amount * STAGE_P[d.evidenceStage || d.stage], 0);
  const unverified = open.filter(d => !d.evidenceStage).length;
  return `<header class="page-h"><div><h1>Pipeline</h1><p class="sub">Manager view (Daniel Ortiz). The stage the rep sets sits next to the stage the evidence supports.</p></div></header>
  <div class="stats">
    <div class="stat"><b>${money(open.reduce((a, d) => a + d.amount, 0))}</b><span>open pipeline</span></div>
    <div class="stat"><b>${money(Math.round(repF))}</b><span>weighted, by rep stage</span></div>
    <div class="stat hl"><b>${money(Math.round(evF))}</b><span>weighted, by evidence${unverified ? ` (${unverified} unverified)` : ''}</span></div>
    <div class="stat"><b>${open.filter(d => d.evidenceStage && d.evidenceStage !== d.stage).length}</b><span>stage mismatches</span></div>
  </div>
  ${pipelineCharts(open)}
  <div class="panel"><h3>All open deals <small class="muted">the table behind the charts</small></h3><table class="pipe"><thead><tr><th>Deal</th><th>Owner</th><th>Amount</th><th>Rep stage</th><th>Evidence stage</th><th>Close</th><th>Why</th></tr></thead><tbody>
  ${open.map(d => { const mm = d.evidenceStage && d.evidenceStage !== d.stage; return `<tr><td><a href="#deal/${d.id}"><span class="dot ${d.health}"></span>${esc(d.name)}</a></td><td>${esc(d.owner)}</td><td>${money(d.amount)}</td><td>${esc(d.stage)}</td>
    <td class="${mm ? 'warn' : ''}">${esc(d.evidenceStage || 'Not verified')}${mm ? ' ⚠' : ''}</td><td>${dateFmt(d.close)}</td>
    <td class="small">${esc(d.fields ? (d.fields.risks.value || d.fields.next_step.value) : (d.risks?.[0] || d.evidence))}</td></tr>`; }).join('')}
  </tbody></table><p class="muted small">Evidence stage = your Brain's stage definitions applied to the captured evidence. Weights: Discovery 10%, Evaluation 25%, Proposal 50%, Negotiation 75%. Illustrative, not a forecasting model.</p></div>`;
}

/* ---------------- Ask ---------------- */
function viewAsk() {
  return `<header class="page-h"><div><h1>Ask your pipeline</h1><p class="sub">Plain-language questions, answered only from the record and its evidence.</p></div></header>
  <div class="panel"><div class="samples">${S.askSamples.map(a => `<button class="pill" data-a="${a.id}">${esc(a.q)}</button>`).join('')}</div>
  <div class="row"><input id="askQ" aria-label="Your question about the pipeline" placeholder="e.g. Which deals have no next meeting booked?"><button class="btn primary" id="askGo">Ask</button></div>
  <div id="askOut"></div></div>`;
}
function bindAsk() {
  const go = async (q, sampleId) => {
    $('#askOut').innerHTML = '<div class="empty"><span class="spin"></span> Reading pipeline…</div>';
    const pipeline = S.deals.map(d => ({ id: d.id, name: d.name, amount: d.amount, rep_stage: d.stage, evidence_stage: d.evidenceStage, close: d.close, owner: d.owner, health: d.health, risks: d.risks || [d.fields?.risks?.value].filter(Boolean), evidence: d.evidence || d.fields }));
    // Buyer Room signals: Brain suggestions that came from buyers, plus questions asked in this session.
    const buyer_questions = [...S.learn.filter(l => /buyer/i.test(l.source)).map(l => `${l.title}: ${l.evidence}`), ...S.chat.filter(m => m.who === 'buyer').map(m => m.text)];
    const j = await post('/api/ask', { input: q, sampleId, today: TODAY, pipeline, buyer_questions, brain: S.brain });
    if (j.error) return $('#askOut').innerHTML = `<div class="empty err">${esc(j.error)}</div>`;
    $('#askOut').innerHTML = `<h3>${esc(q)} <span class="chip ${j.mode}">${j.mode === 'live' ? 'live AI' : 'demo output'}</span></h3><div class="answer">${esc(j.result.answer).replace(/\n/g, '<br>')}</div>
      <div class="srcs">${j.result.deals.map(id => deal(id)).filter(Boolean).map(d => `<a class="chip" href="#deal/${d.id}">${esc(d.name)}</a>`).join('')}</div>`;
  };
  document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { $('#askQ').value = b.textContent; go(b.textContent, b.dataset.a); });
  $('#askGo').onclick = () => go($('#askQ').value, S.askSamples.find(a => a.q === $('#askQ').value)?.id);
  $('#askQ').onkeydown = e => { if (e.key === 'Enter') $('#askGo').click(); };
}

/* ---------------- Trust ---------------- */
const LEVELS = ['Suggest only', 'Approve', 'Auto + notify', 'Auto', 'Never auto'];
function viewTrust() {
  return `<header class="page-h"><div><h1>Agent controls</h1><p class="sub">You decide how much the agent does on its own, one action type at a time. Trust is earned, then granted.</p></div></header>
  <div class="grid2"><section class="panel"><h3>Autonomy</h3><table class="fields">${S.autonomy.map((a, k) => `<tr><td>${esc(a.action)}</td><td><select data-l="${k}" ${a.level === 'Never auto' ? 'disabled' : ''}>${LEVELS.map(l => `<option ${l === a.level ? 'selected' : ''}>${l}</option>`).join('')}</select></td></tr>`).join('')}</table>
    <p class="muted small">Discounts, legal and custom terms are locked to a human by policy (admin setting).</p>
    <div class="suggest"><b>Suggestion from the agent</b><p>You sent 23 of your last 25 meeting-recap emails without edits. Move <i>meeting recaps</i> to “Auto + notify”?</p><button class="btn ghost" id="sugg">Yes, for recaps only</button></div></section>
  <section><div class="panel"><h3>Guardrails that are always on</h3><ul class="small">
    <li>No field changes without a source quote. The quote is checked against the source text; if it isn't there, the change is blocked.</li>
    <li>The buyer agent answers only from approved knowledge. Anything else goes to a person.</li>
    <li>Every agent action is logged, explained and can be undone.</li>
    <li>Recording consent is captured per call. Data stays in your chosen region.</li></ul></div>
  <div class="panel"><h3>Audit log <small class="muted">this session</small></h3>${S.audit.length ? S.audit.map(a => `<p class="li"><small>${a.t}</small> <b>${esc(a.who)}</b> ${esc(a.what)}</p>`).join('') : '<p class="muted">Approve something in Today or run the capture agent to see it here.</p>'}</div></section></div>`;
}
function bindTrust() {
  document.querySelectorAll('[data-l]').forEach(s => s.onchange = () => { S.autonomy[s.dataset.l].level = s.value; audit('Asha', `Set "${S.autonomy[s.dataset.l].action}" to ${s.value}`); toast('Autonomy updated'); });
  // policy lock also holds in code, not just in the disabled dropdown
  document.querySelectorAll('[data-l]').forEach(s => { if (/discount|legal|custom/i.test(S.autonomy[s.dataset.l].action)) s.onchange = () => { S.autonomy[s.dataset.l].level = 'Never auto'; render(); }; });
  $('#sugg').onclick = () => { S.autonomy.splice(4, 0, { action: 'Send meeting-recap emails', level: 'Auto + notify' }); audit('Asha', 'Granted Auto + notify for meeting recaps'); render(); };
}

/* ---------------- About ---------------- */
function viewAbout() {
  return `<header class="page-h"><div><h1>About this prototype</h1><p class="sub">Accord (working name) · built for the 8th Element PM assignment by Jitendra Singh</p></div></header>
  <div class="grid2"><section class="panel"><h3>The idea</h3><p>CRM has been the seller's private notebook that reps fill in for managers. Accord makes it <b>two-sided and agent-run</b>:</p><ol>
    <li><b>Seller agent</b>: captures every call, email and chat, and keeps the record true. Every field cites its source.</li>
    <li><b>Buyer Room</b>: buyers (and their AI agents) get answers any time, only from approved content; anything else goes to a person.</li>
    <li><b>Manager truth</b>: the stage the rep claims next to the stage the evidence supports.</li>
    <li><b>Company Brain</b>: ACCORD.md, a versioned file the company owns (like CLAUDE.md for code). Every agent reads it; usage proposes cited additions that a person approves, so the CRM gets more specific to your company and product the more it is used.</li></ol>
    <p>Try: <a href="#today">Today</a> → review the Lumen call in <a href="#capture/s1">Capture</a> → see the <a href="#deal/d1">deal</a> fill in → ask the <a href="#room">Buyer Room</a> “What happens to our data if we cancel?” → it escalates and the gap lands in the <a href="#brain">Brain</a> → approve an answer → ask again and it answers → see the <a href="#pipeline">pipeline</a>.</p></section>
  <section class="panel"><h3>What is real and what is simulated</h3><ul class="small">
    <li><b>Real:</b> capture, Buyer Room and Ask call a large language model when the server has an API key (${LIVE ? 'on now: ' + esc(MODEL) : 'off now'}). The evidence check that blocks uncited changes runs in your browser on every result.</li>
    <li><b>Demo mode:</b> without a key, the three capture samples and the suggested Ask questions return hand-written outputs, and the Buyer Room uses keyword retrieval with a rule that sends commercial asks to a person.</li>
    <li><b>Simulated:</b> sending messages, integrations (email, calendar, WhatsApp, telephony, CRM sync), the MCP endpoint and the overnight activity. All companies, people and numbers are fictional.</li>
    <li>State lives in your browser tab; reload to reset.</li></ul></section></div>`;
}

/* ---------------- Brain ---------------- */
let brainEdit = false;
function viewBrain() {
  const learned = (S.brain.match(/\[learned:/g) || []).length, K = kb().length;
  return `<header class="page-h"><div><h1>Company Brain</h1><p class="sub">ACCORD.md: what every agent knows about Cobalt Route, its product and how it sells. You own it and can edit it like a document. Use makes it sharper: the agents propose additions, a person approves them.</p></div></header>
  <p class="muted small brainver" aria-live="polite">${S.brainVersion === S.brainStart ? `Brain v${S.brainVersion} · no changes yet this session` : `Brain v${S.brainStart} → v${S.brainVersion} this session · ${S.brainVersion - S.brainStart} approved change${S.brainVersion - S.brainStart > 1 ? 's' : ''}`}</p>
  <div class="stats">
    <div class="stat"><b>v${S.brainVersion}</b><span>current version</span></div>
    <div class="stat"><b>${learned}</b><span>lines learned from use</span></div>
    <div class="stat"><b>${K}</b><span>buyer-safe answers</span></div>
    <div class="stat hl"><b>${S.learn.length}</b><span>suggestions waiting</span></div>
  </div>
  <div class="grid2">
    <section class="panel brainfile"><div class="row" style="justify-content:space-between;margin:0 0 8px"><h3 style="margin:0">ACCORD.md <small class="muted">read by the seller agent, Buyer Room and Ask</small></h3>
      <span class="row" style="margin:0"><button class="btn ghost" id="brainDl">Download ACCORD.md</button><button class="btn ghost" id="brainEditBtn">${brainEdit ? 'Save' : 'Edit'}</button></span></div>
      ${brainEdit ? `<textarea id="brainText" rows="34">${esc(S.brain)}</textarea>` : `<div class="brainmd">${renderBrain(S.brain)}</div>`}
    </section>
    <section>
      <div class="panel"><h3>Learning inbox <small class="muted">nothing changes without your approval</small></h3>
      ${S.learn.length ? S.learn.map(l => `<article class="learn" data-id="${l.id}">
        <div class="card-top"><span class="kind">${esc(l.source)}</span><span class="auto">→ ${esc(l.section)}</span></div>
        <h4>${esc(l.title)}</h4><blockquote class="ev">${esc(l.evidence)}</blockquote>
        ${l.write ? `<textarea class="learn-ans" rows="3" placeholder="Write the approved answer buyers will see…"></textarea>` : `<pre class="learn-add">${esc(l.add)}</pre>`}
        ${l.owner ? `<p class="muted small">${esc(l.owner)}</p>` : ''}
        <div class="actions"><button class="btn primary" data-l="ok">Add to Brain</button><button class="btn ghost" data-l="no">Dismiss</button></div></article>`).join('') : '<div class="empty">Inbox clear. Ask the Buyer Room something it can’t answer to see a new suggestion appear.</div>'}
      </div>
      <div class="panel"><h3>How the Brain grows</h3><ul class="small">
        <li><b>Seeded</b> on day one from the website, past CRM deals and the sales playbook.</li>
        <li><b>Learns</b> from rep edits to drafts, buyer questions with no answer, won and lost deals, and objections heard on calls.</li>
        <li><b>Cited and approved:</b> every suggestion shows its evidence; buyer-facing answers need an admin.</li>
        <li><b>Portable:</b> plain markdown with version history. Export it any time.</li></ul></div>
    </section></div>`;
}
function bindBrain() {
  $('#brainDl').onclick = () => { // current Brain text, including unsaved edits in the editor
    const text = brainEdit ? $('#brainText').value : S.brain, a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' })); a.download = 'ACCORD.md'; a.click(); URL.revokeObjectURL(a.href);
    toast('Downloaded ACCORD.md');
  };
  $('#brainEditBtn').onclick = () => {
    if (brainEdit) { const t = $('#brainText').value; if (t !== S.brain) { S.brain = t; S.brainVersion++; audit('Asha', `Edited ACCORD.md (v${S.brainVersion})`); toast(`Brain saved as v${S.brainVersion}`); } }
    brainEdit = !brainEdit; render();
  };
  document.querySelectorAll('.learn [data-l]').forEach(b => b.onclick = () => {
    const el = b.closest('.learn'), l = S.learn.find(x => x.id === el.dataset.id);
    if (b.dataset.l === 'ok') {
      let lines = l.add;
      if (l.write) {
        const ans = el.querySelector('.learn-ans').value.trim(); if (!ans) return toast('Write the answer first');
        const n = kb().length + 1; lines = `### K${n} ${l.q.replace(/[?“”"]/g, '').slice(0, 60)}\n${ans}`;
      }
      const tag = ` [learned: ${dateFmt(TODAY)}, from ${l.source.toLowerCase()}]`;
      lines = lines.split('\n').map((x, k) => k === 0 ? x + tag : x).join('\n');
      if (!addToBrain(l.section, lines)) return toast('Section not found in ACCORD.md');
      audit('Asha', `Approved Brain update → ${l.section} (v${S.brainVersion})`); toast(`Added to ${l.section} · Brain v${S.brainVersion}. Every agent uses it from now on.`);
    } else { audit('Asha', `Dismissed Brain suggestion: ${l.title}`); toast('Dismissed'); }
    S.learn = S.learn.filter(x => x !== l); render();
  });
}

/* ---------------- Accounts (real server-side auth; prototype storage) ---------------- */
S.user = null;
function paintAcct() { $('#acctBtn').textContent = S.user ? `${S.user.name} · my account` : 'Sign in or create account'; }
function viewAccount() {
  const u = S.user;
  return `<header class="page-h"><div><h1>Account</h1><p class="sub">Prototype accounts: sign-up and sign-in are real, but storage is a file on the server that is wiped when the server restarts. Your name does not change the demo data.</p></div></header>
  <div class="panel narrow">${u ? `<table class="fields"><tr><td class="fl">Name</td><td>${esc(u.name)}</td></tr><tr><td class="fl">Email</td><td>${esc(u.email)}</td></tr><tr><td class="fl">Created</td><td>${esc(u.created)}</td></tr></table>
    <div class="row"><button class="btn" id="signOut">Sign out</button><button class="btn danger" id="delAcct">Delete my account</button></div>
    <p class="muted small">Passwords are hashed with scrypt and never stored in clear text. Deleting removes your name, email and password hash from the server.</p>`
    : `<p>You are using the demo without an account. Create one to see how sign-up and sign-in work.</p><div class="row"><button class="btn primary" id="acctSignIn">Sign in or create account</button></div>`}</div>`;
}
function bindAccount() {
  const go = async (path, msg) => { const j = await post(path, {}); if (j.error) return toast(j.error); S.user = null; paintAcct(); toast(msg); render(); };
  if ($('#signOut')) $('#signOut').onclick = () => go('/api/logout', 'Signed out');
  if ($('#delAcct')) $('#delAcct').onclick = () => confirm('Delete your account? This cannot be undone.') && go('/api/account/delete', 'Account deleted');
  if ($('#acctSignIn')) $('#acctSignIn').onclick = () => openAuth('signup');
}
function openAuth(mode = 'signup') {
  const old = $('#authModal'); if (old) old.remove();
  const from = document.activeElement, su = mode === 'signup';
  document.body.insertAdjacentHTML('beforeend', `<div class="tour-back" id="authModal"><div class="tour" role="dialog" aria-modal="true" aria-labelledby="authH"><form class="tour-body auth" id="authForm" novalidate>
    <div class="tabs" role="tablist"><button type="button" role="tab" aria-selected="${su}" data-m="signup">Create account</button><button type="button" role="tab" aria-selected="${!su}" data-m="login">Sign in</button></div>
    <h2 id="authH">${su ? 'Create your account' : 'Welcome back'}</h2>
    ${su ? '<label>Name<input name="name" autocomplete="name" maxlength="60" required></label>' : ''}
    <label>Email<input type="email" name="email" autocomplete="email" maxlength="120" required></label>
    <label>Password<input type="password" name="password" autocomplete="${su ? 'new-password' : 'current-password'}" maxlength="128" required>${su ? '<small class="muted">At least 8 characters</small>' : ''}</label>
    <p class="err" id="authErr" role="alert"></p>
    <button class="btn primary wide-btn" type="submit" id="authGo">${su ? 'Create account' : 'Sign in'}</button>
    <p class="muted small">Prototype accounts. Sign-up is real (password hashed with scrypt, secure session cookie) but stored in a file that resets when the server restarts. Use a throwaway password. No emails are sent.</p>
    <button type="button" class="linkbtn dark" id="authSkip">Continue without an account</button></form></div></div>`);
  const el = $('#authModal'), form = $('#authForm');
  const close = () => { document.removeEventListener('keydown', keys); el.classList.add('closing'); setTimeout(() => { el.remove(); from && from.focus && from.focus(); }, 160); };
  const keys = e => { if (e.key === 'Escape') return close(); if (e.key === 'Tab') { const f = [...el.querySelectorAll('input,button')], a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } };
  document.addEventListener('keydown', keys); el.addEventListener('mousedown', e => { if (e.target === el) close(); });
  $('#authSkip').onclick = close;
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { document.removeEventListener('keydown', keys); el.remove(); openAuth(b.dataset.m); });
  form.onsubmit = async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(form)), err = m => { $('#authErr').textContent = m; };
    if (su && !f.name.trim()) return err('Enter your name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) return err('Enter a valid email address');
    if (f.password.length < 8) return err('Password must be at least 8 characters');
    err(''); const btn = $('#authGo'); btn.disabled = true; btn.textContent = su ? 'Creating…' : 'Signing in…';
    const j = await post(su ? '/api/signup' : '/api/login', f);
    if (j.error) { err(j.error); btn.disabled = false; btn.textContent = su ? 'Create account' : 'Sign in'; return; }
    S.user = j.user; paintAcct(); toast(su ? `Welcome, ${j.user.name}` : `Signed in as ${j.user.name}`); close(); if (location.hash === '#account') render();
  };
  form.querySelector('input').focus();
}
document.addEventListener('click', e => { if (e.target.closest('#acctBtn')) S.user ? (location.hash = '#account') : openAuth('signup'); });
fetch('/api/me').then(r => r.json()).then(j => { S.user = j.user; paintAcct(); if (location.hash === '#account') render(); }).catch(() => {});

/* ---------------- Onboarding tour ---------------- */
const TOUR_KEY = 'accord_tour_seen';
const tourSeen = () => { try { return !!localStorage.getItem(TOUR_KEY); } catch { return false; } };
const tourMark = () => { try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* private mode: tour shows again, which is fine */ } };
const TOUR = [
  { k: 'Welcome', h: 'A CRM that keeps its own record', p: 'Today a CRM is a notebook that reps fill in for their managers. In Accord an agent reads your calls, emails and chats, proposes the updates, and you approve them. You sell; the record stays true.',
    art: `<span class="chip">${CH_ICON.call} Call</span><span class="chip">${CH_ICON.email} Email</span><span class="chip">${CH_ICON.whatsapp} WhatsApp</span><i class="arrow">→</i><span class="chip learned">Deal record, kept current</span>` },
  { k: 'Trust', h: 'Every change shows where it came from', p: 'The agent cannot change a field without quoting the exact words that justify it. If the quote is not in the source, the change is blocked. You can always open a field and see the evidence.',
    art: `<div class="mini-src">“we’ve set aside around sixty thousand dollars for year one”</div><i class="arrow">→</i><div class="mini-field"><small>Amount</small><b>$60,000</b><span class="chip conf-high">high · cited</span></div>` },
  { k: 'Buyer Room', h: 'Buyers get answers too, from approved content only', p: 'Each deal has a shared room for the buyer. Their questions are answered any time, only from answers your company approved. Discounts, custom terms and anything unknown go to a person.',
    art: `<div class="msg me">Do you support Okta SSO?</div><div class="msg bot">Yes, SAML 2.0 on Pro and above. <span class="chip">K1 · SSO</span></div><div class="msg bot esc">Can you give us 20% off? <span class="chip warn">Handed to Asha</span></div>`, col: true },
  { k: 'Company Brain', h: 'A file your company owns, that gets sharper with use', p: 'ACCORD.md holds your stages, voice, rules and approved answers. Every agent reads it first. When buyers ask something it cannot answer, it proposes an addition; nothing joins the Brain until a person approves.',
    art: `<pre class="learn-add">## Voice\n- Open with the point; never "hope this finds you well".\n- To finance contacts, lead with one proof number. <span class="chip learned">learned: from 5 rep edits</span></pre>`, col: true },
  { k: 'Try it', h: 'Two minutes, four clicks', p: 'Everything here is fictional demo data, and sending messages and integrations are simulated. The AI parts are real when the server has a model key; the sidebar badge tells you which mode you are in.',
    art: `<ol class="steps"><li>Open the <b>Lumen call</b> in Capture and run the agent</li><li>Apply the changes and watch the <b>deal record fill, with sources</b></li><li>In <b>Buyer Room</b>, ask “What happens to our data if we cancel?”</li><li>Open the <b>Brain</b>, approve the suggestion, and ask again</li></ol>`, col: true, last: true },
];
let tourStep = 0, tourFrom = null;
function openTour(start = 0) {
  if ($('#tour')) return;
  tourFrom = document.activeElement; tourStep = start;
  document.body.insertAdjacentHTML('beforeend', `<div class="tour-back" id="tour"><div class="tour" role="dialog" aria-modal="true" aria-labelledby="tourH"><div class="tour-body" id="tourBody"></div><div class="tour-foot" id="tourFoot"></div></div></div>`);
  paintTour(0); document.addEventListener('keydown', tourKeys);
  $('#tour').addEventListener('mousedown', e => { if (e.target.id === 'tour') closeTour(); });
}
function paintTour(dir) {
  const s = TOUR[tourStep], n = TOUR.length, body = $('#tourBody');
  body.className = 'tour-body' + (dir > 0 ? ' fwd' : dir < 0 ? ' bwd' : '');
  body.innerHTML = `<p class="kind">${esc(s.k)} · ${tourStep + 1} of ${n}</p><h2 id="tourH">${esc(s.h)}</h2><p class="tour-p">${esc(s.p)}</p><div class="tour-art${s.col ? ' col' : ''}">${s.art}</div>`;
  $('#tourFoot').innerHTML = `<div class="dots" aria-hidden="true">${TOUR.map((_, i) => `<i class="${i === tourStep ? 'on' : ''}"></i>`).join('')}</div>
    <button class="btn ghost" id="tourSkip">${s.last ? 'Explore on my own' : 'Skip tour'}</button>
    ${tourStep ? '<button class="btn" id="tourBack">Back</button>' : ''}
    <button class="btn primary" id="tourNext">${s.last ? 'Open the Lumen call' : 'Next'}</button>`;
  $('#tourSkip').onclick = () => closeTour();
  if (tourStep) $('#tourBack').onclick = () => tourGo(-1);
  $('#tourNext').onclick = () => s.last ? closeTour('#capture/s1') : tourGo(1);
  $('#tourNext').focus();
}
function tourGo(d) { const t = tourStep + d; if (t < 0 || t >= TOUR.length) return; tourStep = t; paintTour(d); }
function tourKeys(e) {
  if (e.key === 'Escape') return closeTour();
  if (e.key === 'ArrowRight') return tourGo(1);
  if (e.key === 'ArrowLeft') return tourGo(-1);
  if (e.key === 'Tab') { // keep focus inside the dialog
    const f = [...$('#tour').querySelectorAll('button')], first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}
function closeTour(go) {
  const el = $('#tour'); if (!el) return;
  tourMark(); document.removeEventListener('keydown', tourKeys); el.classList.add('closing');
  setTimeout(() => { el.remove(); if (go) location.hash = go; else if (tourFrom && tourFrom.focus) tourFrom.focus(); }, 160);
}
document.addEventListener('click', e => {
  if (e.target.closest('#tourOpen')) openTour();
  if (e.target.closest('#resetDemo')) { location.hash = '#today'; location.reload(); } // state is in-memory, so a reload restores the seed
});

/* ---------------- Router ---------------- */
const ROUTES = { brain: [viewBrain, bindBrain], today: [viewToday, bindToday], deal: [viewDeal], capture: [viewCapture, bindCapture], room: [viewRoom, bindRoom], pipeline: [viewPipeline], ask: [viewAsk, bindAsk], trust: [viewTrust, bindTrust], about: [viewAbout], account: [viewAccount, bindAccount] };
function render() {
  const [r, arg] = (location.hash.slice(1) || 'today').split('/');
  const [view, bind] = ROUTES[r] || ROUTES.today;
  $('#main').innerHTML = view(arg); bind && bind(arg);
  const route = r + '/' + (arg || ''); // entrance animation only when the page changes, not on every state update
  if (route !== lastRoute) { lastRoute = route; $('#main').classList.add('enter'); $('#main').querySelectorAll('.page-h,.stat,.card,.panel,.learn').forEach((el, i) => el.style.setProperty('--i', Math.min(i, 9))); setTimeout(() => $('#main').classList.remove('enter'), 900); }
  document.querySelectorAll('nav a').forEach(a => { const on = a.getAttribute('href').split('/')[0].slice(1) === r || (r === 'deal' && a.getAttribute('href') === '#pipeline'); a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  document.title = ({ today: 'Today', capture: 'Capture agent', deal: 'Deal', pipeline: 'Pipeline', ask: 'Ask', brain: 'Company Brain', room: 'Buyer Room', trust: 'Agent controls', about: 'About', account: 'Account' }[r] || 'Today') + ' · Accord';
  const n = S.today.filter(i => !S.done.has(i.id)).length; $('#badge').textContent = n || '';
  $('#main').focus({ preventScroll: true });
}
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
fetch('/api/status').then(r => r.json()).then(s => { LIVE = s.live; MODEL = s.model; $('#mode').textContent = LIVE ? 'Live AI · ' + MODEL : 'Demo mode · no API key'; $('#mode').className = 'mode ' + (LIVE ? 'live' : 'demo'); render(); }).catch(() => render());
render();
if (!tourSeen()) setTimeout(() => openTour(), 500); // first visit only
