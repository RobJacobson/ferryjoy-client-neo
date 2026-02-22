# Vessel Orchestrator Refactoring Analysis

## Executive Summary

This document analyzes the vesselOrchestrator code, specifically the `updateVesselTrips` function and its associated pipeline. The orchestrator runs every 5 seconds to process vessel location updates and determine whether database writes are needed.

**Key Findings**:

1. **Build-then-compare**: The current "check-before-write" pattern with extensive conditional logic should be replaced. Always construct the full intended `VesselTrip` state, then deep-compare at the end. Write only if different. CPU cycles are cheap; simpler code is valuable.

2. **Prediction simplification**: The current "up to once per minute" throttling is overengineered. Predictions should be event-based: run "arrive dock" model once when first arriving at dock with a destination; run "depart dock" model once when physically departing. Simple linear regression, low failure surface—no need to keep rechecking.

3. **Logical equivalence**: The current system is convoluted but accurate after many debugging sessions. Any refactor must preserve behavior. Document invariants, add tests, and refactor incrementally. Do not introduce shortcuts (e.g. `?? existingTrip`) that violate domain rules.

---

## 1. The Question

Can the vesselOrchestrator code be simplified or refactored? Specifically:

- The current implementation has complex business logic spread across many functions, each checking conditions to determine "should we update?"
- Would it be better to always construct a new `VesselTrip` object and compare it against the existing one at the end?
- CPU cycles are cheap—constructing a new object each tick may be acceptable trade-off for simpler, more maintainable code

---

## 2. What Problems Does This Code Solve?

The vesselOrchestrator handles several complex business problems:

### 2.1 Trip Lifecycle Management

The orchestrator manages three event types:

1. **First Trip**: Create a new trip when a vessel appears with no existing active trip (rare, usually only on the first run of the function).
2. **Trip Boundary**: Complete current trip and start a new one when `DepartingTerminalAbbrev` changes. **Always triggers writes**: (1) archive completed trip with `TripEnd` set to `currLocation.TimeStamp`, (2) create new active trip. Build-then-compare does not apply here—boundary always writes.
3. **Regular Updates**: Update existing trip with new location data (most common case). Build-then-compare applies: construct full state, compare, write only if different.

### 2.2 VesselTrip vs VesselLocation

**Critical distinction**: VesselTrip is not a replica of VesselLocation. VesselLocation is a point-in-time snapshot. VesselTrip maintains **history across many updates**.

- **VesselLocation** provides: position, terminals, AtDock, Eta, TimeStamp, etc. per tick.
- **VesselTrip** adds: TripStart (when vessel arrived at dock—inferred from at-sea→at-dock), PrevTerminalAbbrev, PrevScheduledDeparture, PrevLeftDock (carried from completed trip at boundary), derived durations, and predictions.

When building a new trip at a trip boundary, we do **not** carry identity fields from the old trip (hard reset). We **do** carry contextual fields (Prev*) from the completed trip. We **do** compute inferred fields (TripStart) from state transitions.

### 2.3 Data Enrichment

The pipeline enriches vessel trips with multiple data sources:

- **Trip Identity Derivation**: Computes composite `Key` from terminal pair and scheduled departure time
- **Scheduled Trip Lookup**: Fetches and caches `ScheduledTrip` snapshot for debugging/explainability
- **Terminal Inference**: Infers `ArrivingTerminalAbbrev` from schedule when API doesn't provide it
- **Derived Field Calculation**: Computes `TripDelay`, `AtDockDuration`, `AtSeaDuration`, `TotalDuration`

### 2.4 ML Predictions

Generates and manages 5 types of predictions:

- `AtDockDepartCurr`: Predicts actual departure time while at dock
- `AtDockArriveNext`: Predicts arrival at next terminal while at dock
- `AtDockDepartNext`: Predicts next departure time while at dock
- `AtSeaArriveNext`: Predicts arrival at next terminal while at sea
- `AtSeaDepartNext`: Predicts next departure time while at sea

**Simplified trigger model** (replace current time-based throttling):

- **Arrive-dock predictions** (AtDockArriveNext, AtDockDepartNext): Run **once** when vessel first arrives at dock and its destination becomes known, i.e., when we compute the key.
- **Depart-dock predictions** (AtDockDepartCurr, AtSeaArriveNext, AtSeaDepartNext): Run **once** when vessel physically departs the dock.

The model is simple linear regression with parameters from our own DB. Low failure surface; has run reliably for months. Occasional failure is acceptable. No need to recheck "just in case" every minute.

### 2.5 Database Write Optimization

The orchestrator minimizes unnecessary database writes by:

- Checking each field individually before updating
- Batching multiple vessel updates into single mutation calls
- Only writing when data has actually changed

---

## 2.6 VesselTrip Field Reference

**Invariant**: When `DepartingTerminalAbbrev` changes (trip boundary), that is a **hard reset**. Do not carry identity fields from the old trip to the new trip. Contextual fields (Prev*) are explicitly carried from the completed trip.

| Field | Source | Update Rule | Notes |
|-------|--------|-------------|-------|
| **VesselAbbrev** | currLocation | Direct copy every tick | Never from existingTrip |
| **DepartingTerminalAbbrev** | currLocation | Direct copy every tick | Trip boundary trigger; never from existingTrip |
| **ArrivingTerminalAbbrev** | currLocation, currTrip, or schedule lookup | `currLocation.ArrivingTerminalAbbrev` (direct, no conditional) | With hard-reset rule: no carry from old trip. If REST missing, use currTrip if present, or `lookupArrivalTerminalFromSchedule` as fallback when at dock |
| **RouteID** | ScheduledTrip lookup | From `enrichTripStartUpdates` | 0 until scheduled trip found; cleared when Key invalid |
| **RouteAbbrev** | ScheduledTrip lookup | From `enrichTripStartUpdates` | "" until scheduled trip found |
| **Key** | Derived from terminals + ScheduledDeparture | From `enrichTripStartUpdates` | `generateTripKey(...)`; cleared when tripKey null (repositioning) |
| **SailingDay** | ScheduledTrip lookup | From `enrichTripStartUpdates` | "" until scheduled trip found |
| **ScheduledTrip** | ScheduledTrip lookup | From `enrichTripStartUpdates` | Snapshot for debugging; cleared when Key invalid |
| **PrevTerminalAbbrev** | completedTrip (at boundary only) | Set once at trip boundary | `completedTrip.DepartingTerminalAbbrev`; not updated mid-trip |
| **TripStart** | Inferred at boundary; carried forward | Set at trip boundary = `currLocation.TimeStamp` | When vessel arrives at dock (at-sea→at-dock); carried across updates |
| **AtDock** | currLocation | Direct copy every tick | Drives prediction strategy |
| **AtDockDuration** | Computed | `LeftDock - TripStart` (minutes) | Only when LeftDock is set |
| **ScheduledDeparture** | currLocation | Only if currLocation has truthy value | Prevents null overwrite; REST can update mid-trip |
| **LeftDock** | currLocation, or inferred | If AtDock flips false and missing: `currLocation.LeftDock ?? currLocation.TimeStamp`. Else: currLocation.LeftDock if truthy | Set once when vessel departs; prevents null overwrite |
| **TripDelay** | Computed | `LeftDock - ScheduledDeparture` (minutes) | Only when both available |
| **Eta** | currLocation | Only if currLocation has truthy value | Prevents null overwrite |
| **TripEnd** | currLocation (at boundary only) | Set on completed trip = `currLocation.TimeStamp` | Only on trip boundary when completing |
| **AtSeaDuration** | Computed | `TripEnd - LeftDock` (minutes) | Only on completed trip |
| **TotalDuration** | Computed | `TripEnd - TripStart` (minutes) | Only on completed trip |
| **InService** | currLocation | Direct copy every tick | |
| **TimeStamp** | currLocation | `currLocation.TimeStamp` every tick | Always reflects last update time |
| **PrevScheduledDeparture** | completedTrip (at boundary only) | Set once at trip boundary | Not updated mid-trip |
| **PrevLeftDock** | completedTrip (at boundary only) | Set once at trip boundary | Not updated mid-trip |
| **AtDockDepartCurr** | ML model | Run once when physically depart dock | Actualized by `updatePredictionsWithActuals` when LeftDock set |
| **AtDockArriveNext** | ML model | Run once when first arrive at dock with destination | |
| **AtDockDepartNext** | ML model | Run once when first arrive at dock | Actualized by `setDepartNextActualsForMostRecentCompletedTrip` (next trip's LeftDock) |
| **AtSeaArriveNext** | ML model | Run once when physically depart dock | Actualized by `updatePredictionsWithActuals` when TripEnd set |
| **AtSeaDepartNext** | ML model | Run once when physically depart dock | Actualized by `setDepartNextActualsForMostRecentCompletedTrip` (next trip's LeftDock) |

**Source abbreviations**:
- currLocation: REST/API vessel location feed
- existingTrip: Current active trip in DB (same trip, prior tick)
- completedTrip: Trip being archived at boundary (provides Prev* for new trip)
- schedule lookup: `lookupArrivalTerminalFromSchedule`, `fetchScheduledTripFieldsByKey`
- computed: Derived from other fields (e.g. time deltas)
- ML model: `predictTripValue` via `computeVesselTripPredictionsPatch`

---

## 2.7 Refactoring Gotchas & Invariants

**Logical equivalence requirement**: The current system is accurate after many debugging sessions. Any refactor must preserve behavior. Document invariants before changing code; add tests that capture current behavior; refactor incrementally.

**Known gotchas** (from domain knowledge—do not "simplify" away):

1. **ArrivingTerminalAbbrev**: Never use `currLocation.ArrivingTerminalAbbrev ?? existingTrip.ArrivingTerminalAbbrev` **at trip boundary**—old trip's ArrivingTerminalAbbrev equals new trip's DepartingTerminalAbbrev (wrong terminal). For **regular updates** (same trip), use this fallback chain in `buildCompleteTrip`:
   - `currLocation.ArrivingTerminalAbbrev` when truthy
   - Else `arrivalLookup?.arrivalTerminal` when available (schedule inference)
   - Else `existingTrip.ArrivingTerminalAbbrev` (only when same trip—REST may not have reported it yet)

2. **ScheduledDeparture, Eta, LeftDock**: Only update when currLocation provides truthy value. Prevents overwriting good data with null from REST glitches.

3. **LeftDock special case**: When AtDock flips false and LeftDock is missing, use `currLocation.LeftDock ?? currLocation.TimeStamp` (infer from tick).

4. **Event detection (side effects)**: `didJustLeaveDock` drives backfill of depart-next actuals onto previous trip, actualization of AtDockDepartCurr, and completedPredictionRecords. These must remain conditional—build-then-compare does not eliminate event-driven side effects.

5. **I/O-conditioned lookups**: `lookupArrivalTerminalFromSchedule` and `fetchScheduledTripFieldsByKey` are conditional to avoid unnecessary DB calls. Keep those conditions; change only how results are applied (full object vs patch).

---

## 3. Current Implementation

### 3.1 Architecture Overview

The orchestrator follows a pipeline architecture:

```
runUpdateVesselTrips (entry point)
    └─> processVesselLocationTick (per vessel)
        └─> processVesselTripTick (event dispatcher)
            ├─> buildTripBoundaryPlan (terminal change)
            └─> buildTripUpdatePlan (regular update)
                ├─> enrichTripFields (location data)
                ├─> lookupArrivalTerminalFromSchedule (terminal inference)
                ├─> enrichTripStartUpdates (scheduled trip lookup)
                └─> computeVesselTripPredictionsPatch (ML predictions)
```

### 3.2 Current Pattern: "Check-Before-Write"

The current implementation uses conditional checks throughout the pipeline to determine what needs to be updated. Here are key examples:

#### Example 1: Location Field Enrichment

`locationEnrichment.ts` checks each field individually:

```typescript
// Current: conditional to prevent null overwrite
if (
  Boolean(currLocation.ArrivingTerminalAbbrev) &&
  currLocation.ArrivingTerminalAbbrev !== existingTrip.ArrivingTerminalAbbrev
) {
  updates.ArrivingTerminalAbbrev = currLocation.ArrivingTerminalAbbrev;
}

// AtDock can flip frequently and drives prediction strategy
const atDockFlipped = currLocation.AtDock !== existingTrip.AtDock;
if (atDockFlipped) {
  updates.AtDock = currLocation.AtDock;
}
```

*With build-then-compare: ArrivingTerminalAbbrev uses the fallback chain (Section 2.7)—direct at boundary, fallback chain for regular updates.*

#### Example 2: Scheduled Trip Enrichment

`scheduledTripEnrichment.ts` checks if data is already in "cleared" state to avoid writes:

```typescript
const alreadyCleared =
  updatedTrip.Key === undefined &&
  updatedTrip.ScheduledTrip === undefined &&
  updatedTrip.RouteID === 0 &&
  updatedTrip.RouteAbbrev === "" &&
  updatedTrip.SailingDay === "" &&
  updatedTrip.AtDockDepartCurr === undefined &&
  updatedTrip.AtDockArriveNext === undefined &&
  updatedTrip.AtDockDepartNext === undefined &&
  updatedTrip.AtSeaArriveNext === undefined &&
  updatedTrip.AtSeaDepartNext === undefined;

if (alreadyCleared) {
  return {};
}
```

*With build-then-compare*: The `alreadyCleared` optimization is preserved semantically. We build the full object (including cleared state when `tripKey` is null), compare via `tripsAreEqual`, and skip the write when equal. The enrichment layer can be simplified to always return a complete object instead of `{}`; the equality check handles the "no change" case.

#### Example 3: Trip Update Plan

`processVesselTripTick.ts` accumulates partial updates and checks if anything changed:

```typescript
const updatedData: Partial<ConvexVesselTrip> = {
  ...tripFieldUpdates,
  ...arrivingTerminalPatch,
  ...tripStartUpdates,
  ...predictionUpdates,
  ...actualUpdates,
};

const hasAnyUpdates = Object.keys(updatedData).length > 0;

const activeUpsert = hasAnyUpdates
  ? ({
      ...existingTrip,
      ...updatedData,
      TimeStamp: currLocation.TimeStamp,
    } satisfies ConvexVesselTrip)
  : undefined;
```

#### Example 4: Prediction Throttling

`vesselTripPredictions.ts` has complex conditional logic to determine when to run predictions:

```typescript
const shouldAttemptPrediction = (
  spec: PredictionSpec,
  trip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined
): boolean => {
  // Don't attempt if we already have a valid prediction
  if (trip[spec.field] !== undefined) {
    return false;
  }

  const seconds = new Date().getSeconds();
  const isThrottleWindow = seconds < 5; // Once per minute

  if (spec.requiresLeftDock) {
    // AtSea predictions: run on first LeftDock OR every minute
    const justLeftDock =
      existingTrip !== undefined &&
      existingTrip.LeftDock === undefined &&
      trip.LeftDock !== undefined;
    return justLeftDock || isThrottleWindow;
  } else {
    // If we just arrived at dock, compute at-dock predictions immediately
    const justArrivedDock =
      existingTrip !== undefined && !existingTrip.AtDock && trip.AtDock;
    if (justArrivedDock) {
      return true;
    }

    // AtDock predictions: run on first update with departure terminal OR every minute
    const hasRequiredFields = isPredictionReadyTrip(trip);
    const hadRequiredFields = existingTrip && isPredictionReadyTrip(existingTrip);
    const firstTimeWithFields = hasRequiredFields && !hadRequiredFields;
    return firstTimeWithFields || isThrottleWindow;
  }
};
```

*Note: This throttling logic is recommended for replacement with event-based triggers (Section 5.4).*

### 3.3 Complexity Analysis

**Current Complexity Sources:**

1. **Scattered Conditionals**: Logic distributed across 5+ files
2. **State Tracking**: Need to track both `existingTrip` and intermediate states
3. **Patch Accumulation**: Multiple partial patches merged at the end
4. **Edge Case Handling**: Null checks, undefined checks, throttle windows
5. **Event Detection**: Detecting `didJustLeaveDock`, `justArrivedDock`, etc.

**Lines of Code (approximate):**
- `updateVesselTrips.ts`: 225 lines
- `processVesselTripTick.ts`: 367 lines
- `locationEnrichment.ts`: 112 lines
- `scheduledTripEnrichment.ts`: 215 lines
- `arrivalTerminalLookup.ts`: 78 lines
- `vesselTripPredictions.ts`: 375 lines

**Total**: ~1,372 lines across 6 files

---

## 4. Proposed Alternative: "Build-Then-Compare"

### 4.1 Core Concept

Instead of checking "should we update?" throughout the pipeline, always build the full intended state and compare against existing at the end.

**Current Pattern:**
```
existingTrip → check conditions → partialPatch → merge → check again → maybe write
```

**Proposed Pattern:**
```
existingTrip → buildNewTrip → deepCompare(existing, new) → write if different
```

### 4.2 Benefits

1. **Simpler Logic**: Eliminates scattered `if` checks throughout the codebase
2. **More Readable**: Intent becomes clearer—"always build the full state, only write if different"
3. **Easier to Maintain**: Less cognitive load when adding new fields or business rules
4. **More Deterministic**: Less risk of missing edge cases in conditional logic
5. **Easier to Test**: Can test "build" logic independently from "compare" logic

### 4.3 Trade-offs

1. **CPU Overhead**: Constructing full objects on every 5-second tick
2. **Memory Allocation**: More frequent object creation (V8 handles this efficiently)
3. **Deep Equality**: Need robust comparison function (trivial to implement)

### 4.4 Deep Equality Implementation

Implementing deep equality is straightforward. Here's a simple implementation:

```typescript
/**
 * Deep equality check for VesselTrip objects.
 * Handles nested objects, undefined/null differences, and type checking.
 *
 * Note: undefined vs undefined returns true via the initial `a === b` check.
 * undefined vs null returns false (null/undefined mismatch). Key and other
 * optional fields can be undefined; both sides undefined must compare equal.
 *
 * @param a - First object to compare
 * @param b - Second object to compare
 * @returns true if objects are deeply equal, false otherwise
 */
const deepEqual = (a: unknown, b: unknown): boolean => {
  // Handle primitives (includes undefined === undefined, null === null)
  if (a === b) return true;

  // Handle null/undefined mismatch (one null, one undefined)
  if (a == null || b == null) return false;

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  // Handle objects
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    // Different number of keys
    if (keysA.length !== keysB.length) return false;

    // Check all keys
    return keysA.every((key) =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }

  return false;
};
```

For performance optimization with VesselTrip objects specifically:

```typescript
/**
 * Optimized deep equality for ConvexVesselTrip objects.
 * Skips comparing read-only fields like _id and _creationTime.
 *
 * @param existing - Existing trip from database
 * @param proposed - Newly constructed trip
 * @returns true if significant fields are deeply equal
 */
const tripsAreEqual = (
  existing: ConvexVesselTrip,
  proposed: ConvexVesselTrip
): boolean => {
  // Skip _id, _creationTime (read-only). Exclude TimeStamp—it changes every tick
  // and would always differ; we care about semantic equality, not last-update time.
  const fieldsToCompare: Array<keyof ConvexVesselTrip> = [
    "VesselAbbrev",
    "DepartingTerminalAbbrev",
    "ArrivingTerminalAbbrev",
    "RouteID",
    "RouteAbbrev",
    "Key",
    "SailingDay",
    "PrevTerminalAbbrev",
    "TripStart",
    "AtDock",
    "AtDockDuration",
    "ScheduledDeparture",
    "LeftDock",
    "TripDelay",
    "Eta",
    "TripEnd",
    "AtSeaDuration",
    "TotalDuration",
    "InService",
    "PrevScheduledDeparture",
    "PrevLeftDock",
    "AtDockDepartCurr",
    "AtDockArriveNext",
    "AtDockDepartNext",
    "AtSeaArriveNext",
    "AtSeaDepartNext",
  ];

  for (const field of fieldsToCompare) {
    if (!deepEqual(existing[field], proposed[field])) {
      return false;
    }
  }

  // Deep compare ScheduledTrip if present
  const scheduledEqual =
    (existing.ScheduledTrip == null && proposed.ScheduledTrip == null) ||
    deepEqual(existing.ScheduledTrip, proposed.ScheduledTrip);

  return scheduledEqual;
};
```

### 4.5 Performance Considerations

**Object Size:**
- `ConvexVesselTrip` is approximately 1-2KB
- With `ScheduledTrip` snapshot: ~2-3KB
- Nested `ConvexPrediction` objects add ~200-300 bytes each

**Frequency:**
- Runs every 5 seconds
- ~10-20 active vessels (estimated)
- ~12-24 object constructions per minute

**CPU Cost:**
- Object construction: ~1-2ms per object (V8 optimized)
- Deep equality: ~1-3ms per comparison
- Total per tick: ~20-80ms for all vessels

**Comparison:**
- Current approach: Many small conditional checks (likely 0.5-2ms total)
- Proposed approach: Build + compare (1-5ms per vessel)

**Verdict**: Performance impact is negligible compared to:
- ML prediction inference (likely 10-100ms)
- Convex database mutation (network latency dominates)
- Developer time saved from simpler code

---

## 5. Recommended Refactoring

### 5.1 Phase 1: Simplify `buildTripUpdatePlan` (Highest Impact)

The `buildTripUpdatePlan` function runs most frequently and has the most complex conditional logic. Refactor it to always build the full state.

**Current Flow:**
```typescript
1. enrichTripFields() → partial patch
2. lookupArrivalTerminalFromSchedule() → partial patch
3. enrichTripStartUpdates() → partial patch (with more conditionals)
4. computeVesselTripPredictionsPatch() → partial patch (throttled)
5. updatePredictionsWithActuals() → partial patch (conditional)
6. Merge all patches
7. Check if anything changed
8. Optionally build upsert object
```

**Proposed Flow:**
```typescript
1. Build complete newTrip from existingTrip + currLocation
2. Enrich with arrival terminal (lookup when at dock and missing)
3. Enrich with scheduled trip (always try, cache result)
4. Enrich with predictions (event-based: first arrive-at-dock, first depart-dock)
5. Enrich with actuals (when didJustLeaveDock or trip completes)
6. Compare newTrip vs existingTrip (tripsAreEqual; exclude TimeStamp)
7. Return upsert if different
```

### 5.2 Phase 2: Simplify Enrichment Functions

Refactor enrichment functions to return complete objects rather than partial patches. **Follow the Field Reference table (2.6) exactly**—do not use `?? existingTrip` for identity fields.

**`enrichTripFields` (Current):**
```typescript
// Returns: Partial<ConvexVesselTrip>
const updates: Partial<ConvexVesselTrip> = {};
if (condition) updates.ArrivingTerminalAbbrev = value;
if (condition) updates.AtDock = value;
return updates;
```

**`enrichTripFields` (Proposed):**
```typescript
// Returns: ConvexVesselTrip (with all fields populated)
// Identity fields: direct from currLocation; ArrivingTerminalAbbrev uses fallback chain (Section 2.7)
// Computed fields: derive from effective values
return {
  ...trip,
  ArrivingTerminalAbbrev: currLocation.ArrivingTerminalAbbrev ?? arrivalLookup?.arrivalTerminal ?? trip.ArrivingTerminalAbbrev,
  AtDock: currLocation.AtDock,
  Eta: currLocation.Eta ?? trip.Eta,  // only fields where null-overwrite is impossible
  ScheduledDeparture: currLocation.ScheduledDeparture ?? trip.ScheduledDeparture,
  LeftDock: /* per table: infer when AtDock flips false, else currLocation if truthy */,
  TripDelay: computeTripDelay(...),
  AtDockDuration: computeAtDockDuration(...),
  // ... all fields per Field Reference
};
```

### 5.3 Phase 3: Consolidate Write Logic

The current `VesselTripTickPlan` structure is good—keep it for batching. But simplify the construction:

```typescript
type VesselTripTickPlan = {
  activeUpsert?: ConvexVesselTrip;
  completion?: TripCompletionPlan;
  departNextBackfill?: DepartNextBackfillPlan;
  completedPredictionRecords: ConvexPredictionRecord[];
};
```

Instead of conditionally setting `activeUpsert`, always construct it and set to `undefined` if equal:

```typescript
const proposedTrip = buildCompleteTrip(existingTrip, currLocation);
const activeUpsert = tripsAreEqual(existingTrip, proposedTrip)
  ? undefined
  : proposedTrip;
```

### 5.4 Phase 4: Simplify Prediction Triggers (Event-Based, Not Time-Based)

**Replace** the current "up to once per minute" throttling with event-based triggers:

- **Arrive-dock** (AtDockArriveNext, AtDockDepartNext): Run once when `!existingTrip.AtDock && trip.AtDock` (first arrival at dock with destination).
- **Depart-dock** (AtDockDepartCurr, AtSeaArriveNext, AtSeaDepartNext): Run once when `!existingTrip.LeftDock && trip.LeftDock` (first physical departure).

Remove: `isThrottleWindow` (seconds < 5), `firstTimeWithFields`, and any "run again every minute" logic. If prediction fails once, do not retry until next trip/event.

**First-trip case**: When `!existingTrip` (first trip for a vessel), `isPredictionReadyTrip` requires `PrevTerminalAbbrev`, `PrevScheduledDeparture`, `PrevLeftDock`—which come from a completed trip. First trips have none of these, so at-dock predictions will not run. This is intentional; behavior is unchanged.

**Return pattern** (for build-then-compare): When not running prediction, pass through existing value. When running, use new result.

```typescript
// Event-based: run only on first arrive-at-dock or first depart-dock
const shouldRunArriveDockPredictions = existingTrip && !existingTrip.AtDock && trip.AtDock;
const shouldRunDepartDockPredictions = existingTrip && !existingTrip.LeftDock && trip.LeftDock;

// Return full object with predictions (new or existing)
const tripWithPredictions: ConvexVesselTrip = {
  ...trip,
  AtDockDepartCurr: newPrediction ?? trip.AtDockDepartCurr,
  AtDockArriveNext: newPrediction ?? trip.AtDockArriveNext,
  // ... all prediction fields; use existing when not computing
};
```

---

## 6. Implementation Strategy

### 6.1 Incremental Approach

1. **Step 1**: Implement `tripsAreEqual()` function (exclude TimeStamp)
2. **Step 2**: Create `buildCompleteTrip()` that always constructs full state
3. **Step 3**: Replace `buildTripUpdatePlan` to use build-then-compare
4. **Step 4**: Simplify prediction triggers to event-based (remove time-based throttling)
5. **Step 5**: Test thoroughly for logical equivalence with current behavior
6. **Step 6**: Refactor `enrichTripFields` to return complete objects (per Field Reference)
7. **Step 7**: Refactor `enrichTripStartUpdates` to return complete objects
8. **Step 8**: Refactor `buildTripBoundaryPlan` (lower priority)
9. **Step 9**: Remove dead code from partial-patch functions

### 6.2 Testing Strategy

**Logical Equivalence (Critical):**
- Capture current output for a sequence of vessel location updates (first trip, boundary, regular updates)
- After refactor, assert identical output for same inputs
- Test edge cases: ArrivingTerminalAbbrev at boundary, AtDock flip, LeftDock inference

**Unit Tests:**
- Test `tripsAreEqual()` with various edge cases (undefined vs null, nested ScheduledTrip)
- Test `buildCompleteTrip()` with different inputs
- Test enrichment functions independently against Field Reference rules

**Integration Tests:**
- Simulate vessel location updates over time
- Verify trips are only written when changed
- Verify event-based predictions run exactly once per event

**Performance Tests:**
- Benchmark object construction + compare vs current approach
- Monitor CPU usage and memory allocation
- Verify no degradation in production

---

## 7. Risk Assessment

### 7.1 Low Risk

- Deep equality implementation (well-understood problem)
- Object construction performance (V8 optimized)
- Developer time saved (clear benefit)

### 7.2 Medium Risk

- Regression bugs from logic changes (mitigated by logical-equivalence tests)
- Edge cases in equality comparison (mitigated by comprehensive tests)
- Prediction simplification: event-based may miss edge cases (mitigated by "run once per event" being simpler than throttling)

### 7.3 Mitigations

1. Keep existing functions as fallback during migration
2. Add extensive test coverage before refactoring
3. Run A/B comparison in development environment
4. Monitor performance metrics closely after deployment
5. Rollback plan ready (revert to current implementation)

---

## 8. Alternatives Considered

### 8.1 Option A: Do Nothing

**Pros:**
- No risk of regression
- Code works as-is

**Cons:**
- Complexity continues to increase
- Harder to add new features
- Higher cognitive load for developers

**Verdict**: Not recommended—technical debt will grow

### 8.2 Option B: Full Rewrite

**Pros:**
- Clean slate, apply all learnings

**Cons:**
- High risk
- Long timeline
- May introduce new bugs

**Verdict**: Not recommended—incremental refactoring is safer

### 8.3 Option C: Incremental Refactoring (Recommended)

**Pros:**
- Manageable risk
- Continuous delivery
- Can test each phase independently
- Learnings from each phase inform next steps

**Cons:**
- Takes longer to see full benefit
- Need to maintain hybrid code temporarily

**Verdict**: Recommended—best balance of risk and reward

---

## 9. Conclusion

### 9.1 Summary

The vesselOrchestrator code is well-architected but complex. Two simplifications are recommended:

1. **Build-then-compare**: Replace "check-before-write" with "always build full state, deep-compare at end, write if different." Eliminates scattered conditionals; negligible performance impact.

2. **Event-based predictions**: Replace "up to once per minute" throttling with "run once on first arrive-at-dock, once on first depart-dock." Simpler, matches actual need; model is reliable.

**Invariant**: Any refactor must preserve logical equivalence. Document invariants (Section 2.7), follow Field Reference (Section 2.6), add tests before changing code.

### 9.2 Recommendation

**Proceed with incremental refactoring:**

1. Implement `tripsAreEqual()` (exclude TimeStamp) and `buildCompleteTrip()`
2. Refactor `buildTripUpdatePlan` to build-then-compare
3. Simplify prediction triggers to event-based
4. Refactor enrichment functions to return complete objects (per Field Reference)
5. Add logical-equivalence tests; verify at each step
6. Monitor performance metrics in production

**Expected Benefits:**
- 30-40% reduction in code complexity
- Simpler prediction logic (no time-based throttling)
- Easier to add new fields and business rules
- Reduced bug risk from scattered conditionals
- More predictable behavior

**Timeline:**
- Phase 1 (Build-then-compare + predictions): 1-2 weeks
- Phase 2 (Enrichment refactor): 1-2 weeks
- Phase 3 (Boundary + cleanup): 1 week
- Total: 3-5 weeks

---

## 10. References

### 10.1 Key Files

- `convex/functions/vesselTrips/updates/updateVesselTrips.ts` - Main orchestrator
- `convex/functions/vesselTrips/updates/processVesselTripTick.ts` - Event dispatcher
- `convex/functions/vesselTrips/updates/locationEnrichment.ts` - Location-derived fields
- `convex/functions/vesselTrips/updates/scheduledTripEnrichment.ts` - Trip identity enrichment
- `convex/functions/vesselTrips/updates/arrivalTerminalLookup.ts` - Terminal inference
- `convex/domain/ml/prediction/vesselTripPredictions.ts` - ML predictions

### 10.2 Related Documentation

- `convex/domain/ml/readme-ml.md` - ML pipeline overview
- Project coding standards in `.cursor/rules/`

---

## 11. Convex Function Call Optimization

### 11.1 Call Structure (per 5-second tick)

| Call Type | Function | When | Count |
|-----------|----------|------|-------|
| Query | `getActiveTrips` | Once at start | 1 |
| Query | `findScheduledTripForArrivalLookup` | Per vessel, when at dock + missing ArrivingTerminal | 0–N |
| Query | `getScheduledTripByKey` | Per vessel, when Key derivable + shouldLookup | 0–N |
| Query | `getModelParametersForProduction` / `getModelParametersForProductionBatch` | Per vessel, when prediction runs | 0–5N (or 0–1 with batch) |
| Mutation | `bulkUpsert` (vessel locations) | Once | 1 |
| Mutation | `applyVesselTripsWritePlan` | Once if has writes | 0–1 |
| Mutation | `bulkInsertPredictions` | Once if has predictions | 0–1 |

**Call frequency note:** Most of these queries are triggered once per trip—either at trip start (arrival at dock) or when leaving dock. They are not called every 5 seconds; they run roughly once per 30 minutes or hour per vessel. The intrinsic vesselOrchestrator action runs every 5 seconds, but the expensive lookups and predictions are event-gated. Appropriate conditional checks prevent runaway behavior where they would be called every tick.

### 11.2 Architecture

The vesselOrchestrator is correctly structured as an `internalAction`:
- It performs an external fetch (`fetchVesselLocations`).
- All database access goes through `ctx.runQuery` and `ctx.runMutation`.
- There are no extra internal actions; everything runs in one action context.

In Convex, reads and writes are done by **queries** and **mutations**, not by separate actions. The action orchestrates; queries and mutations perform DB operations.

### 11.3 Implemented Optimizations

**Consolidate arrival lookup + scheduled trip lookup (implemented):**
- When `lookupArrivalTerminalFromSchedule` returns a trip, that document already contains `Key`, `RouteID`, `RouteAbbrev`, `SailingDay`, and full `ScheduledTrip` data.
- `lookupArrivalTerminalFromSchedule` now returns `{ arrivalTerminal?, scheduledTripDoc? }`.
- `enrichTripStartUpdates` accepts optional `cachedScheduledTrip`; when provided and key matches, skips `getScheduledTripByKey`.
- **Savings:** Up to 1 query per vessel when both lookups would have run.

**Batch model loading for predictions (implemented):**
- Added `getModelParametersForProductionBatch` to load multiple model types in one query.
- `computeVesselTripPredictionsPatch` batch-loads when computing 2+ predictions for a vessel.
- **Savings:** When 5 predictions run, reduce from 5 queries to 1.

### 11.4 Runaway Prevention

Conditional checks ensure expensive operations are not called every tick:
- `lookupArrivalTerminalFromSchedule`: Only when at dock, missing ArrivingTerminal, and has required fields.
- `enrichTripStartUpdates`: `shouldLookupScheduledTrip` throttles (key mismatch, no existing key, or seconds < 5).
- `computeVesselTripPredictionsPatch`: `shouldAttemptPrediction` gates on event (just arrived, just left dock) or throttle window.

---

## Appendix A: Document Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-21 | Initial analysis |
| 1.1 | 2026-02-21 | Added: Executive summary revisions (prediction simplification, logical equivalence); Section 2.2 VesselTrip vs VesselLocation; Section 2.7 Refactoring Gotchas & Invariants; Field Reference table (2.6); Revised ML Predictions to event-based model; Phase 4 prediction simplification; Implementation strategy updates; Logical-equivalence testing; Document metadata |
| 1.2 | 2026-02-22 | Added: Section 11 Convex Function Call Optimization; Implemented consolidated arrival + scheduled trip lookup; Implemented batch model loading for predictions; Call frequency clarification (once per trip, not every tick); Runaway prevention checks |
| 1.3 | 2026-02-22 | Clarified: ArrivingTerminalAbbrev fallback chain for regular updates (Section 2.7); deepEqual undefined handling (Section 4.4); Trip boundary always triggers writes including TripEnd (Section 2.1); alreadyCleared optimization preserved by build-then-compare (Section 3.2); First-trip case for PredictionReadyTrip (Section 5.4) |

---

*Document Version: 1.3*
*Last Updated: 2026-02-22*
