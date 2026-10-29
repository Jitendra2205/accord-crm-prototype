/* Accord prototype - vanilla JS, hash routing, in-memory state (reload = reset). */
const S = structuredClone(window.SEED);
S.done = new Set(); S.chat = []; S.audit = []; S.captured = new Set();
let LIVE = false, MODEL = null, lastCapture = null;

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '$' + Number(n || 0).toLocaleString('en-US');
const deal = id => S.deals.find(d => d.id === id);
const dateFmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-';
const FIELD_LABEL = { stage: 'Stage', amount: 'Amount', close_date: 'Close date', next_step: 'Next step', pain: 'Pain / goal', decision_process: 'Decision process', competitors: 'Competitors', champion: 'Champion', economic_buyer: 'Economic buyer', risks: 'Risks' };
const STAGE_P = { Discovery: 0.1, Evaluation: 0.25, Proposal: 0.5, Negotiation: 0.75, 'Closed Won': 1, 'Closed Lost': 0 };
const CH_ICON = { call: '☎', email: '✉', whatsapp: '💬', room: '◧', doc: '▤' };

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
const inBrain = q => q && S.brain.replace(LEARNED, '').toLowerCase().includes(q.toLowerCase().trim());
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
      <textarea id="capText" rows="16" placeholder="Paste a call transcript, email or chat… (live AI mode only)">${esc(s ? s.text : '')}</textarea>
      <div class="row"><select id="capCh">${['call', 'email', 'whatsapp'].map(c => `<option ${s && s.channel === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <button class="btn primary" id="runCap">Run capture agent</button></div>
      <p class="muted small">${LIVE ? `Live AI: ${esc(MODEL)}. Your text is sent to the model and not stored.` : 'Demo mode: the three samples return pre-computed agent output. Set LLM_API_KEY on the server for live AI on any text.'}</p>
    </section>
    <section id="capOut" class="panel">${lastCapture ? renderCapture(lastCapture) : '<div class="empty">Pick a sample and run the agent. Try them in order 1 → 2 → 3 to watch the record fill itself.</div>'}</section>
  </div>`;
}

function renderCapture({ result, mode, source, sid }) {
  const d = deal('d1');
  const norm = x => x.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');
  const found = q => q && norm(source).includes(norm(q));
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
      <div id="msgs">${S.chat.length ? S.chat.map(msg).join('') : '<div class="empty">Ask about security, rollout, pricing or the pilot.</div>'}</div>
      <div class="samples">${ROOM_Q.map(q => `<button class="pill" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="row"><input id="roomQ" placeholder="Type a question…"><button class="btn primary" id="roomSend">Ask</button></div>
    </section>
  </div>`;
}
function msg(m) {
  if (m.who === 'buyer') return `<div class="msg me">${esc(m.text)}</div>`;
  const K = kb(), src = (m.sources || []).map(id => K.find(k => k.id === id)).filter(Boolean);
  return `<div class="msg bot ${m.escalate ? 'esc' : ''}">${esc(m.text)}${src.length ? `<div class="srcs">${src.map(k => `<span class="chip">${esc(k.id)} · ${esc(k.title)}</span>`).join('')}</div>` : ''}${m.escalate ? '<div class="srcs"><span class="chip warn">Handed to Asha (account executive)</span></div>' : ''}</div>`;
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
  const m = $('#msgs'); m.scrollTop = m.scrollHeight;
}

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
  <div class="panel"><table class="pipe"><thead><tr><th>Deal</th><th>Owner</th><th>Amount</th><th>Rep stage</th><th>Evidence stage</th><th>Close</th><th>Why</th></tr></thead><tbody>
  ${open.map(d => { const mm = d.evidenceStage && d.evidenceStage !== d.stage; return `<tr><td><a href="#deal/${d.id}"><span class="dot ${d.health}"></span>${esc(d.name)}</a></td><td>${esc(d.owner)}</td><td>${money(d.amount)}</td><td>${esc(d.stage)}</td>
    <td class="${mm ? 'warn' : ''}">${esc(d.evidenceStage || 'Not verified')}${mm ? ' ⚠' : ''}</td><td>${dateFmt(d.close)}</td>
    <td class="small">${esc(d.fields ? (d.fields.risks.value || d.fields.next_step.value) : (d.risks?.[0] || d.evidence))}</td></tr>`; }).join('')}
  </tbody></table><p class="muted small">Evidence stage = your Brain's stage definitions applied to the captured evidence. Weights: Discovery 10%, Evaluation 25%, Proposal 50%, Negotiation 75%. Illustrative, not a forecasting model.</p></div>`;
}

/* ---------------- Ask ---------------- */
function viewAsk() {
  return `<header class="page-h"><div><h1>Ask your pipeline</h1><p class="sub">Plain-language questions, answered only from the record and its evidence.</p></div></header>
  <div class="panel"><div class="samples">${S.askSamples.map(a => `<button class="pill" data-a="${a.id}">${esc(a.q)}</button>`).join('')}</div>
  <div class="row"><input id="askQ" placeholder="e.g. Which deals have no next meeting booked?"><button class="btn primary" id="askGo">Ask</button></div>
  <div id="askOut"></div></div>`;
}
function bindAsk() {
  const go = async (q, sampleId) => {
    $('#askOut').innerHTML = '<div class="empty"><span class="spin"></span> Reading pipeline…</div>';
    const pipeline = S.deals.map(d => ({ id: d.id, name: d.name, amount: d.amount, rep_stage: d.stage, evidence_stage: d.evidenceStage, close: d.close, owner: d.owner, health: d.health, risks: d.risks || [d.fields?.risks?.value].filter(Boolean), evidence: d.evidence || d.fields }));
    const j = await post('/api/ask', { input: q, sampleId, today: TODAY, pipeline, brain: S.brain });
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
  <div class="stats">
    <div class="stat"><b>v${S.brainVersion}</b><span>current version</span></div>
    <div class="stat"><b>${learned}</b><span>lines learned from use</span></div>
    <div class="stat"><b>${K}</b><span>buyer-safe answers</span></div>
    <div class="stat hl"><b>${S.learn.length}</b><span>suggestions waiting</span></div>
  </div>
  <div class="grid2">
    <section class="panel brainfile"><div class="row" style="justify-content:space-between;margin:0 0 8px"><h3 style="margin:0">ACCORD.md <small class="muted">read by the seller agent, Buyer Room and Ask</small></h3>
      <button class="btn ghost" id="brainEditBtn">${brainEdit ? 'Save' : 'Edit'}</button></div>
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

/* ---------------- Router ---------------- */
const ROUTES = { brain: [viewBrain, bindBrain], today: [viewToday, bindToday], deal: [viewDeal], capture: [viewCapture, bindCapture], room: [viewRoom, bindRoom], pipeline: [viewPipeline], ask: [viewAsk, bindAsk], trust: [viewTrust, bindTrust], about: [viewAbout] };
function render() {
  const [r, arg] = (location.hash.slice(1) || 'today').split('/');
  const [view, bind] = ROUTES[r] || ROUTES.today;
  $('#main').innerHTML = view(arg); bind && bind(arg);
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href').slice(1) === r || (r === 'deal' && a.getAttribute('href') === '#pipeline')));
  const n = S.today.filter(i => !S.done.has(i.id)).length; $('#badge').textContent = n || '';
  $('#main').focus({ preventScroll: true });
}
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
fetch('/api/status').then(r => r.json()).then(s => { LIVE = s.live; MODEL = s.model; $('#mode').textContent = LIVE ? 'Live AI · ' + MODEL : 'Demo mode · no API key'; $('#mode').className = 'mode ' + (LIVE ? 'live' : 'demo'); render(); }).catch(() => render());
render();
