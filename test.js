// Self-check: node test.js
const assert = require('assert'), vm = require('vm'), fs = require('fs'), os = require('os'), path = require('path');
process.env.AUTH_FILE = path.join(os.tmpdir(), 'accord-test-users-' + process.pid + '.json'); // never touch real users
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
// server-side cite-or-block with a source: absent, too-short, unknown-field and bad-stage updates are dropped
const SRC = 'Priya: we have set aside around sixty thousand dollars for year one.';
const U = (field, to, evidence) => ({ field, to, evidence, confidence: 'high' });
const kept = ups => cleanCapture({ updates: ups }, SRC).updates.map(u => u.field);
assert.deepStrictEqual(kept([U('amount', '60000', 'sixty thousand dollars for year one'), U('amount', '1', 'not in the source at all'), U('amount', '1', 'a'), U('bogus', 'x', 'sixty thousand dollars'), U('stage', 'Won-ish', 'sixty thousand dollars'), U('stage', 'Proposal', 'sixty thousand dollars')]), ['amount', 'stage']);
const { COMMERCIAL } = require('./server');
for (const q of ['Can you give us 20% off?', 'any discount?', 'Will you promise the roadmap item?']) assert(COMMERCIAL.test(q), q);
assert(!COMMERCIAL.test('Do you support Okta SSO?'));

// accounts: sign up, wrong password, sign in, session cookie, sign out, delete
const { server } = require('./server');
server.listen(0, async () => {
  const base = 'http://localhost:' + server.address().port;
  const call = (p, body, cookie) => fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) }, body: body && JSON.stringify(body) });
  try {
    const u = { name: 'Test User', email: 'Test@Example.com', password: 'correct horse' };
    assert.strictEqual((await call('/api/signup', { ...u, password: 'short' })).status, 400, 'short password rejected');
    assert.strictEqual((await call('/api/signup', { ...u, email: 'nope' })).status, 400, 'bad email rejected');
    const su = await call('/api/signup', u), cookie = su.headers.get('set-cookie').split(';')[0];
    assert.strictEqual(su.status, 200); assert(/HttpOnly/i.test(su.headers.get('set-cookie')), 'cookie is HttpOnly');
    assert(!fs.readFileSync(process.env.AUTH_FILE, 'utf8').includes('correct horse'), 'password never stored in clear');
    assert.strictEqual((await call('/api/signup', u)).status, 409, 'duplicate email rejected');
    assert.strictEqual((await call('/api/login', { email: u.email, password: 'wrong password' })).status, 401);
    assert.strictEqual((await call('/api/login', { email: 'ghost@example.com', password: 'whatever12' })).status, 401);
    assert.strictEqual((await call('/api/login', { email: 'test@example.com', password: u.password })).status, 200, 'email is case-insensitive');
    assert.strictEqual((await (await call('/api/me', null, cookie)).json()).user.name, 'Test User');
    assert.strictEqual((await (await call('/api/me', null, cookie.slice(0, -3) + 'abc')).json()).user, null, 'forged cookie rejected');
    assert.strictEqual((await (await call('/api/me')).json()).user, null);
    assert.strictEqual((await call('/api/account/delete', {}, cookie)).status, 200);
    assert.strictEqual((await (await call('/api/me', null, cookie)).json()).user, null, 'deleted account has no session');
    fs.rmSync(process.env.AUTH_FILE, { force: true });
    console.log('ok');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { server.close(); }
});
