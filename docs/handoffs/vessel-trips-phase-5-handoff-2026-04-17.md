# Handoff: Vessel trips refactor — Phase 5 (optional surface + narrow cleanups)

**Date:** 2026-04-17  
**Audience:** implementation agent + product/ops (for the Convex-surface track)  
**Prerequisites:** Phases 0–4 complete. Four domain boundaries are in place: **updateVesselLocations**, **updateVesselTrips**, **updateVesselPredictions** (`applyVesselPredictions`), **updateTimeline** (`buildTimelineTickProjectionInput` + `applyTickEventWrites`). Canonical narrative: [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) — *Phased cleanup / reorg* **Phase 5**, and **§10 Suggested refactor sequence** item 8.

**Important:** [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) describes **two** different “Phase 5” ideas in different sections:

| Section | Phase 5 meaning |
| --- | --- |
| *Phased cleanup / reorg* | **Optional Convex surface** — split internal actions only if ops need separate retries/metrics |
| *§10 Suggested refactor sequence* | **Narrow cleanups** — unify storage vs overlay diff; audit mirror fields; remove dead paths behind tests |

This handoff treats Phase 5 as a **bucket**: pick **one or both** tracks based on priority. They can ship as **5A** (ops/Convex) and **5B** (internal refactors) in either order unless dependencies dictate otherwise.

---

## Goals

### Track 5A — Optional Convex / orchestrator surface

**Goal:** Give operators or observability tooling **clearer failure domains** and **optional** finer-grained scheduling/retries **only where justified** — without undoing the domain boundaries from Phases 3–4.

**Typical motivations (choose explicitly before coding):**

- Separate **retry** or **alerting** for “trip lifecycle failed” vs “timeline apply failed” vs “locations bulk upsert failed.”
- Per-concern **duration / success** metrics in logs or structured telemetry.
- **Rate-limit** or **isolate** a hot path (rare; validate need).

**Non-goals by default**

- Adding **public** `api.*` endpoints for vessel orchestration unless product requires it (today much of this is **`internal`**).
- Multiplying **network round-trips** per tick without measuring cost (cron already fires ~15s).
- Splitting **`completeAndStartNewTrip`** or other atomic mutations without a strong data model reason (see architecture *Risks and constraints*).

**Likely touchpoints (inventory before changing):**

- [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts) — `updateVesselOrchestrator`, `applyTickEventWrites`, fetch/load helpers.
- [`convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts) — branch sequencing, `Promise.allSettled` envelope.
- [`convex/crons.ts`](../../convex/crons.ts) — what is scheduled; [**Convex scheduler rules**](https://docs.convex.dev/scheduling) — schedule **internal** functions only.
- Internal **queries/mutations** already used by the action — splitting work may mean new **`internal.*`** wrappers with thin handlers (project convention: keep wrappers thin, logic in `domain/` / `functions` TS modules).

**Design constraints**

- Preserve **tick ordering** already documented: locations ∥ trip stack; within trip stack, **mutations before** `applyTickEventWrites`; **upsert-gated** projection unchanged.
- Any new internal entrypoints must remain **auth-appropriate** (`internalAction` / `internalMutation` patterns already in use).
- **Document** the operational story in [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) and, if needed, a short note in [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) *Phase 5* bullet so the two “Phase 5” sections stay aligned.

---

### Track 5B — Narrow cleanups (domain internals)

**Goal:** Reduce **accidental complexity** left intentionally after Phases 3–4: dual equality, mirror fields, logging noise, and dead semantics — **without changing observable product behavior** unless a bug is proven.

**Candidate work items** (from [`architecture.md` §9–10](../../convex/domain/vesselOrchestration/architecture.md); pick in order of pain):

1. **Storage vs overlay diff** — [`tripsEqualForStorage`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEquality.ts) vs [`tripsEqualForOverlay`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEquality.ts) (and call sites in [`processCurrentTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCurrentTrips.ts)): consider a single **change-summary** object or shared helper to avoid two deep compares diverging over time.
2. **Mirror / legacy fields** — Audit pairs called out in architecture (e.g. `LeftDock` / `LeftDockActual`, `AtDockActual` / `ArrivedCurrActual`); remove or document-only if redundant.
3. **Dead or misleading flags** — e.g. `shouldStartTrip` / commented paths in `TripEvents` if truly unused (prove with tests + grep).
4. **Logging** — Extract heavy inline logging from [`processCurrentTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCurrentTrips.ts) into a small helper to shrink the lifecycle file.
5. **Golden sequence test** — One integration-style test for: continuing trip → leave dock → arrive/complete (architecture §9 suggestion), if not already satisfied by existing suites.

**Constraints**

- **No** large behavioral change in a single PR; prefer **small, test-backed** steps.
- **Strip vs overlay** rule unchanged: [`stripTripPredictionsForStorage`](../../convex/domain/vesselOrchestration/updateVesselPredictions/stripTripPredictionsForStorage.ts) only where persistence requires it; overlay/timeline paths keep full ML-shaped rows.

---

## What Phase 5 is (and is not)

**In scope**

- Track **5A** and/or **5B** as selected above, with explicit rationale in the PR description.
- Doc updates: `architecture.md` Phase 5 bullets, `vesselOrchestrator` README, and stale comments (e.g. orchestrator action header still referring to “predictions inside `buildTrip` until Phase 4” — **update** to match shipped layout).

**Out of scope (unless escalated)**

- Rewriting **WSF adapters** or **identity sync** pipelines.
- **Frontend** trip UIs or new user-facing APIs.
- Changing **ML model** training contracts or `domain/ml` prediction math (orthogonal unless a cleanup PR touches types only).

---

## Verification

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
bun test convex/domain/vesselOrchestration/tests/
bun test convex/domain/vesselOrchestration/updateVesselTrips/tests/
```

After Convex schema or public API changes: `bun run convex:codegen`. [`convex/_generated/api.d.ts`](../../convex/_generated/api.d.ts) must remain **tool-generated only** (never hand-edit).

---

## Acceptance criteria

**General**

- [ ] PR states which track(s) (**5A**, **5B**, or both) and **why** (ops need vs tech debt).
- [ ] No intentional regression in tick ordering, upsert gating, or timeline apply semantics; existing tests green; new tests for any new internal surface or equality refactor.
- [ ] Docs/comments aligned with Phases 3–4 shipped layout (`buildTimelineTickProjectionInput`, `applyVesselPredictions`, `buildTripCore`).

**Track 5A (if done)**

- [ ] Operational rationale documented (retries/metrics/alerting).
- [ ] Scheduler uses **internal** functions only; no new `api` scheduling anti-patterns.
- [ ] `functions/vesselOrchestrator/README.md` updated for any new entrypoints or failure modes.

**Track 5B (if done)**

- [ ] Equality / mirror-field changes are **behavior-neutral** or **bug-fix** with evidence; strip/overlay call sites reviewed.
- [ ] Architecture §9/§10 Phase 5 wording updated if the “narrow cleanups” checklist moves forward.

---

## After Phase 5

Ongoing maintenance: treat the four concerns as the review boundary for future features (new timeline row types → projection; new ML fields → `appendPredictions` / `applyVesselPredictions`; new lifecycle rules → `processCurrentTrips` / `buildTrip` core).

**References**

- [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) — §6–§10, *Risks and constraints*, *Further thoughts*
- Phase 4 handoff: [`vessel-trips-phase-4-handoff-2026-04-17.md`](./vessel-trips-phase-4-handoff-2026-04-17.md)
