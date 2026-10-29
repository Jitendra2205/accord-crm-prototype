// All companies, people and numbers below are FICTIONAL demo data.
// Seller: "Cobalt Route" (fictional route-optimisation SaaS). Rep: Asha Menon. Manager: Daniel Ortiz.
window.TODAY = '2026-10-29';

window.SEED = {
  deals: [
    {
      id: 'd1', name: 'Lumen Logistics', amount: 45000, stage: 'Proposal', evidenceStage: null, close: '2026-12-31',
      owner: 'Asha Menon', health: 'watch', lastTouch: '2026-10-28', channelMix: 'Zoom, email, WhatsApp',
      fields: {
        stage: { value: 'Proposal', src: 'rep', note: 'Set by rep on 14 Oct' },
        amount: { value: '45000', src: 'rep', note: 'Rep estimate, 2 Oct' },
        close_date: { value: '2026-12-31', src: 'rep', note: 'Default end of quarter' },
        next_step: { value: 'Follow up', src: 'rep', note: 'Typed by rep' },
        pain: { value: 'Route planning is manual', src: 'rep', note: 'Typed by rep' },
        decision_process: { value: '', src: 'empty' },
        competitors: { value: '', src: 'empty' },
        champion: { value: 'Priya Raman (VP Operations)', src: 'evidence', quote: 'Priya Raman, VP Operations - signed pilot agreement', at: 'Pilot SOW, 30 Sep', conf: 'high' },
        economic_buyer: { value: '', src: 'empty' },
        risks: { value: '', src: 'empty' },
      },
      stakeholders: [
        { name: 'Priya Raman', role: 'VP Operations', tag: 'Champion', heat: 3, last: '2026-10-28' },
        { name: 'Tom Iqbal', role: 'IT & Security', tag: 'Unknown', heat: 0, last: null },
      ],
      timeline: [
        { at: '2026-10-28', ch: 'call', title: 'Zoom call with Priya Raman (32 min)', body: 'Recording + transcript captured. Agent has proposed updates, waiting for review.' },
        { at: '2026-10-21', ch: 'room', title: 'Buyer Room: Priya viewed "Pilot results - Leeds depot" (4 min)', body: '' },
        { at: '2026-10-14', ch: 'email', title: 'Email: pilot summary sent to Priya', body: '' },
        { at: '2026-09-30', ch: 'doc', title: 'Pilot SOW signed (Leeds depot)', body: '' },
      ],
    },
    {
      id: 'd2', name: 'Kestrel Foods', amount: 38000, stage: 'Negotiation', evidenceStage: 'Negotiation', close: '2026-11-14', owner: 'Asha Menon', health: 'good', lastTouch: '2026-10-28',
      risks: ['Legal redlines: 2 clauses outside playbook'], evidence: 'Redlined MSA received 28 Oct; signer named (Head of Legal).',
    },
    {
      id: 'd3', name: 'Brightpath Medical Supplies', amount: 92000, stage: 'Negotiation', evidenceStage: 'Proposal', close: '2026-11-20', owner: 'Ravi Kumar', health: 'risk', lastTouch: '2026-10-13',
      risks: ['Champion Elena Voss likely left (email bounced 27 Oct)', 'No buyer reply in 16 days', 'No pricing discussion recorded'], evidence: 'Last two emails unanswered; no call since 13 Oct; proposal opened once.',
    },
    {
      id: 'd4', name: 'Orbit Grocers', amount: 24000, stage: 'Discovery', evidenceStage: 'Evaluation', close: '2027-01-15', owner: 'Asha Menon', health: 'good', lastTouch: '2026-10-29',
      risks: [], evidence: '3 people opened pricing in Buyer Room 9 times in 48h, incl. a new finance stakeholder.',
    },
    {
      id: 'd5', name: 'Tallis Manufacturing', amount: 55000, stage: 'Evaluation', evidenceStage: 'Evaluation', close: '2026-12-12', owner: 'Ravi Kumar', health: 'good', lastTouch: '2026-10-27',
      risks: [], evidence: 'Pilot live: 41 of 45 drivers active this week; weekly check-in booked.',
    },
    {
      id: 'd6', name: 'Meridian Couriers', amount: 41000, stage: 'Proposal', evidenceStage: 'Proposal', close: '2026-11-30', owner: 'Ravi Kumar', health: 'watch', lastTouch: '2026-10-22',
      risks: ['Close date moved twice', 'Buyer: "after our board on 10 Dec"'], evidence: 'Buyer email 22 Oct: "we can only commit after our board on 10 Dec".',
    },
  ],

  today: [
    { id: 't1', deal: 'd1', kind: 'review', title: 'New call captured: Lumen Logistics, 28 Oct (32 min)', why: 'The agent found 8 possible record changes and a follow-up. Medium-confidence changes need your OK.', cta: 'Review in Capture', sample: 's1', autonomy: 'Approve' },
    { id: 't2', deal: 'd3', kind: 'risk', title: 'Brightpath: your champion may have left', why: 'Email to Elena Voss bounced on 27 Oct. Her public profile shows a new employer. $92k deal, no buyer reply in 16 days.', draft: { channel: 'email', to: 'Raj Patel (Director, Procurement)', body: "Hi Raj,\n\nElena and I were working on the route-planning rollout for your three distribution centres. I understand she has moved on. I'd like to make sure the work isn't lost: could we take 20 minutes next week to agree who owns it on your side?\n\nBest,\nRavi" }, evidence: [{ q: '550 5.1.1 Recipient address rejected: elena.voss@brightpath.example', at: 'Mail server bounce, 27 Oct' }], autonomy: 'Approve' },
    { id: 't3', deal: 'd4', kind: 'signal', title: 'Orbit Grocers is looking at pricing', why: '3 people opened the pricing page in the Buyer Room 9 times in 48h, including someone new from Finance (Leo Hart).', draft: { channel: 'whatsapp', to: 'Sam Okafor (Ops Manager)', body: "Hi Sam, I saw the team has been looking at the pricing options. Would a 15-minute walkthrough with Leo from finance help this week? Happy to work around your schedule." }, evidence: [{ q: 'pricing.html - 9 views, 3 viewers (sam@, leo.hart@, ops-team@)', at: 'Buyer Room analytics, 27-29 Oct' }], autonomy: 'Approve' },
    { id: 't4', deal: 'd2', kind: 'deal-desk', title: 'Kestrel redlines: 2 clauses outside your playbook', why: 'Liability cap raised to 3x fees (playbook max 1.5x) and payment terms 60 days (playbook max 45). Commercial terms always need a human.', evidence: [{ q: '§9.2 "...aggregate liability shall not exceed three (3) times the Fees..."', at: 'Redlined MSA v2, 28 Oct' }], cta: 'Route to deal desk', autonomy: 'Never auto' },
    { id: 't5', deal: 'd6', kind: 'update', title: 'Meridian: move close date to 18 Dec?', why: 'The buyer said they can commit only after their board meeting on 10 Dec. Current close date (30 Nov) is not supported by evidence.', evidence: [{ q: 'we can only commit after our board on 10 Dec', at: 'Email from Nadia Brooks, 22 Oct' }], change: { field: 'close_date', from: '2026-11-30', to: '2026-12-18', conf: 'medium' }, autonomy: 'Approve' },
    { id: 't6', deal: 'd1', kind: 'brain', title: 'Your Brain learned 3 things this week', why: 'From buyer questions, rep edits and calls. Approve them and every agent uses them from the next action on.', cta: 'Review in Brain', autonomy: 'Approve' },
  ],

  autoLog: [
    'Logged 9 emails and 3 meetings to the right deals',
    'Wrote meeting notes for Tallis weekly pilot check-in',
    'Added 2 new contacts from email signatures (Orbit Grocers, Tallis)',
    'Answered 4 buyer questions in Buyer Rooms from approved knowledge',
    'Updated Tallis next step from the calendar invite (high confidence)',
    'Read your Brain (ACCORD.md v7) before every draft and answer',
  ],

  autonomy: [
    { action: 'Log emails, calls and meetings to deals', level: 'Auto' },
    { action: 'Update fields from high-confidence evidence', level: 'Auto + notify' },
    { action: 'Update fields from medium/low-confidence evidence', level: 'Approve' },
    { action: 'Send follow-ups to buyers', level: 'Approve' },
    { action: 'Answer buyer questions from approved knowledge', level: 'Auto' },
    { action: 'Discounts, legal or custom terms', level: 'Never auto' },
  ],

  // Company Brain: ACCORD.md, a versioned file the customer owns (like CLAUDE.md for a codebase).
  // Every agent reads it. "## Buyer-safe answers" is the ONLY section the buyer agent may quote.
  // [learned: ...] marks a line added from day-to-day use after a person approved it.
  brainVersion: 7,
  brain: `# ACCORD.md - Cobalt Route sales brain
Seeded 2 Sep 2026 from cobaltroute.example, 212 past HubSpot deals and Sales Playbook v3. Edited by people, grown by use.

## Company and product
- We sell Cobalt Route: route-optimisation software for fleets of 50 to 1,000 vehicles.
- Core value: fewer planned miles and more on-time deliveries. Proof: a 6-week pilot at one depot.
- Plans: Pro (list $19 per vehicle per month) and Enterprise (custom).

## Ideal customer
- Logistics, food distribution and medical supplies with 3 or more depots.
- Strongest signal: an operations leader who owns fuel cost and has a peak season.

## Stage definitions
- Discovery: pain and owner named.
- Evaluation: pilot or demo agreed; IT or security contact known.
- Proposal: economic buyer named; security review started. [learned: 3 Oct, from 4 won deals]
- Negotiation: proposal accepted in principle; legal or procurement engaged.

## Voice
- Open with the point; never "hope this finds you well". [learned: 12 Oct, from 4 rep edits]
- Follow-ups under 120 words, one clear ask, one date.
- UK spelling for UK accounts.

## Rules
- Discounts above 10% need Daniel Ortiz's approval. Agents never offer discounts.
- Implementation is a fixed fee. Never quote hourly rates.
- Reference calls only after the security review has started.

## Objections
- "RouteMax is cheaper": compare 3-year total cost including implementation; share pilot data.
- "We tried route software before": offer a 6-week single-depot pilot with a miles baseline.

## Competitors
- RouteMax: lower list price; implementation billed hourly; no UK data hosting (per 2 lost-deal notes, Aug 2026).

## Buyer-safe answers
### K1 Single sign-on (SSO)
Cobalt Route supports SAML 2.0 single sign-on with Okta, Microsoft Entra ID and Google Workspace on the Pro plan and above. Setup usually takes under a day with your IT team.
### K2 Security and data
Data is encrypted in transit (TLS 1.2+) and at rest (AES-256), hosted on AWS in eu-west-2 (London) for UK customers. Our SOC 2 Type II report is available under NDA. The security questionnaire pack is in this room under Resources.
### K3 Implementation timeline
A typical rollout is 4-6 weeks for up to 10 depots: 1 week setup and data import, 2 weeks parallel run, then go-live depot by depot. Implementation is a fixed fee quoted in the proposal, with no hourly overruns.
### K4 List pricing
Pro plan list price is $19 per vehicle per month, billed annually, with a fixed one-time implementation fee. Volume pricing above 300 vehicles is set in your proposal by your account executive.
### K5 Pilot results (Leeds depot)
In the 6-week Leeds pilot, planned miles fell by about 9% versus the previous 6 weeks, measured on the same routes. Full method and data are in the "Pilot results" document in this room.
### K6 Integrations
Cobalt Route imports orders by API, SFTP or CSV and reads vehicle location from telematics providers through a REST API. ERP export is available as CSV or API.
`,

  // Learning inbox: changes the Brain proposes from usage. Nothing lands without a person's approval.
  learn: [
    { id: 'L1', source: 'Buyer Rooms', title: 'Buyers keep asking what happens to their data if they cancel', evidence: '3 buyers asked this month (Lumen, Tallis, Orbit). No approved answer, so all 3 went to a rep.', section: 'Buyer-safe answers', add: '### K7 Data after cancellation\nYou can export all your data as CSV or through the API at any time. After cancellation we keep it for 30 days so you can export it, then delete it permanently and confirm in writing.', owner: 'Needs an admin: buyers will see this' },
    { id: 'L2', source: 'Rep edits', title: 'Reps add the pilot result to every CFO email', evidence: 'In 5 of 6 emails to finance contacts, reps added the Leeds pilot number before sending.', section: 'Voice', add: '- To finance contacts, lead with one proof number from a pilot, then the cost.' },
    { id: 'L3', source: 'Calls and emails', title: 'CFOs worry about implementation overruns', evidence: 'Raised by the CFO at Lumen ("ran 40% over budget on implementation") and by the buyer at Meridian.', section: 'Objections', add: '- "Implementation will overrun": lead with the fixed implementation fee and offer a reference customer of similar size.' },
  ],
  map: [
    { step: 'Pilot at Leeds depot', owner: 'Both', due: '2026-10-15', done: true },
    { step: 'Pilot results reviewed by COO', owner: 'Lumen', due: '2026-10-25', done: true },
    { step: 'Security questionnaire completed', owner: 'Cobalt', due: '2026-11-03', done: false },
    { step: 'ROI model + 3-year cost reviewed with CFO', owner: 'Both', due: '2026-11-07', done: false },
    { step: 'Contract signed', owner: 'Lumen', due: '2026-11-30', done: false },
    { step: 'Rollout to 6 depots', owner: 'Cobalt', due: '2027-01-31', done: false },
  ],
  roomFiles: ['Pilot results - Leeds depot.pdf', 'Security questionnaire pack.zip', 'Proposal v2.pdf', 'ROI model (draft).xlsx'],

  samples: {
    s1: { channel: 'call', label: 'Call transcript - Priya Raman, 28 Oct', text:
`[Zoom call, 28 Oct 2026, 32 min. Transcript excerpt]
Asha: Thanks for making time, Priya. Last week you mentioned the pilot results went to leadership. Where did that land?
Priya: Good news mostly. The pilot at the Leeds depot cut planned miles by about nine percent, and our COO wants it in all six depots before peak season in February.
Asha: That's great. What does approval look like from here?
Priya: Budget is there, we've set aside around sixty thousand dollars for year one. But Mark, our CFO, signs anything over fifty thousand, and he will want a three-year ROI case, not just pilot numbers.
Asha: Understood. Have you two discussed timing?
Priya: I've asked for thirty minutes with Mark on November 7th. Can you have the ROI model ready before then?
Asha: Yes. Anything else that could slow this down?
Priya: Security. Tom in IT needs your security questionnaire before anything moves, and he will ask about SSO, we're on Okta.
Asha: We can send that today.
Priya: Also, to be transparent, procurement asked us to get a quote from RouteMax as well. I prefer you, but they're cheaper on paper.
Asha: Fair. Is there a date you need to sign by for February?
Priya: If we sign by end of November, implementation fits before peak.` },
    s2: { channel: 'email', label: 'Email from the CFO, 29 Oct', text:
`From: Mark Feld <mark.feld@lumen-logistics.example>
To: Asha Menon
Subject: Cobalt Route - before our 7 Nov call

Asha,
Priya has briefed me. Before we meet on the 7th please send a three-year cost breakdown including implementation fees. Our last software rollout ran 40% over budget on implementation, so I will be looking hard at that line.
I'd also like to speak to a current customer of similar size, ideally in UK logistics.
Regards,
Mark` },
    s3: { channel: 'whatsapp', label: 'WhatsApp from Priya, 29 Oct', text:
`Priya Raman (Lumen): Hi Asha, Tom confirmed SSO via Okta is a must-have, not a nice-to-have. Also can we start the depot rollout on 18 Nov instead of 2 Dec? COO is pushing 🙂` },
  },

  askSamples: [
    { id: 'a1', q: 'Which deals are at risk this month and why?' },
    { id: 'a2', q: 'Where is the stage set by the rep ahead of the evidence?' },
    { id: 'a3', q: 'What are buyers asking about most in Buyer Rooms?' },
  ],
};
