// Pre-computed agent outputs for demo mode (no LLM key). Written by hand to match the
// built-in samples; every "evidence" string is an exact quote from the sample (checked in test.js).
module.exports = {
  capture: {
    s1: {
      brain_used: ['Proposal: economic buyer named; security review started.', 'Open with the point; never "hope this finds you well".'],
      summary: 'Pilot cut planned miles ~9% and the COO wants all six depots live before February peak. Budget is ~$60k for year one, but the CFO must sign and wants a 3-year ROI case; IT security review and a RouteMax quote stand in the way.',
      updates: [
        { field: 'amount', to: '60000', evidence: "we've set aside around sixty thousand dollars for year one", confidence: 'high' },
        { field: 'economic_buyer', to: 'Mark (CFO) - signs anything over $50k', evidence: 'Mark, our CFO, signs anything over fifty thousand', confidence: 'high' },
        { field: 'decision_process', to: 'CFO approval (needs 3-year ROI case) + IT security questionnaire (Tom) before anything moves', evidence: 'he will want a three-year ROI case, not just pilot numbers', confidence: 'high' },
        { field: 'next_step', to: 'Send ROI model before CFO meeting on 7 Nov; send security questionnaire to Tom today', evidence: "I've asked for thirty minutes with Mark on November 7th. Can you have the ROI model ready before then?", confidence: 'high' },
        { field: 'pain', to: 'Roll out to all six depots before February peak; pilot cut planned miles ~9%', evidence: 'our COO wants it in all six depots before peak season in February', confidence: 'high' },
        { field: 'competitors', to: 'RouteMax (quote requested by procurement; cheaper on paper)', evidence: 'procurement asked us to get a quote from RouteMax as well', confidence: 'high' },
        { field: 'close_date', to: '2026-11-30', evidence: 'If we sign by end of November, implementation fits before peak.', confidence: 'medium' },
        { field: 'stage', to: 'Evaluation', evidence: 'Tom in IT needs your security questionnaire before anything moves', confidence: 'medium' },
      ],
      stakeholders: [
        { name: 'Priya Raman', role: 'VP Operations - Champion', signal: 'Prefers Cobalt Route; set up the CFO meeting' },
        { name: 'Mark (CFO)', role: 'Economic buyer', signal: 'Not yet met; wants 3-year ROI' },
        { name: 'Tom (IT)', role: 'Security gate', signal: 'Will ask about SSO (Okta)' },
        { name: 'COO (name unknown)', role: 'Executive sponsor', signal: 'Wants all six depots before February' },
      ],
      next_steps: [
        { task: 'Send security questionnaire + SSO doc to Tom', owner: 'rep', due: '2026-10-29' },
        { task: 'Build 3-year ROI model from pilot data', owner: 'rep', due: '2026-11-05' },
        { task: '30-min CFO meeting (Priya, Mark, Asha)', owner: 'buyer', due: '2026-11-07' },
      ],
      risks: [
        { risk: 'Price competition from RouteMax', evidence: "they're cheaper on paper" },
        { risk: 'Economic buyer not engaged yet; deal is single-threaded through Priya', evidence: 'Mark, our CFO, signs anything over fifty thousand' },
      ],
      draft: { channel: 'email', to: 'Priya Raman', body: "Hi Priya,\n\nThanks for today. My notes, so we are working from the same plan:\n- Goal: all six depots live before February peak (Leeds pilot: ~9% fewer planned miles)\n- Tom: security questionnaire and our Okta SSO guide are in your Buyer Room today\n- Mark: I'll share a 3-year ROI model by 5 Nov, ahead of your 7 Nov meeting\n- Signing by end of November keeps rollout ahead of peak\n\nI've updated the plan in the Buyer Room. Tell me if I missed anything.\n\nAsha" },
    },
    s2: {
      brain_used: ['Implementation is a fixed fee. Never quote hourly rates.', 'Reference calls only after the security review has started.'],
      summary: 'The CFO wants a three-year cost breakdown including implementation fees before 7 Nov, and is wary because a past rollout ran 40% over on implementation. He also asked for a reference customer of similar size in UK logistics.',
      updates: [
        { field: 'economic_buyer', to: 'Mark Feld (CFO) - engaged by email 29 Oct', evidence: 'Priya has briefed me. Before we meet on the 7th', confidence: 'high' },
        { field: 'next_step', to: 'Send 3-year cost breakdown incl. implementation fees + ROI model before 7 Nov; line up a UK logistics reference', evidence: 'please send a three-year cost breakdown including implementation fees', confidence: 'high' },
        { field: 'risks', to: 'CFO sensitive to implementation overruns (last rollout 40% over budget)', evidence: 'Our last software rollout ran 40% over budget on implementation', confidence: 'high' },
        { field: 'decision_process', to: 'CFO approval (3-year ROI, 3-year cost incl. implementation, reference call) + IT security questionnaire (Tom)', evidence: "I'd also like to speak to a current customer of similar size, ideally in UK logistics.", confidence: 'high' },
      ],
      stakeholders: [{ name: 'Mark Feld', role: 'CFO - Economic buyer', signal: 'Engaged; focused on implementation cost risk' }],
      next_steps: [
        { task: '3-year cost breakdown with fixed implementation fee', owner: 'rep', due: '2026-11-05' },
        { task: 'Find a UK logistics reference customer of similar size', owner: 'rep', due: '2026-11-04' },
      ],
      risks: [{ risk: 'Implementation cost is the CFO\'s main objection', evidence: 'I will be looking hard at that line' }],
      draft: { channel: 'email', to: 'Mark Feld', body: "Hi Mark,\n\nThank you. Before the 7th I'll send a three-year cost breakdown. Our implementation is a fixed fee quoted in the proposal, so there are no hourly overruns; I'll show that line separately.\n\nOnce Tom's security review is under way, I'll set up a reference call with a customer of similar size.\n\nBest,\nAsha" },
    },
    s3: {
      brain_used: ['Cobalt Route supports SAML 2.0 single sign-on with Okta, Microsoft Entra ID and Google Workspace on the Pro plan and above.'],
      summary: 'IT has made Okta SSO a must-have. Priya asks to move the rollout start from 2 Dec to 18 Nov because the COO is pushing.',
      updates: [
        { field: 'risks', to: 'Okta SSO is a must-have for IT (supported on Pro plan - confirm plan in proposal)', evidence: 'Tom confirmed SSO via Okta is a must-have, not a nice-to-have', confidence: 'high' },
        { field: 'next_step', to: 'Confirm whether rollout can start 18 Nov (was 2 Dec) with implementation lead', evidence: 'can we start the depot rollout on 18 Nov instead of 2 Dec?', confidence: 'high' },
      ],
      stakeholders: [{ name: 'Tom Iqbal', role: 'IT & Security', signal: 'SSO via Okta required' }, { name: 'COO', role: 'Executive sponsor', signal: 'Pushing for earlier start' }],
      next_steps: [{ task: 'Check 18 Nov start with implementation lead', owner: 'rep', due: '2026-10-30' }],
      risks: [{ risk: 'Earlier start may compress security review', evidence: 'COO is pushing' }],
      draft: { channel: 'whatsapp', to: 'Priya Raman', body: "Hi Priya! Yes, we support SAML single sign-on with Okta on the Pro plan - the setup guide is in your Buyer Room. On 18 Nov: I'm checking with our implementation lead now and will confirm by tomorrow." },
    },
  },
  ask: {
    a1: { answer: '- Brightpath Medical Supplies ($92k): champion Elena Voss likely left (email bounced 27 Oct); no buyer reply in 16 days. Highest risk.\n- Meridian Couriers ($41k): close date 30 Nov is not supported; buyer says "we can only commit after our board on 10 Dec".\n- Lumen Logistics ($60k after review): CFO not yet met and RouteMax quote requested, but champion is strong and a CFO meeting is set for 7 Nov.', deals: ['d3', 'd6', 'd1'] },
    a2: { answer: '- Brightpath: rep says Negotiation, evidence says Proposal (no pricing discussion recorded; proposal opened once).\n- Lumen Logistics: rep says Proposal, evidence says Evaluation (security review not started; CFO not engaged).\n- Orbit Grocers is the reverse: rep says Discovery, but buyer activity suggests Evaluation.', deals: ['d3', 'd1', 'd4'] },
    a3: { answer: '- Security & SSO (Lumen, Tallis): answered from approved knowledge.\n- Implementation timeline and fees (Lumen, Meridian).\n- Pricing at volume (Orbit): escalated to the rep, because volume pricing is not in approved knowledge.\nSuggestion: add an approved answer on volume pricing bands to cut escalations.', deals: ['d1', 'd4', 'd6'] },
  },
};
