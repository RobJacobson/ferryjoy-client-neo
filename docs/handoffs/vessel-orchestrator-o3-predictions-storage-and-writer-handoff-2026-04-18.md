# Handoff: O3 — Predictions storage and compare-then-write writer

**Status:** **Shipped** — `vesselTripPredictions` table, `batchUpsertProposals` /
`listByVesselTripScopes`, `predictionCompare` + `vesselTripPredictionPersistPlan`, tests;
orchestrator `updateVesselPredictions` **stub until O4** (see engineering memo §8).

## Context

**Roadmap:** [`docs/engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)

**Phase:** **O3** — Add **dedicated Convex persistence** for vessel-trip ML
prediction payloads (today full blobs exist only in memory on the trip object
and are **stripped** before `activeVesselTrips` / `completedVesselTrips`
writes). Implement **read → compare → write** in the **functions** layer with
**application-level diffing** (do not assume Convex skips no-op writes).

**Depends on:** **O1** (`orchestratorPipelines.ts`), **O2** (`buildTripCore` export,
parity tests). **Does not** require removing ML from `buildTrip`—that is **O4**.

**Coding standards:** [`.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc)
(TSDoc, module boundaries, Bun). Convex: see [`docs/convex_rules.mdc`](../convex_rules.mdc)
and project argument-validation / error-handling rules for public functions.

**Test comment sync:** If you touch
[`convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts`](../../convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts),
follow
[`vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md`](vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md)
§**Test and comment sync**.

---

## Goal

1. **Schema** — New table(s) and indexes to store **per-slot** or **per-document**
   prediction data keyed so a tick can **batch-load** existing rows and **upsert**
   updates. Exact **keying** is an open product decision (memo §7.1); pick a
   coherent scheme (e.g. by `VesselAbbrev` + prediction field + `TripKey` or
   `ScheduleKey`—document the choice in schema comments and architecture).

2. **Validators** — Reuse or mirror shapes from
   [`functions/vesselTrips/schemas.ts`](../../convex/functions/vesselTrips/schemas.ts)
   (`predictionSchema`, `ConvexPrediction`) where appropriate; avoid `any`.

3. **Writer semantics** — **Compare-then-write:** load current row (or embed
   read in a single mutation with `ctx.db.get`), normalize for equality (align
   with overlay semantics in
   [`tripEquality.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEquality.ts)
   — `PredTime` / `Actual` / `DeltaTotal` style—not raw object reference), and
   **skip** `patch` / `replace` when the stored projection would not change. See
   engineering memo §5.2.

4. **Functions layer** — `internalQuery` / `internalMutation` (or a small set)
   owned under e.g. `convex/functions/vesselTripPredictions/` (name TBD—keep
   distinct from **`functions/predictions/`** ML *parameter* tables). Expose a
   **narrow API** for “propose full prediction snapshot for key K → persist if
   changed.”

5. **Tests** — Unit or integration tests proving: **no write** when normalized
   values match; **write** when a normalized field changes. Colocate under
   `**/tests/**` per project rules.

6. **Documentation** — `convex/schema.ts` comment or `architecture.md` bullet:
   what the new table stores and how it relates to trip tables and
   `eventsPredicted` (if any).

---

## Non-goals (defer to O4 / O5 unless explicitly agreed)

- Do **not** remove **`applyVesselPredictions`** from **`buildTrip`** or change
  **`stripTripPredictionsForStorage`** behavior in the trip applier yet (**O4**).
- Do **not** require **`updateVesselOrchestrator`** to call the new writer in
  production **if** that would **duplicate** full ML work (trip still runs
  `buildTrip` with ML). **Recommended O3 deliverable:** storage + writer API +
  tests; **orchestrator tick** continues to use the **O1** `updateVesselPredictions`
  no-op until **O4** defines **single** recompute path after trips.
- Do **not** fully redesign **`appendPredictions`** “undefined slot” policy in
  O3 unless needed for writer inputs—can follow in a later change.
- Do **not** change timeline assembly contract end-to-end (**O5**); O3 may add
  notes for future readers only.

---

## Boundary: O3 vs O4

| O3 | O4 |
|----|-----|
| **Where** predictions live in the DB + how to upsert with diff | **When** the tick runs ML and **who** calls `buildTrip` without ML |
| Storage + mutations + tests | Orchestrator wires **`updateVesselPredictions`** after **`updateVesselTrips`**; strip path simplified |

If O3 only adds tables without orchestrator wiring, **update** the engineering
memo §8 and this handoff **Status** when merged; leave orchestrator README
describing **stub** until O4.

---

## Suggested implementation outline

### 1. Design doc (short, in PR description or `architecture.md`)

- **Primary key** for one stored prediction (vessel + field name + segment/trip
  identity).
- **Which fields** are stored (full `ConvexPrediction` vs minimal joined shape).
- **Relationship** to existing `eventsPredicted` / read-model joins (avoid two
  conflicting sources of truth without a plan).

### 2. `convex/schema.ts`

- `defineTable(...)` with `.index(...)` for lookups the writer needs (e.g. by
  vessel, by trip key).

### 3. `convex/functions/...`

- **internalMutation** `upsert...` / `replace...` that implements diff logic, or
  a **batch** mutation accepting an array of proposals.
- **internalQuery** to fetch current docs for a tick’s key set (if reads are not
  inlined in the mutation).
- Follow Convex patterns: validators on `args` and `returns`, thin wrappers
  vs heavy logic in plain TS helpers under `convex/domain/...` **only** if pure;
  DB access stays in mutations.

### 4. Domain helpers (optional)

- Pure **`predictionsEqualForStorage`** / normalization next to
  `updateVesselPredictions` if shared between mutation and tests.

### 5. Tests

- Table tests or mutation tests with `convex-test` / project harness as used
  elsewhere.
- Cases: identical proposal → **no** `db.replace` / **no** version bump if you
  assert via mock; changed `PredTime` (normalized) → write occurs.

### 6. Verification

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
bun test <paths you add>
```

---

## PR / review checklist

- [ ] Schema + indexes justified; no unindexed table scans on hot paths.
- [ ] Compare-then-write documented; no reliance on undocumented Convex no-op
  writes.
- [ ] Internal vs public API surface is minimal; secrets stay internal.
- [ ] TSDoc on new Convex functions and domain helpers.
- [ ] `architecture.md` (and memo §8 / revision history) updated for O3.
- [ ] Orchestrator test comments updated **only if** orchestrator files change.

---

## Suggested commit message

`feat(predictions): add vessel trip prediction persistence and diffing writer (O3)`

---

## Revision

- **2026-04-18:** Initial O3 handoff (Option B).
- **2026-04-18:** Marked **Shipped**; implementation merged (`vesselTripPredictions`,
  internal writer, tests, docs).
