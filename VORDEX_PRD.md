# Vordex — Model Fusion

**Status: concept / PRD. Not built.**
**One line:** Instead of one model answering, Vordex runs several *different* models — each forced into a *different personality* — through a structured debate that converges into one jointly-written answer.

---

## 1. The insight

Every model has a blind spot, and so does every *prompt style*. Two things kill answer quality:

1. **Monoculture.** Asking one model (or the same model N times) gives you N variations of the same blind spot. Averaging them ("ensemble") just regresses to that model's mean.
2. **Agreeableness.** Even multiple models tend to converge politely — same tone, same assumptions — because they're all trained to be helpful and non-confrontational.

Vordex attacks both. The core move — **"force models into layers of personalities"** — is:

> **Distinct base models × distinct forced personas.** Never the same model twice. Personas engineered to *disagree*, not just differ in tone.

A Skeptic model and a Visionary model, argued out and reconciled in a shared workspace with **no single judge**, produce an answer that carries the strengths of each and the blind spot of none. It's a debate, not an average.

**Positioning:** this is not "pick the best model" (routing) and not "average the models" (ensembling). It's **adversarial collaboration** — structured disagreement that converges.

---

## 2. The pipeline (v2)

Four stages. The full matrix is **Model × Persona → Cross-Critique → Shared-Environment Consensus → Attribution.**

### Stage 1 — Parallel Drafts (Model × Persona matrix)

Each agent = **one distinct base model** wearing **one distinct persona**. They each draft an answer to the user's prompt *in parallel*.

| Agent | Base model (distinct) | Persona | Job |
|------|----------------------|---------|-----|
| A | model-1 | **Skeptic** | Attack the premise. Find what's wrong, missing, or overclaimed. |
| B | model-2 | **Visionary** | Push the ambitious, non-obvious answer. Ignore "can't." |
| C | model-3 | **Logician** | Rigor. Step-by-step correctness, definitions, edge cases. |
| D | model-4 | **Engineer** | Make it real, concrete, buildable. Constraints and tradeoffs. |
| … | model-N | (extensible) | e.g. Pragmatist, Historian, Contrarian, End-User. |

**Hard rules:**
- **Never the same base model twice** — model diversity is the whole point.
- **Personas force disagreement, not just tone** — the persona system prompt defines a *stance and success criteria*, so the Skeptic is genuinely trying to break the answer, not just "write skeptically."
- Drafts are produced blind to each other (no anchoring in round 1).

### Stage 2 — Cross-Critique (all-pairs)

Every agent reads **every other agent's draft** and critiques it. The instruction is specific:

> **Attack assumptions, not style.** No "I'd phrase this differently." Only "this claim is wrong / unsupported / misses X."

Output per agent: a set of critiques targeting the *assumptions and correctness* of the other drafts. This surfaces the disagreements explicitly instead of letting them get smoothed over.

### Stage 3 — Shared-Environment Consensus (no single judge)

The agents move into a **single shared draft document** with real tools: `write`, `edit`, `remove`. **All agents can edit it.** There is **no judge/aggregator model** deciding the winner — consensus emerges from the agents editing the same artifact, defending and revising in response to the Stage 2 critiques.

- The shared doc is the *environment*; edits are the *actions*.
- An agent can delete another's text if it can't survive the critiques; another can restore/rewrite it. Convergence = the doc stops changing (or a round cap is hit).
- This is the anti-"single point of failure" design: no one model's judgment is trusted to pick the answer.

### Stage 4 — Backprop Attribution (same shared environment)

The **Final Answer is jointly written** in that same shared document. Then:

> **All agents jointly score: who contributed what, at each stage.**

Attribution is computed *in the same environment* (not a separate pass) so it reflects the real edit history — which agent's draft/critique/edit survived into the final answer. This gives:
- A transparent record of provenance (useful for trust + debugging).
- A signal for **improving persona/model weighting over time** ("the Skeptic model consistently catches the errors that make it into the final" → weight it more).

---

## 3. Product surface

**Where it lives:** a mode inside chat (`/chat`) — the user toggles **Vordex / Model Fusion** for a turn (or sets it as default for hard questions). Not a separate app.

**What the user sees (progressive disclosure):**
1. A calm status while it runs — *"4 models drafting… cross-critiquing… reconciling…"* (the stages, not raw logs).
2. **The single final answer**, front and center. This is the product — one voice.
3. An expandable **"How this was fused"** panel:
   - The Model × Persona matrix (which model played which persona).
   - The key disagreements from Stage 2 (what the Skeptic caught, what got cut).
   - The attribution (who contributed what) as a compact bar/graph.

The default experience is *one clean answer*. The debate is available but never shoved at the user.

---

## 4. Requirements

### Functional
- **F1.** Run K agents (default 4, config 3–6), each a **distinct** model + distinct persona.
- **F2.** Stage 1: parallel, blind drafts.
- **F3.** Stage 2: all-pairs critique targeting assumptions/correctness.
- **F4.** Stage 3: a shared editable document with `write`/`edit`/`remove`, all agents acting, capped at R rounds, converging on stability.
- **F5.** Stage 4: jointly-written final answer + attribution scored from the edit history.
- **F6.** Surface: streamed status → final answer → optional "How this was fused" panel.
- **F7.** Graceful degradation: if only one model is available, fall back to **persona-only fusion** (same model, distinct personas) and label it honestly as reduced-diversity.

### Non-functional
- **N1. Latency budget.** 4 models × ~3 stages is many sequential calls. Target: first status <2s, final answer within a stated budget (e.g. 30–90s for "deep" mode). Parallelize Stage 1 and Stage 2 fully.
- **N2. Cost ceiling.** Per-fusion token budget cap; refuse/downshift beyond it.
- **N3. Determinism of structure.** The pipeline must not hang — hard round caps, per-stage timeouts, and a guaranteed final answer even if a stage degrades.
- **N4. Transparency.** Attribution must reflect the real edit history, not a post-hoc guess.

---

## 5. Architecture

```
User prompt
   │
   ├─ Stage 1  parallel drafts        (K distinct model×persona calls, concurrent)
   │
   ├─ Stage 2  all-pairs critique     (K calls, concurrent — each reads K−1 drafts)
   │
   ├─ Stage 3  shared doc consensus   (R rounds; agents call write/edit/remove on
   │                                    ONE shared document; no judge)
   │
   └─ Stage 4  joint final + attribution (write final in shared doc; score provenance)
```

**Key objects**
- `Fusion` — one run: prompt, config (K, personas, models, mode, budgets), status, timings.
- `Agent` — { model, persona, systemPrompt }.
- `Draft` — Stage-1 output per agent.
- `Critique` — Stage-2 output: { fromAgent, targetAgent, points[] }.
- `SharedDoc` — the Stage-3/4 artifact + an **edit log** (agent, op, span, ts) — this log powers attribution.
- `Attribution` — per-agent contribution scores derived from the edit log + survival into final.

**Server flow:** a dedicated `/api/fusion` route (NDJSON stream, like `/api/chat`) orchestrates the stages, emitting `{stage, status}` events for the UI and a final `{answer, matrix, disagreements, attribution}`.

---

## 6. The model roster (the real constraint)

The premise requires **≥3–4 genuinely different base models.** Today Simplicity routes to one free model (`deepseek-v4-flash-free` via OpenCode Zen). To ship true Vordex we need a roster across providers (the app already has `groq` / `nvidia` / `opencode` provider plumbing):

- Roster = an ordered list of distinct `(provider, model)` bindings; the orchestrator assigns **one per agent, no repeats**.
- If the roster has fewer distinct models than K, fill remaining agents with **persona-only** variants of an available model and **flag reduced diversity** in the "How this was fused" panel.

**This is the single biggest external dependency.** Without multiple real models, Vordex is persona-only — still useful (personas force disagreement), but not the full thesis.

---

## 7. Failure modes & mitigations

| Risk | Mitigation |
|-----|-----------|
| **Latency** (many sequential calls) | Parallelize Stage 1 & 2; cap Stage 3 rounds; per-stage timeouts; a "fast" mode (K=3, 1 critique round). |
| **Cost** (K× a normal turn) | Per-fusion token cap; reserve Vordex for "deep" requests; cheaper models for some personas. |
| **Agents collapse into agreement** | Personas defined as *stances with win-conditions*; Stage 2 requires attacking assumptions; a persistent Contrarian seat. |
| **Shared doc thrash / never converges** | Hard round cap R; stability check (diff below threshold = done); last-good snapshot always answerable. |
| **No single judge → mush** | Convergence rule + a lightweight *procedural* referee (enforces process, does not decide content). |
| **Attribution is hand-wavy** | Derive from the real edit log (spans that survive into final), not a self-report. |
| **One model API down** | Roster is resilient: skip/replace the seat, degrade to persona-only, keep answering. |

---

## 8. Success metrics

- **Quality lift:** blind A/B — Vordex answer vs single-best-model answer on hard prompts (reasoning, code, analysis). Target: humans prefer Vordex ≥60% on "hard" set.
- **Error catch rate:** % of factual/logical errors caught in Stage 2 that would have shipped in the single-model answer.
- **Convergence:** % of runs that reach a stable shared doc within R rounds.
- **Latency/cost:** p50/p95 time-to-final and tokens per fusion, within budget.
- **Trust:** % of users who open "How this was fused" and rate it useful.

---

## 9. Scope

**v1 (MVP)**
- K=4 fixed personas (Skeptic, Visionary, Logician, Engineer).
- Stage 1 parallel drafts + Stage 2 one round of all-pairs critique.
- Stage 3 shared doc, capped at ~2 edit rounds.
- Stage 4 joint final answer + **basic** attribution (draft-survival, not full backprop).
- Multi-model *if* a roster exists; else persona-only, clearly labeled.
- Chat mode toggle + a simple "How this was fused" panel.

**Later**
- Configurable personas / user-defined seats.
- Full backprop attribution feeding a **learned persona-model weighting** (personas that consistently improve the final get more say).
- More models, more seats, domain-specialized personas.
- Show the debate live (opt-in), not just the summary.

**Explicitly out of v1:** live multi-user editing of the shared doc, training/fine-tuning, non-text modalities.

---

## 10. Open questions

1. What's the minimum viable roster — how many *truly distinct* models can we reliably call, and at what cost?
2. Is "no single judge" actually better than a cheap procedural referee, or does pure shared-editing thrash? (Prototype both.)
3. How much of the debate should ever be shown? (Default hidden; the answer is the product.)
4. Does attribution need to be *scored by the agents* (as the diagram says) or *computed from the edit log*? The edit log is more trustworthy; agent-scoring is more in the spirit — possibly both.
5. Persona design is the whole ballgame — these prompts need real iteration to force genuine, useful disagreement rather than performative conflict.

---

*Vordex is the fusion engine behind Simplicity. Available to no one — yet.*
