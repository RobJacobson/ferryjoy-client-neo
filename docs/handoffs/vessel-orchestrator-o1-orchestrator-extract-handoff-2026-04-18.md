# Handoff: O1 — Vessel orchestrator pipeline extract

> **Current code note:** Orchestrator ordering and symbol names have evolved since this handoff.
> Live **`vesselLocations`** upsert runs **first** in [`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts);
> there is no `domain/vesselOrchestration/updateVesselLocations/` folder. See
> [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) for the shipped path.

## Context

**Roadmap:** [`docs/engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)

**Phase:** **O1** — Extract named pipeline functions from
`convex/functions/vesselOrchestrator/actions.ts` with **no change** to ML
placement, trip builders, or database semantics. Predictions remain computed
inside the vessel-trip pipeline (`buildTrip` → `applyVesselPredictions`) until
**O4**.

**Coding standards:** [`.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc)
(TSDoc on functions, `@param` / `@returns`, 80-char lines, double quotes, Bun,
module boundaries via folder `index.ts` where applicable).

---

## Goal

1. Replace the monolithic `updateVesselOrchestrator` handler body with **clear,
   named pipeline steps** aligned to domain folders:
   - `updateVesselLocations`
   - `updateVesselTrips` (see §Ordering — this step **includes** location upsert
     **between** plan and apply per **current** invariant)
   - `updateVesselPredictions` — **no-op** for O1 (documented; reserves hook for
     O3–O4)
   - `updateVesselTimeline` (maps to domain `updateTimeline` assembly + apply)

2. Keep **`actions.ts`** as a **thin shell**: load snapshot, validate, fetch WSF
   locations, build `tripDeps`, call pipelines in order, catch/log/rethrow.

3. **Behavior parity:** same mutations, same order, same arguments as today.

---

## Non-goals (do not do in O1)

- Do **not** remove `applyVesselPredictions` from `buildTrip` or change
  `computeVesselTripTickWritePlan` / `stripTripPredictionsForStorage` behavior.
- Do **not** add a predictions table or new mutations.
- Do **not** change cron, WSF adapter, or `getOrchestratorModelData` shape.
- Do **not** rename public Convex function registrations (`updateVesselOrchestrator`
  stays the internal action name unless product asks otherwise).

---

## Current behavior to preserve (ordering)

Read [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)
before editing. Today the sequence is:

1. `getOrchestratorModelData` snapshot + empty identity guard.
2. `fetchWsfVesselLocations(vesselsIdentity, terminalsIdentity)`.
3. `createDefaultProcessVesselTripsDeps(createScheduledSegmentLookup(ctx),
   createVesselTripPredictionModelAccess(ctx))`.
4. **`computeOrchestratorTripWrites({ convexLocations, activeTrips }, tripDeps)`**
   — trip **plan** + `tickStartedAt`.
5. **`bulkUpsert`** locations (`bulkUpsertArgsFromConvexLocations`).
6. **`applyVesselTripTickWritePlan(ctx, tripWrites)`**.
7. **`buildTimelineTickProjectionInput`** + **`applyTimelineTickProjectionWrites`**.

**Important:** Step 5 runs **after** plan computation and **before** trip apply.
O1 **must** keep this order. Naming “updateVesselLocations” as its own function
does not mean it runs *before* trip plan computation unless a later phase
changes invariants (see engineering memo §4.3).

---

## Recommended shape

### New module (suggested)

Add something like:

- `convex/functions/vesselOrchestrator/orchestratorPipelines.ts`

(or `tickPipelines.ts` — pick one name and stay consistent).

**Contents (conceptual):**

- **`updateVesselLocations`**
  - **Params:** `ctx`, `convexLocations` (same type as today).
  - **Behavior:** `ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert,
    bulkUpsertArgsFromConvexLocations(convexLocations))`.
  - **TSDoc:** States that this is the live-position upsert for one tick.

- **`updateVesselTrips`**
  - **Params:** `ctx`, and everything needed to call
    `computeOrchestratorTripWrites` then `applyVesselTripTickWritePlan`:
    `convexLocations`, `activeTrips`, `tripDeps` (`ProcessVesselTripsDeps`).
  - **Behavior:**
    1. `const { tripWrites, tickStartedAt } = await computeOrchestratorTripWrites(...)`.
    2. `await updateVesselLocations(ctx, convexLocations)`.
    3. `const applyTripResult = await applyVesselTripTickWritePlan(ctx, tripWrites)`.
    4. **Return** `{ applyTripResult, tickStartedAt }` for the timeline step.
  - **TSDoc:** Explicitly documents that location upsert happens **between** plan
    and apply to match current orchestrator invariants.

- **`updateVesselPredictions`**
  - **Params:** e.g. `ctx: ActionCtx` (and optionally `_args` placeholder for
    future use).
  - **Behavior:** `Promise.resolve()` or empty async body; **one-line comment**
    referencing O3–O4.
  - **TSDoc:** States O1 is a no-op; predictions still run inside trip `buildTrip`.

- **`updateVesselTimeline`**
  - **Params:** `ctx`, `{ applyTripResult, tickStartedAt }` matching
    `buildTimelineTickProjectionInput` inputs today.
  - **Behavior:** `buildTimelineTickProjectionInput` then
    `applyTimelineTickProjectionWrites` (move the existing helper from
    `actions.ts` into this module or keep helper private next to it).

Move **`createScheduledSegmentLookup`** and
**`applyTimelineTickProjectionWrites`** next to the pipelines module **or**
keep them in `actions.ts` if imports stay cleaner — prefer **one** orchestrator
file owning Convex I/O helpers used only by these pipelines.

### Thin `actions.ts` handler

After extraction, the handler should look like (pseudocode):

```typescript
const snapshot = await ctx.runQuery(...getOrchestratorModelData);
// identity guard
const convexLocations = await fetchWsfVesselLocations(...);
const tripDeps = createDefaultProcessVesselTripsDeps(...);

const { applyTripResult, tickStartedAt } = await updateVesselTrips(ctx, {
  convexLocations,
  activeTrips: snapshot.activeTrips,
  tripDeps,
});

await updateVesselPredictions(ctx);

await updateVesselTimeline(ctx, {
  applyTripResult,
  tickStartedAt,
});
```

Adjust destructuring to match your snapshot variable names (`activeTrips` vs
`snapshot.activeTrips`).

---

## Exports and module boundaries

- **Within** `convex/functions/vesselOrchestrator/`, relative imports between
  `actions.ts` and `orchestratorPipelines.ts` are fine.
- Do **not** deep-import domain internals beyond existing entry points
  (`domain/vesselOrchestration`, etc.) — follow
  [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md).
- If you add `index.ts` re-exports for the orchestrator package, only export
  what other modules need; O1 likely needs **no** new public API beyond the
  action.

---

## Tests

- Run existing tests:
  - `convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts`
    (if still relevant to orchestrator).
- If there is **no** direct test for `updateVesselOrchestrator`, consider adding
  a **minimal** unit test file that mocks `ActionCtx` **or** documents manual
  verification — **optional for O1** if timeboxed; parity is the bar.

### Test and comment sync (ongoing, all orchestrator phases)

When you change orchestrator **file names**, **pipeline function names**, or
**call order** under `convex/functions/vesselOrchestrator/`, update **module-level
and helper comments** in tests so they stay accurate. At minimum:

- [`convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts`](../../convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts)
  — top-of-file sequencing description and any helper JSDoc that names
  `updateVesselOrchestrator`, `applyTimelineTickProjectionWrites`, or equivalent.

This avoids stale references (e.g. to removed `executeVesselOrchestratorTick` or
pre-O1 inlined handlers) and matches **O2+** handoffs that touch trip builders
only indirectly.

---

## Verification commands

From repo root (use **Bun**):

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
```

Run targeted tests if present:

```bash
bun test convex/functions/vesselOrchestrator
```

---

## Documentation updates (same PR)

- [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) —
  short subsection: O1 structure, four named steps, predictions noop until O4.
- [`docs/engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md) —
  set **O1** row in §8 Status to **Done** when merged.

---

## PR / review checklist

- [ ] No behavior change: same mutation order and arguments.
- [ ] `updateVesselPredictions` is explicitly documented as no-op (O1).
- [ ] `updateVesselTrips` documents compute → locations → apply ordering.
- [ ] TSDoc on new exported functions per code-style rule.
- [ ] Lint + typecheck + convex typecheck green.
- [ ] README + engineering memo status updated.

---

## Suggested commit message

`refactor(vesselOrchestrator): extract O1 pipeline functions from updateVesselOrchestrator`

---

## Questions / escalations

- If product **requires** locations before trip **plan** computation, that is a
  **separate** invariant change — do **not** do it in O1; flag to maintainers and
  update the engineering memo open decisions.

---

## Revision

- **2026-04-18:** Initial O1 handoff for Option B implementation track.
- **2026-04-18:** Added §Test and comment sync for ongoing phase work.
