# Handoff: Implement memo Stage 4 (strict layering) — trip apply outside domain

**Date:** 2026-04-17  
**Audience:** implementation agent (primary); reviewers  
**Scope:** This note turns **memo Stage 4** and **Phase 4 Initiative A** from
[`vessel-orchestrator-phase4-handoff-2026-04-17.md`](vessel-orchestrator-phase4-handoff-2026-04-17.md)
into an executable plan. Optional follow-ups (**Stages 5–6**, Initiatives B–E) are
listed at the end; **ship Stage 4 first** unless product explicitly prioritizes
prefetch or docs-only work.

**Parent documents:**

- [`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md) — §4 Stage 4, §7 open questions
- [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) — execution path and folder map
- [`convex/domain/README.md`](../../convex/domain/README.md) — layering rule: domain must not depend on `functions/` **implementations**

**Completed prerequisites (do not redo):**

- Phase 1: [`applyVesselTripTickWritePlan`](../../convex/functions/vesselTrips/applyVesselTripTickWritePlan.ts) + [`VesselTripTickWritePlan`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/vesselTripTickWritePlan.ts)
- Phase 2: [`VesselTripPredictionModelAccess`](../../convex/domain/ml/prediction/vesselTripPredictionModelAccess.ts) + [`createVesselTripPredictionModelAccess`](../../convex/functions/predictions/createVesselTripPredictionModelAccess.ts)
- Phase 3: [`createVesselOrchestratorTickDeps`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts) (Strategy B — three deps)

---

## 1. Problem statement (current defect vs north star)

**North star** (memo §Purpose, domain README): trip lifecycle **computes** plans
and timeline **inputs** in **domain**; **`convex/functions/`** runs Convex
**mutations**. Domain must **not** import **`convex/functions/...`** modules to
execute persistence.

**Current defect:** [`processVesselTripsWithDeps`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts)
imports and awaits [`applyVesselTripTickWritePlan`](../../convex/functions/vesselTrips/applyVesselTripTickWritePlan.ts),
so the **domain → functions** dependency exists for that hop. The file also
takes [`ActionCtx`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts)
**only** to pass into the applier (see memo §1.7).

**Success:** After Stage 4, no domain module on the vessel-trip tick path
imports `functions/vesselTrips/applyVesselTripTickWritePlan` (or other functions
implementations). The orchestrator’s `processVesselTrips` dep is implemented in
**functions** and composes: **domain compute → apply → domain timeline assembly**.

---

## 2. Non-negotiable ordering (behavior parity)

Preserve exactly this pipeline (memo Stage 4, Phase 1 handoff):

1. **Build** [`VesselTripTickWritePlan`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/vesselTripTickWritePlan.ts):
   - Run **`processCompletedTrips`** then **`processCurrentTrips`** (same as today
     inside `processVesselTripsWithDeps`).
2. **`applyVesselTripTickWritePlan(ctx, plan)`** — **functions only**.
3. **`buildTimelineTickProjectionInput({ completedFacts, currentBranch, tickStartedAt })`**
   — **domain**, **after** step 2, using **persist-derived** `completedFacts` /
   `currentBranch` (including `successfulVessels` from batch upsert).

Do **not** reorder completed vs current builds; do **not** run timeline
assembly before mutations settle.

---

## 3. Suggested implementation shape (align with memo §4)

Work in **small commits**; run `bun run convex:typecheck` after moves that touch
imports across layers.

### 3.1 Domain: extract “plan-only” compute

Add a new exported function (exact name is implementer’s choice; memo suggests
something like `computeVesselTripTickWritePlan` or `buildVesselTripTickWritePlan`):

- **Inputs:** Mirror today’s `processVesselTripsWithDeps` **except** omit
  `ActionCtx` — i.e. `locations`, `tickStartedAt`, `ProcessVesselTripsDeps`,
  `activeTrips`, optional `ProcessVesselTripsOptions`.
- **Body:** Copy the existing logic from `processVesselTripsWithDeps` **up to
  and including** the construction of `{ completedHandoffs, current: currentFragment }`
  as a **`VesselTripTickWritePlan`** (same object passed to the applier today).
- **Output:** `{ plan: VesselTripTickWritePlan, tickStartedAt }` (or equivalent;
  `tickStartedAt` is already an input — pass through for the runner).

**Remove** from this domain function: any import of
`applyVesselTripTickWritePlan`, and **`ActionCtx`** in the signature.

Keep internal helpers (`buildTripTransitions`, `isCompletedTripTransition`,
`logVesselProcessingError`) either in the same module or split into a sibling file
under `processTick/` if that improves clarity — **no behavior change**.

### 3.2 Functions: thin runner used by `createVesselOrchestratorTickDeps`

Add a module under **`convex/functions/`** (memo leaves the exact path open;
reasonable options):

- Next to orchestrator: e.g. `functions/vesselOrchestrator/runProcessVesselTripsTick.ts`, **or**
- Next to vessel trips: e.g. `functions/vesselTrips/runProcessVesselTripsTick.ts`

The runner should:

1. Call the **domain** plan-only function.
2. `await applyVesselTripTickWritePlan(ctx, plan)`.
3. Call **`buildTimelineTickProjectionInput`** from
   `domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput`
   with the applier result + `tickStartedAt`.
4. Return **`VesselTripsTickResult`** (`{ tickStartedAt, tickEventWrites }`) —
   same type as today.

[`createVesselOrchestratorTickDeps`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts)
should wire **`deps.processVesselTrips`** to this runner (passing
`createDefaultProcessVesselTripsDeps(...)`) instead of calling
`processVesselTripsWithDeps` with `ctx`.

### 3.3 Deprecate or delete the old combined entry

- Either **delete** `processVesselTripsWithDeps` and update all call sites, **or**
  keep a **deprecated** thin wrapper in domain that calls plan-only + throws if
  used without the runner (avoid if it confuses tests).

**Call sites to audit** (grep `processVesselTripsWithDeps`):

- [`createVesselOrchestratorTickDeps.ts`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts) — switch to runner
- [`processVesselTrips.test.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tests/processVesselTrips.test.ts) — tests currently pass a fake `ActionCtx`; split:
  - **Plan + projection** tests: call plan-only + `buildTimelineTickProjectionInput` with **mocked** apply outputs where needed
  - **Full sequencing** with mutations: either move to `convex/functions/**/tests/` or use a test double that calls `applyVesselTripTickWritePlan` explicitly
- [`processCompletedTrips.test.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tests/processCompletedTrips.test.ts) — imports applier; align with new boundaries
- Docs: [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md),
  [`updateVesselTrips/index.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/index.ts),
  [`convex/domain/README.md`](../../convex/domain/README.md) bullet if the public entry name changes

### 3.4 Open question: where `applyVesselTripTickWritePlan` lives

Memo §7 asks whether the applier stays in `functions/vesselTrips/`, moves beside
the orchestrator, or becomes an internal mutation. **Stage 4 decision rule:**
pick the location that **avoids import cycles** and keeps the runner readable.
Moving the file is optional; **lifting the call site out of domain** is not optional.

---

## 4. Import cycle checklist

Before merging:

- **Domain** must not import from `functions/` except **schemas/types** where
  already allowed per [`convex/domain/README.md`](../../convex/domain/README.md).
- **Functions** may import domain compute + `buildTimelineTickProjectionInput`.
- Run `bun run convex:typecheck` — Convex bundler often catches cycles early.

---

## 5. Testing and verification

**Required:**

- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`
- Update or add tests so **plan construction** remains covered without requiring
  `ActionCtx` in domain unit tests where possible
- Run domain tests that previously used `processVesselTripsWithDeps` end-to-end;
  adjust fakes so the **runner** (or explicit apply + projection) matches
  production ordering

**Recommended manual sanity:**

- Grep for `from "functions/vesselTrips/applyVesselTripTickWritePlan"` under
  `convex/domain/` — should be **empty** after Stage 4.

---

## 6. Definition of done (Stage 4)

- [ ] Domain trip tick path does **not** import `applyVesselTripTickWritePlan` or
      take `ActionCtx` solely to invoke it.
- [ ] **`createVesselOrchestratorTickDeps`** uses a **functions-layer** runner
      that performs apply then `buildTimelineTickProjectionInput`.
- [ ] Ordering in §2 preserved; no intentional product/semantics change.
- [ ] Tooling green: `check:fix`, `type-check`, `convex:typecheck`, relevant tests.
- [ ] Brief PR note: scope, non-goals, and pointer to this handoff + memo §4.

---

## 7. After Stage 4 — optional backlog (do not bundle by default)

Use the original Phase 4 menu for prioritization; **one initiative per PR**
unless tightly coupled.

| Track | Source | Summary |
| --- | --- | --- |
| **Stage 5 — Prefetch** | Memo §4 Stage 5, Phase 4 Initiative C | Batch internal queries at tick entry; swap `ScheduledSegmentLookup` / `VesselTripPredictionModelAccess` implementations behind existing ports. **Trigger:** profiling. |
| **Stage 6 — Unified persist envelope** | Memo §4 Stage 6, Phase 4 Initiative B | Single typed “persistable tick” **or** document why locations / trips / timeline stay separate for `Promise.allSettled`. Ergonomics/docs-heavy. |
| **Phase 3 Strategy A** | Phase 4 Initiative D | Merge `processVesselTrips` + `applyTickEventWrites` into one dep (`runTripBranch`); align **metrics** with dashboards before merging timers. |
| **Hygiene / docs** | Phase 4 Initiative E | Fix stale handoff links; refresh memo §1 if needed; resolve `applyVesselTripTickWritePlan` placement note if Stage 4 moves files. |

**Explicitly out of scope for Stage 4:** changing parallel/success semantics,
splitting `completeAndStartNewTrip`, or ML/timeline product behavior unless a
bug is proven.

---

## 8. Quick reference — files that will likely change

| Area | Files |
| --- | --- |
| Domain compute split | [`processVesselTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts), possibly new sibling under `processTick/` |
| Functions runner | new file under `functions/vesselOrchestrator/` or `functions/vesselTrips/` |
| Wiring | [`createVesselOrchestratorTickDeps.ts`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts) |
| Applier (maybe unchanged) | [`applyVesselTripTickWritePlan.ts`](../../convex/functions/vesselTrips/applyVesselTripTickWritePlan.ts) |
| Timeline assembly | [`buildTimelineTickProjectionInput.ts`](../../convex/domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput.ts) |
| Tests | [`processVesselTrips.test.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tests/processVesselTrips.test.ts), [`processCompletedTrips.test.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tests/processCompletedTrips.test.ts), [`runVesselOrchestratorTick.test.ts`](../../convex/domain/vesselOrchestration/tests/runVesselOrchestratorTick.test.ts) if deps touch orchestrator |

---

## Document history

- **2026-04-17:** Initial Stage 4 implementation handoff (supervisory expansion of Phase 4 menu Initiative A + memo Stage 4).
