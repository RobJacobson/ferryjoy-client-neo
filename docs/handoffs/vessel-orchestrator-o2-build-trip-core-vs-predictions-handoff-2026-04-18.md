# Handoff: O2 — `buildTripCore` vs `applyVesselPredictions` (explicit split + parity)

**Status:** **Shipped** (see engineering memo §8 and `buildTrip.ts` / `buildTrip.test.ts`).

## Context

**Roadmap:** [`docs/engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)

**Phase:** **O2** — Make the **schedule + gates** half and the **ML prediction**
half of `buildTrip` **explicitly separable** at the function level, with **parity
tests**, while **production still composes them in one `buildTrip` call** until
**O4** (orchestrator predictions phase).

**Depends on:** **O1** complete (`orchestratorPipelines.ts`, thin `actions.ts`).

**Coding standards:** [`.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc)
(TSDoc, 80-char lines, double quotes, Bun, module boundaries).

**Test comment sync:** When touching orchestrator-related tests, follow
[`vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md`](vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md)
§**Test and comment sync (ongoing)** so headers and helper JSDoc stay accurate.

---

## Goal

1. **Export** the existing **`buildTripCore`** implementation in
   [`convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts)
   (today it is a **private** `const` after the `buildTrip` export). Export its
   result type (e.g. `BuildTripCoreResult`) if useful for callers and tests.

2. Keep **`buildTrip`** as the **single production entry** that composes:
   `buildTripCore` → `applyVesselPredictions` with the same arguments as today
   (no behavior change for `processCurrentTrips` / `processCompletedTrips` /
   `defaultProcessVesselTripsDeps`).

3. Add **parity tests** proving that for the same inputs,
   `buildTrip(...)` equals the **manual pipeline**:
   `applyVesselPredictions(predictionModelAccess, core.withFinalSchedule, core.gates)`
   where `core = await buildTripCore(...)`.

4. **Documentation:** Brief note in
   [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md)
   (trip lifecycle / `buildTrip` section) and/or
   [`updateVesselTrips/README.md`](../../convex/domain/vesselOrchestration/updateVesselTrips/README.md)
   that O2 split the implementation for testing and future O4 extraction.

---

## Non-goals (do not do in O2)

- Do **not** remove `applyVesselPredictions` from the **`buildTrip`** composition
  in production yet (that is **O4** with orchestrator wiring).
- Do **not** change **`computeVesselTripTickWritePlan`**, **`stripTripPredictionsForStorage`**,
  or **`orchestratorPipelines.ts`** except for doc cross-references if needed.
- Do **not** add a predictions **table** or new Convex mutations (**O3**).
- Do **not** change **`appendPredictions`** “only `undefined` fields” policy yet
  (separate product decision; may follow O3+).

---

## Baseline (current code)

- **`buildTrip`** (`buildTrip.ts`) awaits **`buildTripCore`** (private), then
  **`applyVesselPredictions(predictionModelAccess, core.withFinalSchedule, core.gates)`**.
- **`buildTripCore`** returns `{ withFinalSchedule, gates }` where `gates` is
  **`VesselPredictionGates`**.
- Callers inject **`buildTrip`** via **`ProcessVesselTripsDeps`** / **`processCompletedTrips`**
  (`defaultProcessVesselTripsDeps` wires the real `buildTrip`).

---

## Implementation steps

### 1. Export `buildTripCore` and types

- Change **`buildTripCore`** from private to **`export`** (or **`export async function
  buildTripCore`** — match existing style: `const` arrow vs function declaration
  per surrounding file).
- Export **`BuildTripCoreResult`** (currently `type BuildTripCoreResult` at top
  of `buildTrip.ts`) if tests or external docs need it; otherwise export only
  **`buildTripCore`** and infer where possible.
- Ensure **module-level file comment** at top of `buildTrip.ts` still describes
  the module; extend it to mention **O2 explicit core vs ML tail**.

### 2. Keep `buildTrip` behavior-identical

- **`buildTrip`** should remain a thin composer:
  `const core = await buildTripCore(...); return applyVesselPredictions(...)`.
- **No** signature changes to **`buildTrip`** unless strictly necessary (prefer
  none).

### 3. Parity tests

Add or extend
[`convex/domain/vesselOrchestration/updateVesselTrips/tests/buildTrip.test.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tests/buildTrip.test.ts):

- Import **`buildTripCore`** alongside **`buildTrip`**.
- New **`describe`** block e.g. `"buildTrip O2 parity (core + predictions)"`.
- For **at least two** scenarios (one **at-dock** path and one **at-sea** path if
  feasible with existing fixtures, or two distinct cases already covered in the
  file), assert:

  ```text
  await buildTrip(...)  deep-equals  await applyVesselPredictions(
    predictionModelAccess,
    (await buildTripCore(...)).withFinalSchedule,
    (await buildTripCore(...)).gates
  )
  ```

  **Important:** avoid **double** `buildTripCore` work with different async
  timing side effects — prefer **one** `const core = await buildTripCore(...)`
  then `applyVesselPredictions(..., core.withFinalSchedule, core.gates)` vs
  `buildTrip(...)`, or use a small local helper inside the test to avoid
  duplicate calls.

- Use the **same** stubs as existing `buildTrip` tests (`testBuildTripAdapters`,
  `createTestPredictionAccess`, etc.).

- If **deep equality** is brittle on optional fields, align with existing test
  utilities in that file (e.g. compare strip-shaped subsets) — document the
  choice in the test comment.

### 4. Module `index.ts` (optional)

- **`updateVesselTrips/index.ts`** does **not** need to re-export **`buildTripCore`**
  for O2 unless a **production** caller outside `tripLifecycle/` needs it.
  Prefer **narrow** surface: tests may **deep-import**
  `tripLifecycle/buildTrip.ts` per project test rules.

### 5. Docs

- **`architecture.md`**: one short subsection or bullet under vessel trip / tick
  flow: O2 exports **`buildTripCore`**; ML remains **`applyVesselPredictions`**;
  **`buildTrip`** composes both.
- **`updateVesselTrips/README.md`**: optional one paragraph if it describes
  `buildTrip`.

---

## Verification commands

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
bun test convex/domain/vesselOrchestration/updateVesselTrips/tests/buildTrip.test.ts
bun test convex/functions/vesselOrchestrator
```

---

## PR / review checklist

- [ ] `buildTripCore` exported; `buildTrip` composition unchanged semantically.
- [ ] New parity tests pass; no flaky timing assumptions.
- [ ] TSDoc updated on `buildTrip` / `buildTripCore` as needed (`@param` /
  `@returns`).
- [ ] Lint + typecheck + convex typecheck green.
- [ ] `architecture.md` (and README if touched) updated.
- [ ] Orchestrator test comments unchanged **unless** this PR edits orchestrator
  files — if so, apply **test comment sync** (see O1 handoff).

---

## Suggested commit message

`refactor(vesselTrips): export buildTripCore and add O2 parity tests`

---

## Revision

- **2026-04-18:** Initial O2 handoff (Option B).
- **2026-04-18:** Marked **Shipped**; parity tests and exports landed in repo.
