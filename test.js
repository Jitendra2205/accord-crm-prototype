// Self-check: node test.js
const assert = require('assert'), vm = require('vm'), fs = require('fs');
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(__dirname + '/public/data.js', 'utf8'), ctx);
const SEED = ctx.window.SEED, DEMO = require('./demo-outputs'), { cleanCapture, demoBuyer } = require('./server');
// same parse as kb() in app.js: "### K1 Title" entries under "## Buyer-safe answers"
const sec = SEED.brain.split(/^## /m).find(x => x.startsWith('Buyer-safe answers'));
SEED.kb = sec.split(/^### /m).slice(1).map(e => { const [h, ...r] = e.split('\n'); const [id, ...t] = h.split(' '); return { id, title: t.join(' '), text: r.join(' ').trim() }; });
assert.strictEqual(SEED.kb.length, 6, 'brain must hold 6 buyer-safe answers');
for (const out of Object.values(DEMO.capture)) for (const b of out.brain_used) assert(SEED.brain.includes(b), 'brain_used not in brain: ' + b);
assert(demoBuyer('What happens to our data if we cancel?', SEED.kb).gap, 'unknown question must be a Brain gap');
const k7 = SEED.learn.find(l => l.id === 'L1').add.split('\n');
assert.deepStrictEqual(demoBuyer('What happens to our data if we cancel?', [...SEED.kb, { id: 'K7', title: k7[0].slice(7), text: k7[1] }]).sources, ['K7'], 'approved Brain answer must be used');
for (const [sid, out] of Object.entries(DEMO.capture)) {
  const src = SEED.samples[sid].text;
  for (const u of out.updates) assert(src.includes(u.evidence), `${sid}: quote not in sample: ${u.evidence}`);
  for (const r of out.risks) assert(src.includes(r.evidence), `${sid}: risk quote not in sample: ${r.evidence}`);
}
assert.strictEqual(cleanCapture({ updates: [{ field: 'amount', to: '1', evidence: '' }] }).updates.length, 0, 'uncited update must be dropped');
assert(demoBuyer('Can you give us 20% off?', SEED.kb).reason.startsWith('Commercial'), 'discount must escalate as commercial');
assert.deepStrictEqual(demoBuyer('Do you support Okta SSO?', SEED.kb).sources, ['K1']);
assert(demoBuyer('What is your carbon policy for the moon?', SEED.kb).escalate, 'unknown must escalate');
for (const q of ['Where is our data hosted?', 'How long does rollout take for 6 depots?']) assert(!demoBuyer(q, SEED.kb).escalate, q);
console.log('ok');
