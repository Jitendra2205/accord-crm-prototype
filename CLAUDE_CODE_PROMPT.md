Paste this into Claude Code, opened in the `accord` folder.

---

You're working on Accord, a prototype for my 8th Element PM assignment ("Reimagine CRM for the future of sales"). Read CLAUDE.md and README.md first. The app works today in demo mode; I need it deployed, checked in live-AI mode, and lightly polished. Submission deadline: Sunday 1 Nov 2026, 11:59 PM IST.

Do these in order and stop to show me the result after steps 2 and 4.

1. Check: run `node test.js` and start the server locally. Click through the README demo path and the Brain loop in a browser (Playwright is fine). Fix anything broken. Don't add npm dependencies.

2. GitHub: create a public repo named `accord-crm-prototype` under my account (Jitendra2205) with `gh`, commit everything, push to `main`. Then tell me the exact Render steps: New → Blueprint → this repo, and where to paste `LLM_API_KEY`.

3. Live-AI check: I'll give you a Gemini key as an environment variable, never in a file. Start the server with it and run:
   - All 3 capture samples. Every update must have a quote found in the source, `brain_used` lines must be found in the Brain, the stage proposal for sample 1 must follow the Brain's stage definitions, and drafts must follow the Brain's Voice section.
   - Buyer Room: "Do you support Okta SSO?" (answer with K1), "Can you give us 20% off?" (escalate, gap false), "What happens to our data if we cancel?" (escalate, gap true, then answered after approving K7 in the Brain).
   - Ask: the 3 suggested questions.
   If outputs break a rule, tighten the prompts in server.js. Do not loosen the code checks. Report each case in one line: pass or fail, and what you changed.

4. Polish, small and safe:
   - Add a "Download ACCORD.md" button on the Brain page (the current Brain text as a .md file).
   - Add a "Reset demo" link in the sidebar footer (reloads the seed state).
   - Check the layout at 390px width: no horizontal scroll on any page.
   - On the Brain page, show a small "Brain v7 → v<n> this session" line so the growth is visible.
   Run `node test.js` and the click-through again, commit, push.

5. Finally, give me:
   - the live Render URL to put on deck slides 19 and 21 and in the engineering doc,
   - a 5-minute demo script (what to click, what to say), including the Brain loop.

Constraints: keep it zero-dependency Node + vanilla JS; keep all data fictional and labelled; don't claim anything is real that is simulated; escape all model output.
