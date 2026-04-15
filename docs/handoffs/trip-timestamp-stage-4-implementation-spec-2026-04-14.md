# Stage 4 Implementation Spec: ML Readers, Prediction Gates, and Query-Side Adapters

Date: 2026-04-14
Parent PRD: [trip-timestamp-semantics-prd-2026-04-14.md](./trip-timestamp-semantics-prd-2026-04-14.md)
Stage 3 baseline: [trip-timestamp-stage-3-implementation-spec-2026-04-14.md](./trip-timestamp-stage-3-implementation-spec-2026-04-14.md)
Semantic baseline: [trip-timestamp-semantics-memo-2026-04-14.md](./trip-timestamp-semantics-memo-2026-04-14.md)
Status: implementation-ready spec for Stage 4 only

## Purpose

Stage 4 aligns the downstream ML and query-side readers with the canonical
timestamp contract established by Stages 1 through 3.

The goal is to stop stale reader logic from reintroducing the old ambiguity:

- coverage timestamps must stay coverage-only
- physical boundary actuals must be read from canonical boundary fields
- temporary adapters may exist only to keep backend/query consumers stable while
  the reader layer is being rewritten

Stage 4 is still a backend and query-reader stage. It does not include the
frontend cleanup and component migration work reserved for Stage 5.

## Scope

In scope for Stage 4:

- ML feature extraction and prediction readiness logic
- trip-to-ML normalization and prediction readers
- query-side hydration helpers that still map backend trip data onto existing
  UI-facing shapes
- any backend adapter helper needed to isolate a temporary legacy-facing shape
  from the canonical reader logic
- tests that prove each feature or reader is classed as coverage-semantics or
  physical-boundary-semantics on purpose

Out of scope for Stage 4:

- frontend component redesign or render cleanup
- removing legacy UI shapes from the active frontend code path
- timeline actual projection and reseed logic already handled in Stage 3
- any broad rename migration of `TripStart` / `TripEnd` storage itself

## Stage 4 Contract

### Semantic split

Every reader in Stage 4 must explicitly fall into one of two buckets:

1. `coverage-semantics`
2. `physical-boundary-semantics`

Coverage-semantics readers may use scheduled or recording-window timestamps.
Physical-boundary-semantics readers must use canonical trip actuals and must
not infer trusted boundary facts from `StartTime`, `EndTime`, `TripStart`, or
`TripEnd`.

Hard rule:

- `StartTime` and `EndTime` remain coverage-only
- `TripStart` and `TripEnd` remain legacy compatibility names, not canonical
  semantic sources
- `AtDockActual`, `ArriveDest`, and raw `LeftDock` may survive only as legacy
  compatibility data or temporary adapter input, never as the reader's
  long-term truth source

### Reader classification

The Stage 4 code surface should be classified as follows.

Coverage-semantics readers:

- time-of-day and scheduled-departure feature families
- schedule-based prediction anchors
- temporary hydration adapters that preserve the existing UI shape while the
  backend reader changes are in flight

Physical-boundary-semantics readers:

- actual departure and arrival feature families
- prediction actualization on leave-dock and completion
- prediction readiness gates that decide whether a trip has the required
  physical boundary state
- any training-window or inference adapter that needs actual trip boundaries for
  arrival/departure math

Mixed readers must be split internally into named subparts so the code makes the
semantic intent obvious. A reader that combines schedule and boundary logic may
exist, but each field it consumes must still be classified explicitly in comments
and tests.

### Temporary adapter rule

If a query-side consumer still needs the current frontend shape, that adapter
must be isolated and documented as temporary.

Rules:

- the adapter may map canonical backend fields onto the legacy UI shape
- the adapter must not become the long-term source of truth for ML or backend
  prediction logic
- the adapter must not smuggle `TripStart` / `TripEnd` / `ArriveDest` semantics
  back into the ML core
- Stage 5 will remove or replace the temporary adapter as part of frontend
  cleanup

## File Ownership

### Primary implementation files

- [convex/domain/ml/shared/unifiedTrip.ts](../../convex/domain/ml/shared/unifiedTrip.ts)
- [convex/domain/ml/shared/features.ts](../../convex/domain/ml/shared/features.ts)
- [convex/domain/ml/prediction/predictTrip.ts](../../convex/domain/ml/prediction/predictTrip.ts)
- [convex/domain/ml/prediction/vesselTripPredictions.ts](../../convex/domain/ml/prediction/vesselTripPredictions.ts)
- [convex/functions/vesselTrips/hydrateTripPredictions.ts](../../convex/functions/vesselTrips/hydrateTripPredictions.ts)

### Secondary review surface

- [convex/domain/ml/readme-ml.md](../../convex/domain/ml/readme-ml.md)
- [convex/domain/ml/README.md](../../convex/domain/ml/README.md)
- query helpers or adapters that still expose a legacy trip shape to frontend
  callers

The secondary files should only change if Stage 4 needs a comment or doc update
to keep the semantic split honest. They should not pull Stage 5 frontend cleanup
into this stage.

## Required Changes By File

### `unifiedTrip.ts`

This file defines the shared ML trip shape. It should become the place where the
canonical semantic split is obvious in type form and in documentation.

Required actions:

- make canonical fields visible as the preferred ML-facing names
- keep legacy fields available only as compatibility inputs where necessary
- document which timestamps are coverage-only and which are physical boundaries
- ensure any type-level requirement that uses a timestamp makes its semantic
  expectation explicit

Recommended semantic split:

- `ScheduledDeparture`, `PrevScheduledDeparture`, and route/time-of-day inputs
  are coverage or schedule semantics
- `ArriveOriginDockActual`, `DepartOriginActual`, and `ArriveDestDockActual`
  are physical-boundary semantics
- `StartTime` and `EndTime` remain coverage-only
- `TripStart` and `TripEnd` are legacy compatibility aliases that Stage 4 may
  still carry, but not reinterpret as primary truth

### `features.ts`

This file owns the feature math. Each feature family must be called out as
coverage-semantics or physical-boundary-semantics.

Required semantic decisions:

- time-of-day feature extraction is coverage/schedule semantics
- route priors and scheduled slack features are coverage/schedule semantics
- actual departure delay, dock duration, sea duration, and total duration are
  physical-boundary semantics
- arrival-vs-estimated-schedule features are physical-boundary semantics
- previous-leg context features should explicitly say whether they use previous
  leg coverage or physical actuals

Implementation guidance:

- do not let `TripStart` or `TripEnd` remain the hidden semantic source for
  actual-boundary metrics
- if a feature is intended to mean a physical arrival or departure fact, it
  must read the canonical boundary actuals, not coverage timestamps
- if a feature is intended to be coverage-based, name it that way in comments so
  reviewers do not have to infer intent

### `predictTrip.ts`

This file converts persisted trip data into training and inference inputs.
It should be rewritten so prediction inputs distinguish schedule context from
physical boundary context.

Required actions:

- make the trip-to-training-window conversion explicit about which inputs are
  coverage-semantics and which are physical-boundary-semantics
- update inference anchors to use canonical boundary fields when a prediction
  depends on a real departure or arrival fact
- stop using `TripStart`, `TripEnd`, `ArriveDest`, or raw `LeftDock` as the
  default semantic source when canonical boundary fields exist

Reader classification:

- `predictArriveEta` is physical-boundary semantics because it depends on actual
  departure timing
- `predictDelayOnArrival` is mixed but should be broken into a schedule-anchored
  prediction with a physical readiness check
- `predictEtaOnDeparture` is schedule/coverage anchored, but the readiness and
  later actualization hooks still need explicit semantic comments

### `vesselTripPredictions.ts`

This file owns prediction gating and prediction actualization. It is the most
important Stage 4 reader for keeping the new contract honest.

Required semantic decisions:

- `isPredictionReadyTrip` must no longer treat `TripStart` or `AtDockActual` as
  a semantically ambiguous catch-all
- readiness for at-dock predictions must be tied to the canonical origin-arrival
  actual
- readiness for at-sea arrival predictions must be tied to the canonical
  departure actual
- prediction actualization on leave-dock must use `DepartOriginActual`
- prediction actualization on trip completion must use `ArriveDestDockActual`

Prediction spec classification:

- `AtDockDepartCurr` is schedule-anchored, but its readiness depends on the
  physical origin-arrival boundary
- `AtDockArriveNext` is schedule-anchored and does not need a physical boundary
  anchor for inference
- `AtDockDepartNext` is schedule-anchored and uses the next scheduled departure
- `AtSeaArriveNext` is physical-boundary anchored because it depends on actual
  departure timing
- `AtSeaDepartNext` is schedule-anchored, but any actualization hook must be
  semantically explicit about what it is reading

### `hydrateTripPredictions.ts`

This file is a query-side join layer. It may continue to return the existing
frontend-facing trip shape for now, but it must not become a semantic backdoor.

Required actions:

- isolate any temporary mapping from canonical backend fields to legacy UI
  fields
- keep the hydration step clearly separate from ML reader logic
- avoid introducing a second hidden compatibility layer that redefines the
  trip semantics

Preferred rule:

- if the query layer must expose legacy names temporarily, do it in one explicit
  adapter helper and document that the adapter is temporary

## Implementation Order

1. Classify each Stage 4 feature family as coverage-semantics or
   physical-boundary-semantics in code comments and supporting tests.
2. Update `unifiedTrip.ts` so the ML-facing trip shape makes the canonical
   split obvious.
3. Rework `features.ts` so each duration, slack, and arrival-deviation metric
   reads the correct semantic layer.
4. Rework `predictTrip.ts` and `vesselTripPredictions.ts` so readiness, anchors,
   and actualization rely on canonical fields where physical truth is required.
5. Add or isolate any temporary query-side adapter needed by
   `hydrateTripPredictions.ts`.
6. Update docs/comments only where needed to keep the reader semantics obvious.
7. Run focused tests and type checks before marking Stage 4 complete.

## Acceptance Criteria

Stage 4 is complete when all of the following are true:

- every major ML feature or prediction reader is explicitly classified as
  coverage-semantics or physical-boundary-semantics
- physical-boundary readers use canonical boundary actuals rather than
  `TripStart`, `TripEnd`, `AtDockActual`, or raw `LeftDock`
- coverage readers remain coverage readers and are documented as such
- query-side adapters, if still needed, are isolated and temporary
- no Stage 5 frontend cleanup work is folded into Stage 4
- reviewer can explain each ML feature family without guessing which timestamp
  layer it belongs to

## Review Checklist

Reject the Stage 4 implementation if any of these are true:

- a physical-boundary reader still silently treats `TripStart` or `TripEnd` as
  truth
- a coverage feature is rewritten to depend on canonical physical actuals
  without a documented reason
- a temporary adapter becomes the new semantic source of truth
- the implementation expands into frontend cleanup or render work
- `EndTime` is treated as guaranteed destination arrival in any reader path

## Suggested Tests and Verification

Suggested checks:

- focused unit tests for `features.ts` proving the physical-boundary features
  use canonical actuals and the coverage features stay coverage-based
- focused tests for `vesselTripPredictions.ts` proving readiness and
  actualization use canonical fields
- focused tests for `predictTrip.ts` proving trip-to-training-window conversion
  does not smuggle coverage timestamps into physical-boundary math
- focused tests for `hydrateTripPredictions.ts` proving the adapter preserves
  query shape without changing semantic ownership
- grep verification that Stage 4 files no longer rely on `TripStart` /
  `TripEnd` as the primary source for physical actuals
- `bun test convex/domain/ml/shared/features.test.ts` or the equivalent
  feature-specific test file if present
- `bun test convex/domain/ml/prediction/vesselTripPredictions.test.ts` or the
  equivalent prediction-reader test file if present
- `bun run type-check`

## Notes for Stage 5

Stage 5 should remove or replace any temporary adapter and clean up frontend
rendering helpers after the backend/query semantics are stable.

Stage 4 should not preemptively rewrite the frontend component layer just
because some legacy names still appear in query payloads.
