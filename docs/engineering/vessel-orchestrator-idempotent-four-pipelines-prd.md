# Vessel orchestrator idempotent four-pipeline PRD

**Status:** Canonical target implementation memo for the current refactor  
**Audience:** Engineers and coding agents working in
`convex/functions/vesselOrchestrator`,
`convex/domain/vesselOrchestration`, and adjacent Convex modules  
**Scope:** Public interfaces, layer ownership, migration order, and coding rules
for `updateVesselLocations`, `updateVesselTrips`,
`updateVesselPredictions`, and `updateVesselTimeline`

---

## 1. Purpose

This memo locks down the intended end state of the vessel orchestrator refactor.
It is meant to remove discretion about the major architectural changes so
multiple agents can work on different pipelines in parallel while staying
consistent at the public-interface level.

This document is intentionally more prescriptive than the earlier memos. The
earlier docs explain history and rationale; this one defines the target
contracts and implementation rules.

---

## 2. Summary of decisions

1. The orchestrator is four sequential pipelines:
   - `updateVesselLocations`
   - `updateVesselTrips`
   - `updateVesselPredictions`
   - `updateVesselTimeline`
2. Each pipeline has one public domain entrypoint:
   - black-box `input -> output`
   - no public dependency bag
   - no `ActionCtx`
   - no database access
   - no knowledge of other pipelines beyond explicit handoff data
3. `convex/functions` owns orchestration and persistence:
   - gather input data
   - call one domain function
   - dedupe by table-specific identity and equality rules
   - persist rows
   - pass handoff data to the next pipeline
4. `convex/domain` owns computation only:
   - transform input data into computed POJOs
   - emit rows for its own concern
   - emit handoff data for downstream stages
5. `updateVesselTrips` computes on every tick.
   - It does not decide whether the tick is "worth processing."
   - Event boundaries may still affect how trips are computed.
   - Event boundaries should not decide whether the pipeline runs.
6. `updateVesselPredictions` must stop querying Convex through domain-facing
ports. The functions layer will preload a large prediction context blob and pass
it in as plain data.
7. Temporary internal mess is acceptable during the refactor.
   - Leaky public interfaces are not acceptable.
   - Stable public contracts are more important than elegant internal helpers.
8. Backwards compatibility between intermediate refactor steps is not required.
   - Coherent, compilable checkpoints are required.
   - Public interface churn should happen deliberately, not implicitly.

---

## 3. Why this refactor exists

The current codebase is part-way through a multi-step decomposition of a
previously monolithic orchestrator. The old code mixed:

- external fetches
- Convex reads and writes
- trip lifecycle logic
- prediction lookup logic
- timeline assembly
- "what changed?" write suppression logic

The result is hard to reason about because the layers are not cleanly separated.
The most visible symptom is that some domain functions still depend on
function-layer query or mutation adapters, and some pipeline boundaries are
still shaped by legacy internal bundles rather than by stable public contracts.

The desired direction is simpler:

- always compute
- emit computed truth
- let the functions layer decide whether a row changed enough to persist

This memo treats that direction as the target architecture, not as an optional
idea.

---

## 4. Related documents

These documents still provide active constraints or useful supporting context.
This PRD supersedes them when there is tension about the refactor target.

### Required context

- Style guide:
  [`/.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc)
- Module boundaries:
  [`imports-and-module-boundaries-memo.md`](imports-and-module-boundaries-memo.md)

### Optional background

- Architecture background:
  [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)
- Trips-specific background:
  [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](vessel-trips-pure-pipeline-refactor-outline-memo.md)

---

## 5. Layer ownership

### 5.1 `convex/functions`

The functions layer owns:

- Convex `runQuery` and `runMutation`
- external fetches
- loading input tables and identity rows
- building large preload blobs
- deduping by table identity and row equality
- persistence ordering
- metrics and logging about orchestration
- sequencing between the four pipelines

The functions layer does **not** own:

- trip lifecycle rules
- prediction rules
- timeline semantics
- vessel-location normalization rules beyond I/O mechanics

### 5.2 `convex/domain`

The domain layer owns:

- business logic
- pure transforms
- pipeline-local helper structure
- handoff shapes between stages
- derivation of POJOs to persist later

The domain layer does **not** own:

- `ActionCtx`
- `_generated/api`
- direct Convex reads or writes
- database-specific mutation adapters
- orchestration sequencing

---

## 6. Public interface rules

These rules are mandatory for all four `runUpdate...` entrypoints.

1. The exported function is a black box:
   - `input -> Promise<output>`
2. Public signatures must not expose dependency bags such as `Deps`,
   `Bindings`, `Access`, or `Ports`.
3. Internal helper composition is allowed, but it stays private to the module.
4. Public output types should be explicit and stage-owned.
5. The public contract may include both:
   - rows to persist for that stage
   - handoff data for the next stage
6. Public outputs must be plain data.
   - POJOs
   - arrays
   - maps encoded as plain objects if practical
   - no function-valued fields
7. Public contracts should not expose legacy transitional shapes unless there is
no reasonable short-term alternative.

### 6.1 Recommended public shape

Each stage should expose a single exported const arrow function and its input
and output types.

```ts
export type RunUpdateVesselTripsInput = { ... };

export type RunUpdateVesselTripsOutput = { ... };

export const runUpdateVesselTrips = async (
  input: RunUpdateVesselTripsInput,
): Promise<RunUpdateVesselTripsOutput> => { ... };
```

### 6.2 Internal implementation freedom

Inside the folder, the implementation may still use:

- private helper functions
- private intermediate types
- temporary adapter shims
- transitional wrappers over messy legacy code

That is acceptable as long as the public interface already matches the target
contract in this memo.

---

## 7. Coding and module-boundary rules for this refactor

These are drawn from the repo style guides and are especially important here.

1. Prefer functional code:
   - `map`
   - `reduce`
   - `filter`
   - POJOs
   - pure transforms where practical
2. Prefer `const` arrow functions, including exported functions.
3. Use meaningful comments:
   - top-level module comments
   - TSDoc on exported and internal functions
   - concise inline comments for non-obvious logic
4. Do not widen folder `index.ts` files into barrel dumps.
5. Outside a folder, import only from that folder's public entry file.
6. Transitional shims are allowed, but they should not create new long-lived
deep-import consumers.

---

## 8. Canonical pipeline contracts

This section is the main specification for parallel work by multiple agents.

### 8.1 `runUpdateVesselLocations`

#### Responsibility

Normalize raw WSF location data into canonical vessel-location rows.

#### Must not do

- write to Convex
- call trip logic
- call prediction logic
- call timeline logic

#### Input

```ts
export type RunUpdateVesselLocationsInput = {
  tickStartedAt: number;
  rawFeedLocations: WsfVesselLocation[];
  vesselsIdentity: VesselIdentity[];
  terminalsIdentity: TerminalIdentity[];
};
```

#### Output

```ts
export type RunUpdateVesselLocationsOutput = {
  vesselLocations: VesselLocationRow[];
};
```

#### Notes

- This stage owns location normalization and enrichment.
- It is acceptable, and preferred, for vessel-abbreviation enrichment to move
into this stage.
- The external fetch adapter should be split conceptually into:
  - raw fetch
  - domain normalization

#### Adapter guidance

The current file
[`fetchWsfVesselLocations.ts`](../../convex/adapters/fetch/fetchWsfVesselLocations.ts)
mixes fetch and transformation. The target shape is:

- adapter fetches raw WSF rows
- `runUpdateVesselLocations` maps raw rows to `VesselLocationRow`

If another caller such as historic ingestion needs the same mapping, that caller
should reuse the same domain function or a small shared mapper owned by the
locations concern.

### 8.2 `runUpdateVesselTrips`

#### Responsibility

Compute the authoritative trip state for the current tick.

#### Must not do

- query prediction data
- attach ML predictions
- write to Convex
- decide whether the tick should run
- emit mutation-specific execution payloads as its public contract

#### Input

```ts
export type RunUpdateVesselTripsInput = {
  tickStartedAt: number;
  vesselLocations: VesselLocationRow[];
  existingActiveTrips: VesselTripRow[];
  scheduleContext: VesselTripScheduleContext;
};
```

#### Output

```ts
export type TripComputation = {
  vesselAbbrev: string;
  branch: "completed" | "current";
  events: TripEvents;
  existingTrip?: VesselTripRow;
  completedTrip?: VesselTripRow;
  activeTrip?: VesselTripRow;
  tripCore: TripCore;
};

export type RunUpdateVesselTripsOutput = {
  activeTrips: VesselTripRow[];
  completedTrips: VesselTripRow[];
  tripComputations: TripComputation[];
};
```

#### Notes

- `scheduleContext` is intentionally plain data, not a query port.
- `runUpdateVesselTrips` runs every tick.
- Event boundaries still matter for the computed trip results, but not for
whether the pipeline executes.
- Legacy shapes like `VesselTripsComputeBundle` may remain internally for a
while, but they should not remain the public output contract.

### 8.3 `runUpdateVesselPredictions`

#### Responsibility

Compute predictions from trip outputs and a preloaded prediction context blob.

#### Must not do

- query Convex from inside domain
- reconstruct trip compute from raw locations
- re-run trip orchestration from scratch
- write to Convex

#### Input

```ts
export type RunUpdateVesselPredictionsInput = {
  tickStartedAt: number;
  tripComputations: TripComputation[];
  predictionContext: VesselPredictionContext;
};
```

#### Output

```ts
export type PredictedTripComputation = TripComputation & {
  predictions: TripPredictionSet;
  finalPredictedTrip?: VesselTripWithPredictions;
};

export type RunUpdateVesselPredictionsOutput = {
  vesselTripPredictions: VesselTripPredictionRow[];
  predictedTripComputations: PredictedTripComputation[];
};
```

#### Notes

- The prediction stage consumes trip outputs. It does not consume raw locations
or existing trip rows directly.
- The functions layer will preload `predictionContext` as a large blob of plain
data. This is the preferred architecture.
- Query-backed objects like `VesselTripPredictionModelAccess` are transitional
and should be removed from the public boundary.

### 8.4 `runUpdateVesselTimeline`

#### Responsibility

Build actual and predicted timeline rows from trip and prediction outputs.

#### Must not do

- query same-tick state from Convex to reconstruct what prior stages already
computed
- write to Convex

#### Input

```ts
export type RunUpdateVesselTimelineInput = {
  tickStartedAt: number;
  tripComputations: TripComputation[];
  predictedTripComputations: PredictedTripComputation[];
};
```

#### Output

```ts
export type RunUpdateVesselTimelineOutput = {
  actualEvents: ActualDockEventRow[];
  predictedEvents: PredictedDockEventRow[];
};
```

---

## 9. Functions-layer orchestration contract

The functions layer should follow this shape for each pipeline:

1. Gather input rows or blobs.
2. Call one domain function.
3. Receive POJO outputs.
4. Dedupe by table identity and row equality.
5. Persist changed rows only.
6. Pass handoff data to the next pipeline.

Illustrative flow:

```ts
const locations = await runUpdateVesselLocations({
  tickStartedAt,
  rawFeedLocations,
  vesselsIdentity,
  terminalsIdentity,
});
await upsertChangedVesselLocations(locations.vesselLocations);

const trips = await runUpdateVesselTrips({
  tickStartedAt,
  vesselLocations: locations.vesselLocations,
  existingActiveTrips,
  scheduleContext,
});
await upsertChangedActiveTrips(trips.activeTrips);
await upsertChangedCompletedTrips(trips.completedTrips);

const predictions = await runUpdateVesselPredictions({
  tickStartedAt,
  tripComputations: trips.tripComputations,
  predictionContext,
});
await upsertChangedTripPredictions(
  predictions.vesselTripPredictions,
);

const timeline = await runUpdateVesselTimeline({
  tickStartedAt,
  tripComputations: trips.tripComputations,
  predictedTripComputations:
    predictions.predictedTripComputations,
});
await upsertChangedActualEvents(timeline.actualEvents);
await upsertChangedPredictedEvents(timeline.predictedEvents);
```

---

## 10. Dedupe and persistence rules

These rules belong to `convex/functions`, not to `convex/domain`.

1. Each table must define:
   - row identity
   - equality for "unchanged"
2. Domain code should not suppress rows just because they are unchanged versus
stored state.
3. Domain code should compute the correct current truth.
4. Functions code should skip writes when the stored row and computed row are
equal under table-specific rules.

This is a major architectural change from the legacy model and is intentional.

---

## 11. Allowed temporary mess during migration

The current code under trips and adjacent folders is known to be messy. During
this refactor, the following compromises are acceptable:

- wrappers around legacy helpers
- internal conversion from legacy bundles to new outputs
- duplicate private helper logic during migration
- temporary verbose DTO assembly

The following are **not** acceptable:

- new public APIs that expose `ActionCtx`
- new public APIs that expose query or mutation adapters
- new cross-pipeline coupling hidden behind legacy bundle names
- new long-lived deep imports across module boundaries

---

## 12. Migration plan

This is the recommended order of work for parallel agents.

### Stage A: contract freeze

1. Add canonical public types for all four pipelines.
2. Ensure the entry files expose only the intended public API.
3. Update docs and references to point at these contracts.

**Definition of done**

- There is one obvious contract file or public entry for each pipeline.
- Other agents can implement to the contract without inferring architecture.

### Stage B: locations

1. Split raw WSF fetch from domain normalization.
2. Implement `runUpdateVesselLocations(input) -> output`.
3. Keep persistence in the functions layer only.

**Definition of done**

- Vessel-abbreviation enrichment and normalization are owned by the locations
concern.
- External fetch and domain mapping are clearly separated.

### Stage C: trips

1. Make `runUpdateVesselTrips` expose the final contract from this memo.
2. Internally adapt legacy bundle-based code if needed.
3. Remove prediction-specific concerns from the public surface.
4. Ensure trips compute every tick.

**Definition of done**

- `runUpdateVesselTrips` emits `activeTrips`, `completedTrips`, and
`tripComputations`.
- Functions code persists rows and passes `tripComputations` forward.

### Stage D: predictions

1. Replace query-backed prediction access with preloaded `predictionContext`.
2. Make predictions consume `tripComputations`.
3. Make predictions emit only prediction rows and predicted handoff data.

**Definition of done**

- The public domain contract for predictions is plain data in, plain data out.
- Domain code no longer queries Convex during prediction computation.

### Stage E: timeline

1. Make timeline consume the emitted trip and prediction handoff data.
2. Remove same-tick recomputation or DB re-read requirements where possible.

**Definition of done**

- Timeline is a pure consumer of prior stage outputs.

### Stage F: cleanup

1. Delete obsolete public transitional shapes.
2. Narrow entry files.
3. Remove old ports, adapters, and bundle names that no longer serve the new
architecture.

---

## 13. Guidance for agent parallelism

To keep multiple agents aligned:

1. Land Stage A first or at minimum agree on it before parallel coding.
2. Assign one pipeline per agent whenever possible.
3. Do not let one agent invent a public contract for a pipeline in isolation.
4. If a stage still needs ugly internal adapters, hide them behind the agreed
public contract.
5. Avoid long-lived branches where the public interface is changed but callers
are not updated. Breaking changes are acceptable only within a coherent,
compilable checkpoint.

---

## 14. Anti-patterns to avoid

1. Public `Deps` objects on `runUpdate...` functions.
2. Domain code that takes query or mutation capabilities instead of plain data.
3. Public outputs that are really execution plans for Convex internals rather
than stage-owned POJOs.
4. Trips recomputing only on event gates because "nothing changed."
5. Predictions recomputing trip state from raw location inputs.
6. Timeline requiring same-tick DB reloads for data already produced in memory.
7. Barrel-dump `index.ts` files that re-export an entire subtree.

---

## 15. Acceptance criteria for the completed refactor

The refactor is complete when all of the following are true:

1. Each of the four pipelines has one public domain function with a black-box
`input -> output` contract.
2. No public domain contract exposes `ActionCtx`, adapters, or dependency bags.
3. The functions layer owns all Convex reads and writes.
4. Trips emits the data predictions needs; predictions consumes that emitted
data.
5. Predictions consumes a preloaded plain-data blob instead of query-backed
ports.
6. Timeline consumes trip and prediction outputs rather than reconstructing
same-tick state from scratch.
7. Dedupe and write suppression live in the functions layer.
8. Public imports follow folder entry boundaries.

---

## 16. Revision history

- **2026-04-19:** Initial PRD for the idempotent four-pipeline refactor. Locks
down public interfaces, layer ownership, migration order, and coding rules for
parallel implementation.
