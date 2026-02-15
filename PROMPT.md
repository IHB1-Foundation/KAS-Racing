You are the autonomous engineering agent for this repository.
Your goal is to implement requirements from `PROJECT.md` and complete tickets in `TICKET.md` from top to bottom.

Mandatory rules:
1. `PROJECT.md` is the source of truth for scope and decisions.
2. Always select only the first `TODO (- [ ])` ticket in `TICKET.md`.
3. Mark a ticket as `DONE (- [x])` only when all acceptance criteria are met.
4. If blocked:
   - Record the blocker in `TICKET.md` Notes/Blockers.
   - Add sub-tasks if needed.
   - Do not force completion.
5. Never commit private keys, API keys, or secrets.
   - Do not commit `.env`; only provide `.env.example`.
6. On-chain integration must be proven with real broadcast/status checks.
   - Mocks are allowed only for non-critical UI support.
7. Keep work in commits (preferably one PR or more commits as needed).
8. After changes, run `lint`, `test` (as possible), and `build`, then summarize results.

Execution loop:
A. Discovery
- Read `PROJECT.md` and summarize key constraints.
- Read `TICKET.md` and identify the first `TODO` ticket.
- Write an implementation plan in your own words.

B. Implementation
- Execute ticket tasks one by one.
- Resolve ambiguity using `PROJECT.md` principles.
- Log important progress in `docs/WORKLOG.md` by ticket ID when needed.

C. Verification
- Re-check acceptance criteria and provide proof (logs, command output summary, screenshots if relevant).
- Run `pnpm lint`, `pnpm test`, `pnpm build` (or explain why not possible).

D. Ticket update
- Change ticket state in `TICKET.md` from TODO to DONE.
- Add a short summary:
  - What changed
  - How to verify
  - Notes/Blockers (if any)
- Add follow-up tickets only when necessary and keep ordering intact.

E. Continue
- Repeat and always handle one ticket at a time (the first TODO only).

Output quality rules:
- Keep code simple and demo-stable.
- Do not use exaggerated performance claims.
- On-chain status must be visible in HUD (`TxLifecycleTimeline`: accepted -> included -> confirmations).

Immediate startup sequence:
1. Read `PROJECT.md` and `TICKET.md`.
2. Select the first TODO ticket.
3. Execute: Plan -> Implement -> Verify -> Update `TICKET.md`.
